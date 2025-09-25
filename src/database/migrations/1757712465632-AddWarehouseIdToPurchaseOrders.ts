import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarehouseIdToPurchaseOrders1757712465632
  implements MigrationInterface
{
  name = 'AddWarehouseIdToPurchaseOrders1757712465632';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna ya existe antes de agregarla
    const hasColumn = await queryRunner.hasColumn(
      'purchase_orders',
      'warehouseId',
    );

    if (!hasColumn) {
      // Agregar columna warehouse_id a purchase_orders
      await queryRunner.query(
        `ALTER TABLE "purchase_orders" ADD "warehouseId" uuid`,
      );

      // Crear índice para mejorar rendimiento en consultas por almacén
      await queryRunner.query(
        `CREATE INDEX "IDX_purchase_orders_warehouse_id" ON "purchase_orders" ("warehouseId")`,
      );

      // Verificar si existe tabla warehouses antes de crear foreign key
      const hasWarehousesTable = await queryRunner.hasTable('warehouses');
      if (hasWarehousesTable) {
        // Agregar foreign key constraint hacia warehouses
        await queryRunner.query(
          `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_warehouse_id" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_purchase_orders_warehouse_id"`,
    );

    // Eliminar índice
    await queryRunner.query(`DROP INDEX "IDX_purchase_orders_warehouse_id"`);

    // Eliminar columna
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN "warehouseId"`,
    );
  }
}
