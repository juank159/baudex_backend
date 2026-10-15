import { plainToInstance } from 'class-transformer';
import { EntityTarget, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Product } from '../products/entities/product.entity';
import { ProductPresentation } from '../products/entities/product-presentation.entity';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import { ProductPresentationResponseDto } from '../products/dto/product-presentation-response.dto';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { Expense } from '../expenses/entities/expense.entity';
import { PurchaseOrder } from '../inventory/entities/purchase-order.entity';
import { CreditNote } from '../credit-notes/entities/credit-note.entity';
import { CustomerCredit } from '../customer-credits/entities/customer-credit.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { Notification } from '../notifications/entities/notification.entity';

/**
 * Cómo se descarga cada entidad en la sincronización incremental.
 *
 * `joins` y `serialize` replican EXACTAMENTE lo que devuelve el listado que
 * la app usaba antes para esa entidad (mismas relaciones, misma forma del
 * JSON), así la app interpreta cada registro con el mismo código de siempre.
 */
export interface SyncEntityDefinition {
  /** Tabla en la base de datos (también es la clave en `sync_deletions`). */
  table: string;
  entity: EntityTarget<ObjectLiteral>;
  /** Relaciones a cargar: [ruta, alias]. */
  joins: Array<[string, string]>;
  /** Conteos de relaciones: [propiedad destino, relación]. */
  relationCounts?: Array<[string, string]>;
  /** Filtro de organización sobre la tabla (alias `e`). */
  tenantSql: 'org' | 'via-product';
  /** Además filtra por el usuario actual (notificaciones). */
  perUser?: boolean;
  serialize?: (row: any, ctx: SerializeContext) => any;
}

export interface SerializeContext {
  suppliersService: SuppliersService;
}

export const SYNC_ENTITIES: Record<string, SyncEntityDefinition> = {
  invoices: {
    table: 'invoices',
    entity: Invoice,
    tenantSql: 'org',
    joins: [
      ['e.customer', 'customer'],
      ['e.createdBy', 'createdBy'],
      ['e.items', 'items'],
      ['items.product', 'product'],
      ['e.payments', 'payments'],
      ['payments.bankAccount', 'bankAccount'],
    ],
  },
  products: {
    table: 'products',
    entity: Product,
    tenantSql: 'org',
    joins: [
      ['e.category', 'category'],
      ['e.prices', 'prices'],
    ],
    serialize: (row) =>
      plainToInstance(ProductResponseDto, row, {
        excludeExtraneousValues: true,
      }),
  },
  product_presentations: {
    table: 'product_presentations',
    entity: ProductPresentation,
    tenantSql: 'via-product',
    joins: [],
    // Igual que GET /products/:productId/presentations (TransformInterceptor).
    serialize: (row) =>
      plainToInstance(ProductPresentationResponseDto, row, {
        excludeExtraneousValues: true,
      }),
  },
  customers: {
    table: 'customers',
    entity: Customer,
    tenantSql: 'org',
    joins: [],
  },
  suppliers: {
    table: 'suppliers',
    entity: Supplier,
    tenantSql: 'org',
    joins: [],
    serialize: (row, ctx) => ctx.suppliersService.toResponseDto(row),
  },
  expenses: {
    table: 'expenses',
    entity: Expense,
    tenantSql: 'org',
    joins: [
      ['e.category', 'category'],
      ['e.createdBy', 'createdBy'],
      ['e.approvedBy', 'approvedBy'],
    ],
  },
  purchase_orders: {
    table: 'purchase_orders',
    entity: PurchaseOrder,
    tenantSql: 'org',
    joins: [
      ['e.supplier', 'supplier'],
      ['e.createdBy', 'createdBy'],
    ],
    relationCounts: [['e.itemCount', 'e.items']],
  },
  credit_notes: {
    table: 'credit_notes',
    entity: CreditNote,
    tenantSql: 'org',
    joins: [
      ['e.items', 'items'],
      ['e.invoice', 'invoice'],
      ['e.customer', 'customer'],
      ['e.createdBy', 'createdBy'],
    ],
  },
  customer_credits: {
    table: 'customer_credits',
    entity: CustomerCredit,
    tenantSql: 'org',
    joins: [
      ['e.customer', 'customer'],
      ['e.invoice', 'invoice'],
      ['e.createdBy', 'createdBy'],
      // Abonos: la app muestra el historial del crédito sin conexión.
      ['e.payments', 'payments'],
    ],
  },
  inventory_batches: {
    table: 'inventory_batches',
    entity: InventoryBatch,
    tenantSql: 'org',
    joins: [['e.product', 'product']],
  },
  inventory_movements: {
    table: 'inventory_movements',
    entity: InventoryMovement,
    tenantSql: 'org',
    joins: [['e.product', 'product']],
    // Igual que GET /inventory/movements: nombre y SKU planos, sin objetos
    // anidados.
    serialize: (movement) => ({
      ...movement,
      productName: movement.product?.name || null,
      productSku: movement.product?.sku || null,
      product: null,
      performedBy: null,
    }),
  },
  notifications: {
    table: 'notifications',
    entity: Notification,
    tenantSql: 'org',
    perUser: true,
    joins: [],
  },
};

export function applyJoins(
  qb: SelectQueryBuilder<ObjectLiteral>,
  def: SyncEntityDefinition,
): SelectQueryBuilder<ObjectLiteral> {
  for (const [path, alias] of def.joins) {
    qb.leftJoinAndSelect(path, alias);
  }
  for (const [property, relation] of def.relationCounts ?? []) {
    qb.loadRelationCountAndMap(property, relation);
  }
  return qb;
}
