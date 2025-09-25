import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTablesSimple1735500000001
  implements MigrationInterface
{
  name = 'CreateInventoryTablesSimple1735500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la extensión uuid-ossp existe, si no, crearla
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. Tabla suppliers
    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "code" varchar(50),
        "document_type" varchar(20),
        "document_number" varchar(50),
        "contact_person" varchar(200),
        "email" varchar(100),
        "phone" varchar(20),
        "mobile" varchar(20),
        "address" text,
        "city" varchar(100),
        "state" varchar(100),
        "country" varchar(100),
        "postal_code" varchar(20),
        "website" varchar(100),
        "status" varchar DEFAULT 'active',
        "currency" varchar(3) DEFAULT 'COP',
        "payment_terms_days" int DEFAULT 30,
        "credit_limit" decimal(12,2) DEFAULT 0,
        "discount_percentage" decimal(5,2) DEFAULT 0,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 2. Tabla purchase_orders
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_number" varchar(50) UNIQUE NOT NULL,
        "order_date" timestamp DEFAULT CURRENT_TIMESTAMP,
        "expected_delivery_date" date,
        "actual_delivery_date" date,
        "status" varchar DEFAULT 'draft',
        "currency" varchar(3) DEFAULT 'COP',
        "subtotal" decimal(12,2) DEFAULT 0,
        "tax_percentage" decimal(5,2) DEFAULT 0,
        "tax_amount" decimal(12,2) DEFAULT 0,
        "discount_percentage" decimal(5,2) DEFAULT 0,
        "discount_amount" decimal(12,2) DEFAULT 0,
        "shipping_cost" decimal(12,2) DEFAULT 0,
        "total" decimal(12,2) DEFAULT 0,
        "notes" text,
        "terms" text,
        "supplier_reference" varchar(100),
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "approved_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 3. Tabla purchase_order_items
    await queryRunner.query(`
      CREATE TABLE "purchase_order_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "line_number" int NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "unit_cost" decimal(12,4) NOT NULL,
        "total_cost" decimal(12,2) NOT NULL,
        "received_quantity" decimal(10,2) DEFAULT 0,
        "pending_quantity" decimal(10,2) DEFAULT 0,
        "expected_date" date,
        "last_received_date" date,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "purchase_order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 4. Tabla inventory_batches
    await queryRunner.query(`
      CREATE TABLE "inventory_batches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "batch_number" varchar(50) UNIQUE NOT NULL,
        "purchase_date" timestamp NOT NULL,
        "expiration_date" date,
        "original_quantity" decimal(10,2) NOT NULL,
        "current_quantity" decimal(10,2) NOT NULL,
        "reserved_quantity" decimal(10,2) DEFAULT 0,
        "unit_cost" decimal(12,4) NOT NULL,
        "total_cost" decimal(12,2) NOT NULL,
        "remaining_value" decimal(12,2) NOT NULL,
        "status" varchar DEFAULT 'active',
        "supplier_lot_number" varchar(100),
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "purchase_order_id" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 5. Tabla inventory_movements
    await queryRunner.query(`
      CREATE TABLE "inventory_movements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "movement_number" varchar(50) UNIQUE NOT NULL,
        "type" varchar NOT NULL,
        "status" varchar DEFAULT 'pending',
        "movement_date" timestamp DEFAULT CURRENT_TIMESTAMP,
        "quantity" decimal(10,2) NOT NULL,
        "unit_cost" decimal(10,2) DEFAULT 0,
        "total_cost" decimal(12,2) DEFAULT 0,
        "unit_price" decimal(12,2),
        "total_price" decimal(12,2),
        "stock_after" decimal(10,2) NOT NULL,
        "stock_value_after" decimal(12,2) NOT NULL,
        "reference_type" varchar(100),
        "reference_number" varchar(100),
        "reference_id" uuid,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 6. Tabla inventory_batch_movements
    await queryRunner.query(`
      CREATE TABLE "inventory_batch_movements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar NOT NULL,
        "movement_date" timestamp DEFAULT CURRENT_TIMESTAMP,
        "quantity" decimal(10,2) NOT NULL,
        "unit_cost" decimal(12,4) NOT NULL,
        "total_cost" decimal(12,2) NOT NULL,
        "batch_quantity_after" decimal(10,2) NOT NULL,
        "batch_value_after" decimal(12,2) NOT NULL,
        "notes" text,
        "organization_id" uuid NOT NULL,
        "batch_id" uuid NOT NULL,
        "inventory_movement_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 7. Tabla product_purchase_history
    await queryRunner.query(`
      CREATE TABLE "product_purchase_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "purchase_date" timestamp NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "unit_cost" decimal(12,4) NOT NULL,
        "total_cost" decimal(12,2) NOT NULL,
        "currency" varchar(3) DEFAULT 'COP',
        "shipping_cost" decimal(12,2) DEFAULT 0,
        "tax_amount" decimal(12,2) DEFAULT 0,
        "discount_amount" decimal(12,2) DEFAULT 0,
        "final_unit_cost" decimal(12,4) NOT NULL,
        "supplier_lot_number" varchar(100),
        "expiration_date" date,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "purchase_order_id" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 8. Tabla sales
    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sale_number" varchar(50) UNIQUE NOT NULL,
        "sale_date" timestamp DEFAULT CURRENT_TIMESTAMP,
        "delivery_date" date,
        "status" varchar DEFAULT 'draft',
        "type" varchar DEFAULT 'regular',
        "payment_status" varchar DEFAULT 'pending',
        "currency" varchar(3) DEFAULT 'COP',
        "subtotal" decimal(12,2) DEFAULT 0,
        "tax_percentage" decimal(5,2) DEFAULT 0,
        "tax_amount" decimal(12,2) DEFAULT 0,
        "discount_percentage" decimal(5,2) DEFAULT 0,
        "discount_amount" decimal(12,2) DEFAULT 0,
        "shipping_cost" decimal(12,2) DEFAULT 0,
        "total" decimal(12,2) DEFAULT 0,
        "total_cost" decimal(12,2) DEFAULT 0,
        "gross_profit" decimal(12,2) DEFAULT 0,
        "profit_margin" decimal(5,2) DEFAULT 0,
        "notes" text,
        "delivery_instructions" text,
        "customer_reference" varchar(100),
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "confirmed_by_id" uuid,
        "confirmed_at" timestamp,
        "invoice_id" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // 9. Tabla sale_items
    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "line_number" int NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "unit_price" decimal(12,4) NOT NULL,
        "total_price" decimal(12,2) NOT NULL,
        "unit_cost" decimal(12,4) NOT NULL,
        "total_cost" decimal(12,2) NOT NULL,
        "discount_percentage" decimal(5,2) DEFAULT 0,
        "discount_amount" decimal(12,2) DEFAULT 0,
        "final_price" decimal(12,2) NOT NULL,
        "item_profit" decimal(12,2) NOT NULL,
        "profit_margin" decimal(5,2) NOT NULL,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "sale_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // Crear índices
    await queryRunner.query(
      `CREATE INDEX "IDX_suppliers_organization_id" ON "suppliers" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_suppliers_status" ON "suppliers" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_organization_id" ON "purchase_orders" ("organization_id", "order_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_supplier_id" ON "purchase_orders" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_batches_product_id" ON "inventory_batches" ("product_id", "purchase_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_product_id" ON "inventory_movements" ("product_id", "movement_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_organization_id" ON "sales" ("organization_id", "sale_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_customer_id" ON "sales" ("customer_id")`,
    );

    // Crear foreign keys
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD CONSTRAINT "FK_suppliers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_purchase_order_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_purchase_order_items_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_purchase_order_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batches" ADD CONSTRAINT "FK_inventory_batches_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batches" ADD CONSTRAINT "FK_inventory_batches_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batches" ADD CONSTRAINT "FK_inventory_batches_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batch_movements" ADD CONSTRAINT "FK_inventory_batch_movements_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batch_movements" ADD CONSTRAINT "FK_inventory_batch_movements_batch" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batch_movements" ADD CONSTRAINT "FK_inventory_batch_movements_movement" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_purchase_history" ADD CONSTRAINT "FK_product_purchase_history_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_purchase_history" ADD CONSTRAINT "FK_product_purchase_history_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_purchase_history" ADD CONSTRAINT "FK_product_purchase_history_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_purchase_history" ADD CONSTRAINT "FK_product_purchase_history_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "FK_sales_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "FK_sales_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "FK_sales_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "FK_sales_confirmed_by" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "FK_sales_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD CONSTRAINT "FK_sale_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD CONSTRAINT "FK_sale_items_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD CONSTRAINT "FK_sale_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_sale"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_confirmed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_organization"`,
    );

    // Eliminar tablas
    await queryRunner.query(`DROP TABLE "sale_items"`);
    await queryRunner.query(`DROP TABLE "sales"`);
    await queryRunner.query(`DROP TABLE "product_purchase_history"`);
    await queryRunner.query(`DROP TABLE "inventory_batch_movements"`);
    await queryRunner.query(`DROP TABLE "inventory_movements"`);
    await queryRunner.query(`DROP TABLE "inventory_batches"`);
    await queryRunner.query(`DROP TABLE "purchase_order_items"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
  }
}
