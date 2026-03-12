import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTimestampsToTimestamptz1764000000000
  implements MigrationInterface
{
  name = 'AlterTimestampsToTimestamptz1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Configurar timezone UTC para la sesión
    await queryRunner.query(`SET timezone = 'UTC'`);

    // Tablas que deben ser migradas
    const tables = [
      'organizations',
      'users',
      'subscriptions',
      'categories',
      'products',
      'product_prices',
      'customers',
      'suppliers',
      'invoices',
      'invoice_items',
      'temporary_products',
      'payments',
      'sales',
      'sale_items',
      'expenses',
      'expense_categories',
      'purchase_orders',
      'purchase_order_items',
      'inventory_batches',
      'inventory_movements',
      'inventory_batch_movements',
      'product_purchase_history',
      'warehouses',
      'user_preferences',
      'credit_notes',
      'bank_accounts',
      'customer_credits',
      'credit_payments',
      'credit_transactions',
      'client_balances',
      'client_balance_transactions',
      'notifications',
      'dynamic_notification_states',
      'bank_account_movements',
    ];

    for (const table of tables) {
      // Detectar dinámicamente columnas timestamp sin timezone
      const columns = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = '${table}'
          AND table_schema = 'public'
          AND data_type = 'timestamp without time zone'
      `);

      if (columns.length === 0) {
        console.log(`⏭️  ${table}: no tiene columnas timestamp, saltando`);
        continue;
      }

      const alterClauses = columns
        .map(
          (col: { column_name: string }) =>
            `ALTER COLUMN "${col.column_name}" TYPE timestamptz USING "${col.column_name}" AT TIME ZONE 'UTC'`,
        )
        .join(',\n        ');

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ${alterClauses}
      `);

      console.log(
        `✅ ${table}: ${columns.length} columna(s) migradas a timestamptz`,
      );
    }

    console.log('✅ Todas las columnas timestamp migradas a timestamptz');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'organizations',
      'users',
      'subscriptions',
      'categories',
      'products',
      'product_prices',
      'customers',
      'suppliers',
      'invoices',
      'invoice_items',
      'temporary_products',
      'payments',
      'sales',
      'sale_items',
      'expenses',
      'expense_categories',
      'purchase_orders',
      'purchase_order_items',
      'inventory_batches',
      'inventory_movements',
      'inventory_batch_movements',
      'product_purchase_history',
      'warehouses',
      'user_preferences',
      'credit_notes',
      'bank_accounts',
      'customer_credits',
      'credit_payments',
      'credit_transactions',
      'client_balances',
      'client_balance_transactions',
      'notifications',
      'dynamic_notification_states',
      'bank_account_movements',
    ];

    for (const table of tables) {
      const columns = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = '${table}'
          AND table_schema = 'public'
          AND data_type = 'timestamp with time zone'
      `);

      if (columns.length === 0) continue;

      const alterClauses = columns
        .map(
          (col: { column_name: string }) =>
            `ALTER COLUMN "${col.column_name}" TYPE timestamp USING "${col.column_name}" AT TIME ZONE 'UTC'`,
        )
        .join(',\n        ');

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ${alterClauses}
      `);
    }

    console.log('✅ Todas las columnas timestamptz revertidas a timestamp');
  }
}
