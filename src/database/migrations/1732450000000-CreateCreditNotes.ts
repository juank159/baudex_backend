// src/database/migrations/1732450000000-CreateCreditNotes.ts
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

/**
 * Migración para crear las tablas de Notas de Crédito
 *
 * Esta migración crea:
 * 1. Tabla credit_notes - Encabezados de notas de crédito
 * 2. Tabla credit_note_items - Items de notas de crédito
 * 3. Índices para optimizar queries
 * 4. Foreign keys con integridad referencial
 */
export class CreateCreditNotes1732450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== TABLA: credit_notes ====================
    await queryRunner.createTable(
      new Table({
        name: 'credit_notes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'number',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'date',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          // Referencias
          {
            name: 'invoice_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_by_id',
            type: 'uuid',
            isNullable: false,
          },
          // Tipo y Razón
          {
            name: 'type',
            type: 'enum',
            enum: ['full', 'partial'],
            default: "'partial'",
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: [
              'returned_goods',
              'damaged_goods',
              'billing_error',
              'price_adjustment',
              'order_cancellation',
              'customer_dissatisfaction',
              'inventory_adjustment',
              'discount_granted',
              'other',
            ],
            isNullable: false,
          },
          {
            name: 'reason_description',
            type: 'text',
            isNullable: true,
          },
          // Montos
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'tax_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 19,
            isNullable: false,
          },
          {
            name: 'tax_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          // Estado
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'confirmed', 'cancelled'],
            default: "'draft'",
            isNullable: false,
          },
          {
            name: 'applied_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'applied_by_id',
            type: 'uuid',
            isNullable: true,
          },
          // Inventario
          {
            name: 'restore_inventory',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'inventory_restored',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'inventory_restored_at',
            type: 'timestamp',
            isNullable: true,
          },
          // Notas y Metadata
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'terms',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          // Timestamps
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // ==================== ÍNDICES: credit_notes ====================

    // Índice único compuesto para multitenancy
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_organization_number_unique',
        columnNames: ['organization_id', 'number'],
        isUnique: true,
      }),
    );

    // Índice para consultas por factura
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_invoice',
        columnNames: ['invoice_id'],
      }),
    );

    // Índice para consultas por cliente
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_customer',
        columnNames: ['customer_id'],
      }),
    );

    // Índice para consultas por fecha
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_date',
        columnNames: ['date'],
      }),
    );

    // Índice para consultas por estado
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_status',
        columnNames: ['status'],
      }),
    );

    // Índice compuesto para consultas frecuentes
    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_organization_date',
        columnNames: ['organization_id', 'date'],
      }),
    );

    await queryRunner.createIndex(
      'credit_notes',
      new TableIndex({
        name: 'IDX_credit_notes_organization_status',
        columnNames: ['organization_id', 'status'],
      }),
    );

    // ==================== FOREIGN KEYS: credit_notes ====================

    await queryRunner.createForeignKey(
      'credit_notes',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedTableName: 'invoices',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT', // No permitir eliminar factura si tiene notas de crédito
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_notes',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_notes',
      new TableForeignKey({
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_notes',
      new TableForeignKey({
        columnNames: ['created_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_notes',
      new TableForeignKey({
        columnNames: ['applied_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // ==================== TABLA: credit_note_items ====================
    await queryRunner.createTable(
      new Table({
        name: 'credit_note_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          // Referencias
          {
            name: 'credit_note_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'invoice_item_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: true,
          },
          // Detalles del Item
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'decimal',
            precision: 10,
            scale: 3,
            default: 0,
            isNullable: false,
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'unit',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          // Costos
          {
            name: 'unit_cost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'total_cost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          // Descuentos
          {
            name: 'discount_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          // Notas y Metadata
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          // Timestamps
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // ==================== ÍNDICES: credit_note_items ====================

    await queryRunner.createIndex(
      'credit_note_items',
      new TableIndex({
        name: 'IDX_credit_note_items_credit_note',
        columnNames: ['credit_note_id'],
      }),
    );

    await queryRunner.createIndex(
      'credit_note_items',
      new TableIndex({
        name: 'IDX_credit_note_items_invoice_item',
        columnNames: ['invoice_item_id'],
      }),
    );

    await queryRunner.createIndex(
      'credit_note_items',
      new TableIndex({
        name: 'IDX_credit_note_items_product',
        columnNames: ['product_id'],
      }),
    );

    // ==================== FOREIGN KEYS: credit_note_items ====================

    await queryRunner.createForeignKey(
      'credit_note_items',
      new TableForeignKey({
        columnNames: ['credit_note_id'],
        referencedTableName: 'credit_notes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Eliminar items si se elimina la nota de crédito
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_note_items',
      new TableForeignKey({
        columnNames: ['invoice_item_id'],
        referencedTableName: 'invoice_items',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL', // Mantener item si se elimina el item de factura
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'credit_note_items',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    console.log('✅ Tablas de notas de crédito creadas exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar en orden inverso para respetar foreign keys

    // Eliminar foreign keys de credit_note_items
    const creditNoteItemsTable = await queryRunner.getTable('credit_note_items');
    if (creditNoteItemsTable) {
      const foreignKeys = creditNoteItemsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('credit_note_items', foreignKey);
      }
    }

    // Eliminar índices de credit_note_items
    await queryRunner.dropIndex('credit_note_items', 'IDX_credit_note_items_credit_note');
    await queryRunner.dropIndex('credit_note_items', 'IDX_credit_note_items_invoice_item');
    await queryRunner.dropIndex('credit_note_items', 'IDX_credit_note_items_product');

    // Eliminar tabla credit_note_items
    await queryRunner.dropTable('credit_note_items');

    // Eliminar foreign keys de credit_notes
    const creditNotesTable = await queryRunner.getTable('credit_notes');
    if (creditNotesTable) {
      const foreignKeys = creditNotesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('credit_notes', foreignKey);
      }
    }

    // Eliminar índices de credit_notes
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_organization_number_unique');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_invoice');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_customer');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_date');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_status');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_organization_date');
    await queryRunner.dropIndex('credit_notes', 'IDX_credit_notes_organization_status');

    // Eliminar tabla credit_notes
    await queryRunner.dropTable('credit_notes');

    console.log('✅ Tablas de notas de crédito eliminadas exitosamente');
  }
}
