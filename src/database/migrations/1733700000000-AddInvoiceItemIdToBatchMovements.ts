// src/database/migrations/1733700000000-AddInvoiceItemIdToBatchMovements.ts
import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Migración para agregar invoice_item_id a inventory_batch_movements
 *
 * Esta migración permite rastrear exactamente qué lote se consumió para cada
 * item de factura, lo cual es crítico para:
 * 1. Devoluciones correctas en notas de crédito (devolver al lote original)
 * 2. Trazabilidad completa FIFO
 * 3. Auditoría precisa de movimientos de inventario
 *
 * Changelog:
 * - Agrega columna invoice_item_id (UUID, nullable)
 * - Agrega foreign key a invoice_items
 * - Agrega índice para búsquedas rápidas
 */
export class AddInvoiceItemIdToBatchMovements1733700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== AGREGAR COLUMNA ====================
    await queryRunner.addColumn(
      'inventory_batch_movements',
      new TableColumn({
        name: 'invoice_item_id',
        type: 'uuid',
        isNullable: true, // Nullable para compatibilidad con datos históricos
        comment: 'Vincula el movimiento de lote con el item de factura específico',
      }),
    );

    console.log('✅ Columna invoice_item_id agregada a inventory_batch_movements');

    // ==================== AGREGAR FOREIGN KEY ====================
    await queryRunner.createForeignKey(
      'inventory_batch_movements',
      new TableForeignKey({
        name: 'FK_batch_movement_invoice_item',
        columnNames: ['invoice_item_id'],
        referencedTableName: 'invoice_items',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL', // Mantener movimiento si se elimina el item
        onUpdate: 'CASCADE',
      }),
    );

    console.log('✅ Foreign key FK_batch_movement_invoice_item creada');

    // ==================== AGREGAR ÍNDICE ====================
    await queryRunner.createIndex(
      'inventory_batch_movements',
      new TableIndex({
        name: 'IDX_batch_movements_invoice_item',
        columnNames: ['invoice_item_id'],
      }),
    );

    console.log('✅ Índice IDX_batch_movements_invoice_item creado');

    console.log('✅ Migración completada: invoice_item_id agregado exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar en orden inverso

    // 1. Eliminar índice
    await queryRunner.dropIndex(
      'inventory_batch_movements',
      'IDX_batch_movements_invoice_item',
    );
    console.log('✅ Índice eliminado');

    // 2. Eliminar foreign key
    await queryRunner.dropForeignKey(
      'inventory_batch_movements',
      'FK_batch_movement_invoice_item',
    );
    console.log('✅ Foreign key eliminada');

    // 3. Eliminar columna
    await queryRunner.dropColumn('inventory_batch_movements', 'invoice_item_id');
    console.log('✅ Columna invoice_item_id eliminada');

    console.log('✅ Migración revertida exitosamente');
  }
}
