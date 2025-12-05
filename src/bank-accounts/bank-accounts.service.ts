// src/bank-accounts/bank-accounts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { BankAccountQueryDto } from './dto/bank-account-query.dto';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepository: Repository<BankAccount>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Crear una nueva cuenta bancaria
   */
  async create(
    createDto: CreateBankAccountDto,
    createdById?: string,
  ): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Validar unicidad: combinación banco + número de cuenta (case-insensitive para nombre)
    if (createDto.accountNumber) {
      await this.validateUniqueBankAccountCombination(
        tenantId,
        createDto.name,
        createDto.accountNumber,
      );
    }

    // Si es la primera cuenta o se marca como default, asegurar que sea la única default
    if (createDto.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    // Si es la primera cuenta del tenant, marcarla como default
    const existingAccounts = await this.bankAccountRepository.count({
      where: { organizationId: tenantId },
    });

    const bankAccount = this.bankAccountRepository.create({
      ...createDto,
      organizationId: tenantId,
      createdById,
      isDefault: createDto.isDefault || existingAccounts === 0, // Primera cuenta es default
    });

    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Obtener todas las cuentas bancarias del tenant
   */
  async findAll(query: BankAccountQueryDto = {}): Promise<BankAccount[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const queryBuilder = this.bankAccountRepository.createQueryBuilder('ba');

    queryBuilder.where('ba.organizationId = :organizationId', {
      organizationId: tenantId,
    });

    // Filtrar por tipo
    if (query.type) {
      queryBuilder.andWhere('ba.type = :type', { type: query.type });
    }

    // Filtrar por activo (por defecto solo activos)
    if (!query.includeInactive) {
      queryBuilder.andWhere('ba.isActive = :isActive', { isActive: true });
    } else if (query.isActive !== undefined) {
      queryBuilder.andWhere('ba.isActive = :isActive', { isActive: query.isActive });
    }

    // Ordenar: primero default, luego por sortOrder, luego por nombre
    queryBuilder.orderBy('ba.isDefault', 'DESC');
    queryBuilder.addOrderBy('ba.sortOrder', 'ASC');
    queryBuilder.addOrderBy('ba.name', 'ASC');

    return await queryBuilder.getMany();
  }

  /**
   * Obtener una cuenta bancaria por ID
   */
  async findOne(id: string): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.bankAccountRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!bankAccount) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    return bankAccount;
  }

  /**
   * Actualizar una cuenta bancaria
   */
  async update(
    id: string,
    updateDto: UpdateBankAccountDto,
    updatedById?: string,
  ): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.findOne(id);

    // Validar unicidad: combinación banco + número de cuenta (si se está cambiando alguno)
    const newName = updateDto.name ?? bankAccount.name;
    const newAccountNumber = updateDto.accountNumber ?? bankAccount.accountNumber;
    const nameChanged = updateDto.name && updateDto.name.toLowerCase() !== bankAccount.name.toLowerCase();
    const numberChanged = updateDto.accountNumber && updateDto.accountNumber !== bankAccount.accountNumber;

    if ((nameChanged || numberChanged) && newAccountNumber) {
      await this.validateUniqueBankAccountCombination(
        tenantId,
        newName,
        newAccountNumber,
        id,
      );
    }

    // Si se marca como default, quitar el flag de las demás
    if (updateDto.isDefault && !bankAccount.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    // Actualizar campos
    Object.assign(bankAccount, {
      ...updateDto,
      updatedById,
    });

    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Eliminar (soft delete) una cuenta bancaria
   */
  async remove(id: string): Promise<void> {
    const bankAccount = await this.findOne(id);

    // Si era la cuenta default, asignar otra como default
    if (bankAccount.isDefault) {
      const tenantId = this.tenantAwareService.getTenantId();
      await this.bankAccountRepository.softDelete(id);

      // Buscar otra cuenta activa para hacerla default
      const anotherAccount = await this.bankAccountRepository.findOne({
        where: { organizationId: tenantId, isActive: true },
        order: { sortOrder: 'ASC' },
      });

      if (anotherAccount) {
        anotherAccount.isDefault = true;
        await this.bankAccountRepository.save(anotherAccount);
      }
    } else {
      await this.bankAccountRepository.softDelete(id);
    }
  }

  /**
   * Establecer una cuenta como predeterminada
   */
  async setDefault(id: string): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.findOne(id);

    if (!bankAccount.isActive) {
      throw new BadRequestException(
        'No se puede establecer como predeterminada una cuenta inactiva',
      );
    }

    // Quitar default de las demás
    await this.clearDefaultFlag(tenantId);

    // Establecer como default
    bankAccount.isDefault = true;
    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Activar/desactivar una cuenta
   */
  async toggleActive(id: string): Promise<BankAccount> {
    const bankAccount = await this.findOne(id);

    // Si es la cuenta default y se va a desactivar, no permitir
    if (bankAccount.isDefault && bankAccount.isActive) {
      throw new BadRequestException(
        'No se puede desactivar la cuenta predeterminada. Primero establece otra cuenta como predeterminada.',
      );
    }

    bankAccount.isActive = !bankAccount.isActive;
    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Obtener la cuenta predeterminada del tenant
   */
  async getDefault(): Promise<BankAccount | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return await this.bankAccountRepository.findOne({
      where: { organizationId: tenantId, isDefault: true, isActive: true },
    });
  }

  /**
   * Obtener cuentas activas del tenant (para selects/dropdowns)
   */
  async getActiveAccounts(): Promise<BankAccount[]> {
    return this.findAll({ isActive: true });
  }

  /**
   * Actualizar el saldo de una cuenta bancaria
   * @param accountId - ID de la cuenta
   * @param amount - Monto a agregar (positivo) o restar (negativo)
   * @param operation - 'add' para sumar, 'subtract' para restar
   */
  async updateBalance(
    accountId: string,
    amount: number,
    operation: 'add' | 'subtract' = 'add',
  ): Promise<BankAccount> {
    const account = await this.findOne(accountId);

    const currentBalance = Number(account.currentBalance) || 0;
    const adjustedAmount = operation === 'subtract' ? -amount : amount;
    const newBalance = currentBalance + adjustedAmount;

    account.currentBalance = Math.round(newBalance * 100) / 100;

    console.log(`💰 Actualizando saldo de cuenta "${account.name}":
      - Saldo anterior: $${currentBalance.toLocaleString()}
      - Operación: ${operation} $${amount.toLocaleString()}
      - Nuevo saldo: $${account.currentBalance.toLocaleString()}`);

    return await this.bankAccountRepository.save(account);
  }

  /**
   * Actualizar el saldo de una cuenta bancaria por ID directamente (para transacciones)
   * Este método NO valida tenant, debe usarse dentro de transacciones controladas
   */
  async updateBalanceById(
    accountId: string,
    amount: number,
    organizationId: string,
  ): Promise<void> {
    await this.bankAccountRepository
      .createQueryBuilder()
      .update(BankAccount)
      .set({
        currentBalance: () => `current_balance + ${amount}`,
      })
      .where('id = :accountId', { accountId })
      .andWhere('organizationId = :organizationId', { organizationId })
      .execute();

    console.log(`💰 Saldo actualizado para cuenta ${accountId}: +$${amount.toLocaleString()}`);
  }

  /**
   * Obtener cuenta por ID sin validación de tenant (para uso interno en transacciones)
   */
  async findByIdInternal(accountId: string): Promise<BankAccount | null> {
    return await this.bankAccountRepository.findOne({
      where: { id: accountId },
    });
  }

  /**
   * Quitar el flag isDefault de todas las cuentas del tenant
   */
  private async clearDefaultFlag(organizationId: string): Promise<void> {
    await this.bankAccountRepository
      .createQueryBuilder()
      .update(BankAccount)
      .set({ isDefault: false })
      .where('organizationId = :organizationId', { organizationId })
      .execute();
  }

  /**
   * Validar que la combinación (nombre banco + número cuenta) sea única para el tenant
   * - Permite múltiples cuentas del mismo banco con diferentes números
   * - Permite el mismo número en diferentes bancos
   * - NO permite: mismo banco + mismo número
   * @param organizationId - ID de la organización
   * @param bankName - Nombre del banco (case-insensitive)
   * @param accountNumber - Número de cuenta
   * @param excludeId - ID de cuenta a excluir (para updates)
   */
  private async validateUniqueBankAccountCombination(
    organizationId: string,
    bankName: string,
    accountNumber: string,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.bankAccountRepository
      .createQueryBuilder('ba')
      .where('ba.organizationId = :organizationId', { organizationId })
      .andWhere('LOWER(ba.name) = LOWER(:bankName)', { bankName: bankName.trim() })
      .andWhere('ba.accountNumber = :accountNumber', { accountNumber });

    // Si es un update, excluir la cuenta actual
    if (excludeId) {
      queryBuilder.andWhere('ba.id != :excludeId', { excludeId });
    }

    const existingAccount = await queryBuilder.getOne();

    if (existingAccount) {
      throw new BadRequestException(
        `Ya existe una cuenta "${bankName}" con el número "${accountNumber}" en tu organización`,
      );
    }
  }
}
