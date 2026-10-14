// src/customer-credits/client-balance.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, EntityManager } from 'typeorm';
import { ClientBalance } from './entities/client-balance.entity';
import {
  ClientBalanceTransaction,
  BalanceTransactionType,
} from './entities/client-balance-transaction.entity';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { CustomersService } from '../customers/customers.service';

/**
 * DTO para usar saldo
 */
export interface UseBalanceDto {
  clientId: string;
  amount: number;
  description: string;
  relatedCreditId?: string;
  relatedInvoiceId?: string;
}

/**
 * DTO para devolver saldo (reembolso)
 */
export interface RefundBalanceDto {
  clientId: string;
  amount: number;
  description: string;
  paymentMethod: string;
}

/**
 * DTO para ajustar saldo
 */
export interface AdjustBalanceDto {
  clientId: string;
  amount: number; // Positivo para aumentar, negativo para reducir
  description: string;
}

@Injectable()
export class ClientBalanceService {
  constructor(
    @InjectRepository(ClientBalance)
    private readonly balanceRepository: Repository<ClientBalance>,
    @InjectRepository(ClientBalanceTransaction)
    private readonly transactionRepository: Repository<ClientBalanceTransaction>,
    private readonly tenantAwareService: TenantAwareService,
    private readonly customersService: CustomersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Obtener o crear el saldo de un cliente
   */
  async getOrCreateClientBalance(
    customerId: string,
    createdById: string,
  ): Promise<ClientBalance> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Verificar que el cliente existe
    const customer = await this.customersService.findOne(customerId);
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Buscar saldo existente
    let clientBalance = await this.balanceRepository.findOne({
      where: { customerId, organizationId: tenantId },
      relations: ['customer', 'transactions'],
    });

    // Si no existe, crear uno nuevo
    if (!clientBalance) {
      clientBalance = this.balanceRepository.create({
        customerId,
        balance: 0,
        organizationId: tenantId,
        createdById,
      });
      await this.balanceRepository.save(clientBalance);

      // Recargar con relaciones
      clientBalance = await this.balanceRepository.findOne({
        where: { customerId, organizationId: tenantId },
        relations: ['customer', 'transactions'],
      });
    }

    return clientBalance;
  }

  /**
   * Obtener el saldo de un cliente por ID de cliente
   */
  async getClientBalance(customerId: string): Promise<ClientBalance | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.balanceRepository.findOne({
      where: { customerId, organizationId: tenantId },
      relations: ['customer', 'transactions'],
      order: {
        transactions: {
          createdAt: 'DESC',
        },
      },
    });
  }

  /**
   * Verificar rápidamente si un cliente tiene saldo disponible
   * Optimizado para consultas rápidas desde UI
   */
  async getAvailableBalance(customerId: string): Promise<{
    hasBalance: boolean;
    amount: number;
    customerId: string;
    customerName: string | null;
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const clientBalance = await this.balanceRepository.findOne({
      where: { customerId, organizationId: tenantId },
      relations: ['customer'],
    });

    if (!clientBalance) {
      // Verificar que el cliente existe
      const customer = await this.customersService.findOne(customerId);
      return {
        hasBalance: false,
        amount: 0,
        customerId,
        customerName: customer?.displayName || null,
      };
    }

    const amount = Number(clientBalance.balance);
    return {
      hasBalance: amount > 0,
      amount,
      customerId,
      customerName: clientBalance.customer?.displayName || null,
    };
  }

  /**
   * Obtener todos los saldos de clientes (con saldo > 0)
   */
  async getAllClientBalances(): Promise<ClientBalance[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.balanceRepository.find({
      where: {
        organizationId: tenantId,
        balance: MoreThan(0),
      },
      relations: ['customer'],
      order: { balance: 'DESC' },
    });
  }

  /**
   * Depositar dinero al saldo del cliente (sobrepago)
   * @param externalManager EntityManager opcional: si el llamador ya está en
   * una transacción, el depósito viaja en esa misma transacción (o se guarda
   * todo, o no se guarda nada).
   */
  async depositBalance(
    customerId: string,
    amount: number,
    description: string,
    createdById: string,
    relatedCreditId?: string,
    externalManager?: EntityManager,
  ): Promise<ClientBalance> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    console.log(`📥 [ClientBalance] Depositando $${amount} para cliente ${customerId}`);

    const executeDeposit = async (manager: EntityManager) => {
      // Obtener o crear saldo del cliente
      let clientBalance = await manager.findOne(ClientBalance, {
        where: { customerId, organizationId: tenantId },
      });

      if (!clientBalance) {
        clientBalance = manager.create(ClientBalance, {
          customerId,
          balance: 0,
          organizationId: tenantId,
          createdById,
        });
        clientBalance = await manager.save(ClientBalance, clientBalance);
        console.log(`✅ [ClientBalance] Saldo creado para cliente ${customerId}`);
      }

      // Sumar de forma atómica en SQL: dos depósitos simultáneos no se pisan.
      const updateResult = await manager.query(
        `UPDATE client_balances
            SET balance = COALESCE(balance, 0) + $1
          WHERE id = $2
      RETURNING balance`,
        [amount, clientBalance.id],
      );
      const updatedRows: any = Array.isArray(updateResult?.[0])
        ? updateResult[0]
        : updateResult;
      const newBalance = parseFloat(updatedRows?.[0]?.balance ?? '0') || 0;

      // Crear transacción
      const transaction = manager.create(ClientBalanceTransaction, {
        clientBalanceId: clientBalance.id,
        type: BalanceTransactionType.DEPOSIT,
        amount,
        description,
        balanceAfter: newBalance,
        relatedCreditId,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(ClientBalanceTransaction, transaction);

      console.log(`✅ [ClientBalance] Depositado $${amount}. Nuevo saldo: $${newBalance}`);

      clientBalance.balance = newBalance;
      return clientBalance;
    };

    // Dentro de la transacción del llamador: sin abrir otra conexión.
    if (externalManager) {
      return executeDeposit(externalManager);
    }

    await this.dataSource.transaction(executeDeposit);

    // Recargar y retornar (ya confirmado)
    return this.getClientBalance(customerId);
  }

  /**
   * Usar saldo del cliente para pagar crédito o factura
   * @param dto Datos del uso de saldo
   * @param createdById ID del usuario que realiza la operación
   * @param externalManager EntityManager opcional para usar la misma transacción que el llamador
   */
  async useBalance(
    dto: UseBalanceDto,
    createdById: string,
    externalManager?: any, // EntityManager opcional para transacciones anidadas
  ): Promise<ClientBalance> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const { clientId, amount, description, relatedCreditId, relatedInvoiceId } = dto;

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    console.log(`💳 [ClientBalance] Usando $${amount} del saldo del cliente ${clientId}`);

    // Si se pasa un manager externo, usarlo directamente (sin crear nueva transacción)
    // Esto permite participar en la transacción del llamador
    if (externalManager) {
      return this.executeUseBalance(
        externalManager,
        clientId,
        amount,
        description,
        relatedCreditId,
        relatedInvoiceId,
        tenantId,
        createdById,
      );
    }

    // Si no hay manager externo, crear nuestra propia transacción
    return this.dataSource.transaction(async (manager) => {
      return this.executeUseBalance(
        manager,
        clientId,
        amount,
        description,
        relatedCreditId,
        relatedInvoiceId,
        tenantId,
        createdById,
      );
    });
  }

  /**
   * Lógica interna para usar saldo (separada para reutilización)
   */
  private async executeUseBalance(
    manager: any,
    clientId: string,
    amount: number,
    description: string,
    relatedCreditId: string | undefined,
    relatedInvoiceId: string | undefined,
    tenantId: string,
    createdById: string,
  ): Promise<ClientBalance> {
    const clientBalance = await manager.findOne(ClientBalance, {
      where: { customerId: clientId, organizationId: tenantId },
    });

    if (!clientBalance) {
      throw new NotFoundException(`Cliente ${clientId} no tiene saldo a favor`);
    }

    // Descontar de forma atómica y condicional en SQL: si dos operaciones
    // intentan usar el mismo saldo a la vez, solo pasa la que alcanza; el
    // saldo nunca queda negativo ni se gasta dos veces.
    const updateResult = await manager.query(
      `UPDATE client_balances
          SET balance = balance - $1
        WHERE id = $2 AND balance >= $1
    RETURNING balance`,
      [amount, clientBalance.id],
    );
    const updatedRows: any = Array.isArray(updateResult?.[0])
      ? updateResult[0]
      : updateResult;

    if (!updatedRows || updatedRows.length === 0) {
      const currentBalance = Number(clientBalance.balance);
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: $${currentBalance.toLocaleString()}, Solicitado: $${amount.toLocaleString()}`,
      );
    }

    const newBalance = parseFloat(updatedRows[0].balance) || 0;

    // Crear transacción
    const transaction = manager.create(ClientBalanceTransaction, {
      clientBalanceId: clientBalance.id,
      type: BalanceTransactionType.USAGE,
      amount,
      description,
      balanceAfter: newBalance,
      relatedCreditId,
      relatedInvoiceId,
      organizationId: tenantId,
      createdById,
    });
    await manager.save(ClientBalanceTransaction, transaction);

    console.log(`✅ [ClientBalance] Usado $${amount}. Saldo restante: $${newBalance}`);

    return this.getClientBalance(clientId);
  }

  /**
   * Devolver saldo al cliente (reembolso)
   */
  async refundBalance(
    dto: RefundBalanceDto,
    createdById: string,
  ): Promise<ClientBalance> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const { clientId, amount, description, paymentMethod } = dto;

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    console.log(`💸 [ClientBalance] Reembolsando $${amount} al cliente ${clientId}`);

    return this.dataSource.transaction(async (manager) => {
      const clientBalance = await manager.findOne(ClientBalance, {
        where: { customerId: clientId, organizationId: tenantId },
      });

      if (!clientBalance) {
        throw new NotFoundException(`Cliente ${clientId} no tiene saldo a favor`);
      }

      const currentBalance = Number(clientBalance.balance);

      if (amount > currentBalance) {
        throw new BadRequestException(
          `Monto de reembolso excede el saldo disponible. Disponible: $${currentBalance.toLocaleString()}, Solicitado: $${amount.toLocaleString()}`,
        );
      }

      const newBalance = currentBalance - amount;

      // Actualizar saldo
      await manager.update(
        ClientBalance,
        { id: clientBalance.id },
        { balance: newBalance },
      );

      // Crear transacción
      const transaction = manager.create(ClientBalanceTransaction, {
        clientBalanceId: clientBalance.id,
        type: BalanceTransactionType.REFUND,
        amount,
        description,
        balanceAfter: newBalance,
        paymentMethod,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(ClientBalanceTransaction, transaction);

      console.log(`✅ [ClientBalance] Reembolsado $${amount} via ${paymentMethod}. Saldo restante: $${newBalance}`);

      return this.getClientBalance(clientId);
    });
  }

  /**
   * Ajustar saldo manualmente (corrección)
   */
  async adjustBalance(
    dto: AdjustBalanceDto,
    createdById: string,
  ): Promise<ClientBalance> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const { clientId, amount, description } = dto;

    if (amount === 0) {
      throw new BadRequestException('El monto del ajuste no puede ser cero');
    }

    console.log(`🔧 [ClientBalance] Ajustando saldo del cliente ${clientId} en $${amount}`);

    return this.dataSource.transaction(async (manager) => {
      let clientBalance = await manager.findOne(ClientBalance, {
        where: { customerId: clientId, organizationId: tenantId },
      });

      if (!clientBalance) {
        // Si no existe, crear uno nuevo
        clientBalance = manager.create(ClientBalance, {
          customerId: clientId,
          balance: 0,
          organizationId: tenantId,
          createdById,
        });
        await manager.save(ClientBalance, clientBalance);
      }

      const currentBalance = Number(clientBalance.balance);
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new BadRequestException(
          `El ajuste resultaría en un saldo negativo. Saldo actual: $${currentBalance.toLocaleString()}, Ajuste: $${amount.toLocaleString()}`,
        );
      }

      // Actualizar saldo
      await manager.update(
        ClientBalance,
        { id: clientBalance.id },
        { balance: newBalance },
      );

      // Crear transacción
      const transaction = manager.create(ClientBalanceTransaction, {
        clientBalanceId: clientBalance.id,
        type: BalanceTransactionType.ADJUSTMENT,
        amount: Math.abs(amount),
        description: `${amount > 0 ? 'Aumento' : 'Reducción'} - ${description}`,
        balanceAfter: newBalance,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(ClientBalanceTransaction, transaction);

      console.log(`✅ [ClientBalance] Ajustado. Nuevo saldo: $${newBalance}`);

      return this.getClientBalance(clientId);
    });
  }

  /**
   * Obtener historial de transacciones de un cliente
   */
  async getClientTransactions(clientId: string): Promise<ClientBalanceTransaction[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const clientBalance = await this.balanceRepository.findOne({
      where: { customerId: clientId, organizationId: tenantId },
    });

    if (!clientBalance) {
      return [];
    }

    return this.transactionRepository.find({
      where: { clientBalanceId: clientBalance.id },
      relations: ['relatedCredit', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
