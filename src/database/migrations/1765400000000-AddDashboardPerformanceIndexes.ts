import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices de rendimiento para las queries del módulo Dashboard.
 *
 * Todas se crean con IF NOT EXISTS y CONCURRENTLY está deshabilitado porque
 * TypeORM corre migraciones dentro de transacción (CONCURRENTLY no puede).
 * En tablas grandes se puede crear el índice manualmente con CONCURRENTLY.
 */
export class AddDashboardPerformanceIndexes1765400000000 implements MigrationInterface {
  name = 'AddDashboardPerformanceIndexes1765400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cobros por período (totalCollected, trend, payment methods, currencyBreakdown).
    // Antes se hacía Filter sobre expresión (p.paymentDate::date); ahora usa rangos.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_org_paymentDate"
      ON "payments" ("organization_id", "paymentDate")
      WHERE "deleted_at" IS NULL
    `);

    // Receivables con semáforo (queries agrupan por urgencia sobre facturas pendientes).
    // Índice parcial: solo las que tienen saldo pendiente — ~1% de la tabla en producción.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_org_dueDate_pending"
      ON "invoices" ("organization_id", "dueDate")
      WHERE status IN ('pending', 'partially_paid') AND "balanceDue" > 0 AND "deleted_at" IS NULL
    `);

    // Expense aggregate del dashboard: WHERE status='approved' AND date BETWEEN x AND y.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_org_status_date"
      ON "expenses" ("organization_id", "status", "date")
      WHERE "deleted_at" IS NULL
    `);

    console.log('Índices de dashboard creados');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_org_status_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_org_dueDate_pending"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_org_paymentDate"`);
  }
}
