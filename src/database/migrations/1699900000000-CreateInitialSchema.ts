import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1699900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. CREAR TABLA ORGANIZATIONS (base del multitenant, sin dependencias)
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "domain" varchar(255),
        "logo" text,
        "settings" jsonb DEFAULT '{}',
        "subscriptionPlan" varchar(50),
        "subscriptionStatus" varchar(50),
        "subscriptionStartDate" timestamp,
        "subscriptionEndDate" timestamp,
        "trialStartDate" timestamp,
        "trialEndDate" timestamp,
        "isActive" boolean DEFAULT true,
        "currency" varchar(10) DEFAULT 'USD',
        "locale" varchar(10) DEFAULT 'en',
        "timezone" varchar(50) DEFAULT 'America/New_York',
        "mainWarehouseId" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      );
      CREATE INDEX "IDX_organizations_slug" ON "organizations"("slug");
      CREATE INDEX "IDX_organizations_domain" ON "organizations"("domain");
    `);

    // 2. CREAR TABLA USERS (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "email" varchar(255) NOT NULL UNIQUE,
        "password" varchar(255) NOT NULL,
        "phone" varchar(20),
        "role" varchar(20) DEFAULT 'user',
        "status" varchar(20) DEFAULT 'active',
        "lastLoginAt" timestamp,
        "avatar" text,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_users_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_users_organization_id" ON "users"("organization_id");
    `);

    // 3. CREAR TABLA SUBSCRIPTIONS (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "plan" varchar(20) DEFAULT 'trial',
        "status" varchar(20) DEFAULT 'active',
        "type" varchar(20) DEFAULT 'trial',
        "startDate" timestamp NOT NULL,
        "endDate" timestamp NOT NULL,
        "cancelledAt" timestamp,
        "cancelReason" varchar(255),
        "price" decimal(10,2),
        "currency" varchar(10),
        "paymentMethod" varchar(255),
        "externalSubscriptionId" varchar(255),
        "metadata" jsonb,
        "maxUsers" int DEFAULT -1,
        "lastBillingDate" timestamp,
        "nextBillingDate" timestamp,
        "billingCycle" int DEFAULT 0,
        "autoRenew" boolean DEFAULT true,
        "trialEndsAt" timestamp,
        "isTrialUsed" boolean DEFAULT false,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_subscriptions_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_subscriptions_organizationId" ON "subscriptions"("organizationId");
      CREATE INDEX "IDX_subscriptions_organization_status" ON "subscriptions"("organizationId", "status");
      CREATE INDEX "IDX_subscriptions_plan_status" ON "subscriptions"("plan", "status");
      CREATE INDEX "IDX_subscriptions_endDate" ON "subscriptions"("endDate");
    `);

    // 4. CREAR TABLA WAREHOUSES (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "code" varchar(20) NOT NULL UNIQUE,
        "description" text,
        "address" text,
        "isActive" boolean DEFAULT true,
        "isMainWarehouse" boolean DEFAULT false,
        "organizationId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_warehouses_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_warehouses_organization_id" ON "warehouses"("organizationId");
    `);

    // 5. CREAR TABLA CATEGORIES (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "slug" varchar(50) NOT NULL,
        "image" text,
        "status" varchar(20) DEFAULT 'active',
        "sortOrder" int DEFAULT 0,
        "organization_id" uuid NOT NULL,
        "parent_id" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_categories_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_categories_organization_id" ON "categories"("organization_id");
      CREATE UNIQUE INDEX "UQ_categories_slug_organization_not_deleted" ON "categories"("slug", "organization_id") WHERE "deleted_at" IS NULL;
    `);

    // 6. CREAR TABLA PRODUCTS (depende de organizations, categories, users)
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "sku" varchar(50) NOT NULL UNIQUE,
        "barcode" varchar(20),
        "type" varchar(20) DEFAULT 'product',
        "status" varchar(20) DEFAULT 'active',
        "stock" decimal(10,2) DEFAULT 0,
        "minStock" decimal(10,2) DEFAULT 0,
        "cost" decimal(12,4) DEFAULT 0,
        "unit" varchar(50),
        "weight" decimal(10,2),
        "length" decimal(10,2),
        "width" decimal(10,2),
        "height" decimal(10,2),
        "images" text[],
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_products_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_products_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_products_organization_id" ON "products"("organization_id");
    `);

    // 7. CREAR TABLA PRODUCT_PRICES (depende de products)
    await queryRunner.query(`
      CREATE TABLE "product_prices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(20) NOT NULL,
        "name" varchar(100),
        "amount" decimal(12,2) NOT NULL,
        "currency" varchar(3) DEFAULT 'COP',
        "status" varchar(20) DEFAULT 'active',
        "validFrom" timestamp,
        "validTo" timestamp,
        "discountPercentage" decimal(5,2) DEFAULT 0,
        "discountAmount" decimal(12,2),
        "minQuantity" int DEFAULT 1,
        "profitMargin" decimal(5,2),
        "notes" text,
        "product_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_product_prices_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_product_prices_product_id" ON "product_prices"("product_id");
    `);

    // 8. CREAR TABLA CUSTOMERS (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "companyName" varchar(100),
        "email" varchar(255) NOT NULL,
        "phone" varchar(20),
        "mobile" varchar(20),
        "documentType" varchar(20) DEFAULT 'cc',
        "documentNumber" varchar(50) NOT NULL,
        "address" text,
        "city" varchar(100),
        "state" varchar(100),
        "zipCode" varchar(20),
        "country" varchar(100),
        "status" varchar(20) DEFAULT 'active',
        "organization_id" uuid NOT NULL,
        "creditLimit" decimal(12,2) DEFAULT 0,
        "currentBalance" decimal(12,2) DEFAULT 0,
        "paymentTerms" int DEFAULT 30,
        "birthDate" date,
        "notes" text,
        "metadata" json,
        "lastPurchaseAt" timestamp,
        "totalPurchases" decimal(12,2) DEFAULT 0,
        "totalOrders" int DEFAULT 0,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_customers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_customer_email_organization" UNIQUE ("email", "organization_id"),
        CONSTRAINT "UQ_customer_document_organization" UNIQUE ("documentType", "documentNumber", "organization_id")
      );
      CREATE INDEX "IDX_customers_organization_id" ON "customers"("organization_id");
    `);

    // 9. CREAR TABLA SUPPLIERS (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "code" varchar(50),
        "documentType" varchar(20) NOT NULL,
        "documentNumber" varchar(50) NOT NULL,
        "contactPerson" varchar(200),
        "email" varchar(100),
        "phone" varchar(20),
        "mobile" varchar(20),
        "address" text,
        "city" varchar(100),
        "state" varchar(100),
        "country" varchar(100),
        "postalCode" varchar(20),
        "website" varchar(100),
        "status" varchar(20) DEFAULT 'active',
        "currency" varchar(3) DEFAULT 'COP',
        "paymentTermsDays" int DEFAULT 30,
        "creditLimit" decimal(5,2) DEFAULT 0,
        "discountPercentage" decimal(5,2) DEFAULT 0,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_suppliers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_supplier_document_organization" UNIQUE ("documentType", "documentNumber", "organization_id")
      );
      CREATE INDEX "IDX_suppliers_organization_id" ON "suppliers"("organization_id");
    `);

    // 10. CREAR TABLA INVOICES (depende de organizations, customers, users)
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "number" varchar(50) NOT NULL UNIQUE,
        "date" date NOT NULL,
        "dueDate" date NOT NULL,
        "status" varchar(20) DEFAULT 'draft',
        "paymentMethod" varchar(20) DEFAULT 'cash',
        "subtotal" float DEFAULT 0,
        "taxPercentage" float DEFAULT 0,
        "taxAmount" float DEFAULT 0,
        "discountPercentage" float DEFAULT 0,
        "discountAmount" float DEFAULT 0,
        "total" float DEFAULT 0,
        "paidAmount" float DEFAULT 0,
        "balanceDue" float DEFAULT 0,
        "notes" text,
        "terms" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "createdById" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_invoices_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_invoices_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_invoices_organization_id" ON "invoices"("organization_id");
    `);

    // 11. CREAR TABLA TEMPORARY_PRODUCTS (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "temporary_products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "description" text,
        "category" varchar(100),
        "unitPrice" decimal(12,2) NOT NULL,
        "quantity" decimal(10,2) DEFAULT 1,
        "unit" varchar(50),
        "barcode" varchar(50),
        "sku" varchar(50),
        "notes" text,
        "status" varchar(20) DEFAULT 'pending',
        "organization_id" uuid NOT NULL,
        "createdById" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_temporary_products_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_temporary_products_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_temporary_products_organization_id" ON "temporary_products"("organization_id");
    `);

    // 12. CREAR TABLA INVOICE_ITEMS (depende de invoices, products, temporary_products)
    await queryRunner.query(`
      CREATE TABLE "invoice_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "description" varchar(200) NOT NULL,
        "quantity" float NOT NULL,
        "unitPrice" float NOT NULL,
        "discountPercentage" float DEFAULT 0,
        "discountAmount" float DEFAULT 0,
        "subtotal" float NOT NULL,
        "unit" varchar(20),
        "notes" text,
        "unitCost" decimal(12,4) DEFAULT 0,
        "totalCost" decimal(12,2) DEFAULT 0,
        "invoiceId" uuid,
        "productId" uuid,
        "temporaryProductId" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_invoice_items_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoice_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoice_items_temporary_product" FOREIGN KEY ("temporaryProductId") REFERENCES "temporary_products"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_invoice_items_invoice_id" ON "invoice_items"("invoiceId");
    `);

    // 13. CREAR TABLA SALES (depende de organizations, customers, users, invoices)
    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "saleNumber" varchar(50) NOT NULL UNIQUE,
        "saleDate" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deliveryDate" date,
        "status" varchar(20) DEFAULT 'draft',
        "type" varchar(20) DEFAULT 'regular',
        "paymentStatus" varchar(20) DEFAULT 'pending',
        "currency" varchar(3) DEFAULT 'COP',
        "subtotal" decimal(12,2) DEFAULT 0,
        "taxPercentage" decimal(5,2) DEFAULT 0,
        "taxAmount" decimal(12,2) DEFAULT 0,
        "discountPercentage" decimal(5,2) DEFAULT 0,
        "discountAmount" decimal(12,2) DEFAULT 0,
        "shippingCost" decimal(12,2) DEFAULT 0,
        "total" decimal(12,2) DEFAULT 0,
        "totalCost" decimal(12,2) DEFAULT 0,
        "grossProfit" decimal(12,2) DEFAULT 0,
        "profitMargin" decimal(5,2) DEFAULT 0,
        "notes" text,
        "deliveryInstructions" text,
        "customerReference" varchar(100),
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "createdById" uuid NOT NULL,
        "confirmedById" uuid,
        "confirmedAt" timestamp,
        "invoiceId" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_sales_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sales_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_sales_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_sales_confirmed_by" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_sales_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_sales_organization_id" ON "sales"("organization_id");
      CREATE INDEX "IDX_sales_saleDate" ON "sales"("saleDate");
      CREATE INDEX "IDX_sales_organization_saleDate" ON "sales"("organization_id", "saleDate");
      CREATE INDEX "IDX_sales_customer_status" ON "sales"("customerId", "status");
    `);

    // 14. CREAR TABLA SALE_ITEMS (depende de sales, products, organizations)
    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lineNumber" int NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "unitPrice" decimal(12,4) NOT NULL,
        "totalPrice" decimal(12,2) NOT NULL,
        "unitCost" decimal(12,4) NOT NULL,
        "totalCost" decimal(12,2) NOT NULL,
        "discountPercentage" decimal(5,2) DEFAULT 0,
        "discountAmount" decimal(12,2) DEFAULT 0,
        "finalPrice" decimal(12,2) NOT NULL,
        "itemProfit" decimal(12,2) NOT NULL,
        "profitMargin" decimal(5,2) NOT NULL,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "saleId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_sale_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sale_items_sale" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sale_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_sale_items_organization_id" ON "sale_items"("organization_id");
      CREATE INDEX "IDX_sale_items_saleId" ON "sale_items"("saleId");
      CREATE INDEX "IDX_sale_items_productId" ON "sale_items"("productId");
      CREATE INDEX "IDX_sale_items_sale_product" ON "sale_items"("saleId", "productId");
    `);

    // 15. CREAR TABLA EXPENSE_CATEGORIES (depende de organizations)
    await queryRunner.query(`
      CREATE TABLE "expense_categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "color" varchar(7),
        "status" varchar(20) DEFAULT 'active',
        "monthlyBudget" decimal(12,2) DEFAULT 0,
        "isRequired" boolean DEFAULT false,
        "sortOrder" int DEFAULT 0,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_expense_categories_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_expense_categories_organization_id" ON "expense_categories"("organization_id");
    `);

    // 16. CREAR TABLA EXPENSES (depende de organizations, expense_categories, users)
    await queryRunner.query(`
      CREATE TABLE "expenses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "amount" decimal(12,2) NOT NULL,
        "currency" varchar(3) DEFAULT 'COP',
        "date" date NOT NULL,
        "paymentMethod" varchar(50),
        "status" varchar(20) DEFAULT 'pending',
        "invoiceNumber" varchar(100),
        "vendor" varchar(255),
        "notes" text,
        "attachments" text[],
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "approvedById" uuid,
        "approvedAt" timestamp,
        "createdById" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_expenses_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_expenses_category" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_expenses_approved_by" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_expenses_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_expenses_organization_id" ON "expenses"("organization_id");
    `);

    // 17. CREAR TABLA PURCHASE_ORDERS (depende de organizations, suppliers, warehouses, users)
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "poNumber" varchar(50) NOT NULL UNIQUE,
        "date" timestamp DEFAULT CURRENT_TIMESTAMP,
        "expectedDeliveryDate" date,
        "actualDeliveryDate" date,
        "status" varchar(20) DEFAULT 'draft',
        "currency" varchar(3) DEFAULT 'COP',
        "subtotal" decimal(12,2) DEFAULT 0,
        "taxPercentage" decimal(5,2) DEFAULT 0,
        "taxAmount" decimal(12,2) DEFAULT 0,
        "shippingCost" decimal(12,2) DEFAULT 0,
        "total" decimal(12,2) DEFAULT 0,
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "supplierId" uuid NOT NULL,
        "warehouseId" uuid,
        "createdById" uuid NOT NULL,
        "approvedById" uuid,
        "approvedAt" timestamp,
        "receivedById" uuid,
        "receivedAt" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_purchase_orders_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_orders_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_purchase_orders_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_orders_approved_by" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_purchase_orders_received_by" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_purchase_orders_organization_id" ON "purchase_orders"("organization_id");
    `);

    // 18. CREAR TABLA PURCHASE_ORDER_ITEMS (depende de purchase_orders, products)
    await queryRunner.query(`
      CREATE TABLE "purchase_order_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lineNumber" int NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "receivedQuantity" decimal(10,2) DEFAULT 0,
        "unitCost" decimal(12,4) NOT NULL,
        "subtotal" decimal(12,2) NOT NULL,
        "taxPercentage" decimal(5,2) DEFAULT 0,
        "taxAmount" decimal(12,2) DEFAULT 0,
        "total" decimal(12,2) NOT NULL,
        "notes" text,
        "purchaseOrderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_purchase_order_items_po" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_order_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_purchase_order_items_po_id" ON "purchase_order_items"("purchaseOrderId");
    `);

    // 19. CREAR TABLA INVENTORY_BATCHES (depende de organizations, products, purchase_orders, warehouses)
    await queryRunner.query(`
      CREATE TABLE "inventory_batches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "batchNumber" varchar(100) NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "remainingQuantity" decimal(10,2) NOT NULL,
        "unitCost" decimal(12,4) NOT NULL,
        "expirationDate" date,
        "notes" text,
        "organization_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "purchaseOrderId" uuid,
        "warehouseId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_inventory_batches_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_batches_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_inventory_batches_po" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_inventory_batches_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_inventory_batches_organization_id" ON "inventory_batches"("organization_id");
      CREATE INDEX "IDX_inventory_batches_product_id" ON "inventory_batches"("productId");
    `);

    // 20. CREAR TABLA INVENTORY_MOVEMENTS (depende de organizations, products, warehouses, users)
    await queryRunner.query(`
      CREATE TABLE "inventory_movements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(20) NOT NULL,
        "quantity" decimal(10,2) NOT NULL,
        "unitCost" decimal(12,4),
        "totalCost" decimal(12,2),
        "notes" text,
        "metadata" json,
        "organization_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "warehouseId" uuid NOT NULL,
        "performedById" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_inventory_movements_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_movements_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_inventory_movements_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_inventory_movements_performed_by" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_inventory_movements_organization_id" ON "inventory_movements"("organization_id");
    `);

    // 21. CREAR TABLA INVENTORY_BATCH_MOVEMENTS (depende de inventory_batches, inventory_movements)
    await queryRunner.query(`
      CREATE TABLE "inventory_batch_movements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "quantity" decimal(10,2) NOT NULL,
        "batchId" uuid NOT NULL,
        "movementId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_inventory_batch_movements_batch" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_batch_movements_movement" FOREIGN KEY ("movementId") REFERENCES "inventory_movements"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_inventory_batch_movements_batch_id" ON "inventory_batch_movements"("batchId");
    `);

    // 22. CREAR TABLA PRODUCT_PURCHASE_HISTORY (depende de organizations, products, suppliers)
    await queryRunner.query(`
      CREATE TABLE "product_purchase_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "quantity" decimal(10,2) NOT NULL,
        "unitCost" decimal(12,4) NOT NULL,
        "totalCost" decimal(12,2) NOT NULL,
        "purchaseDate" date NOT NULL,
        "notes" text,
        "organization_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "supplierId" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_product_purchase_history_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_purchase_history_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_purchase_history_supplier" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_product_purchase_history_organization_id" ON "product_purchase_history"("organization_id");
    `);

    // 23. CREAR TABLA PAYMENTS (depende de invoices, organizations)
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "paymentNumber" varchar(50) NOT NULL UNIQUE,
        "amount" decimal(12,2) NOT NULL,
        "paymentDate" date NOT NULL,
        "paymentMethod" varchar(50) NOT NULL,
        "status" varchar(20) DEFAULT 'completed',
        "reference" varchar(255),
        "notes" text,
        "metadata" json,
        "invoiceId" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_payments_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_payments_invoice_id" ON "payments"("invoiceId");
      CREATE INDEX "IDX_payments_organization_id" ON "payments"("organization_id");
    `);

    // 24. CREAR TABLA USER_PREFERENCES (depende de users)
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "theme" varchar(20) DEFAULT 'light',
        "language" varchar(10) DEFAULT 'es',
        "timezone" varchar(50) DEFAULT 'America/Bogota',
        "dateFormat" varchar(20) DEFAULT 'DD/MM/YYYY',
        "currency" varchar(3) DEFAULT 'COP',
        "notifications" jsonb DEFAULT '{}',
        "dashboardLayout" jsonb DEFAULT '{}',
        "userId" uuid NOT NULL UNIQUE,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp,
        CONSTRAINT "FK_user_preferences_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_user_preferences_user_id" ON "user_preferences"("userId");
    `);

    console.log('Initial schema created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar tablas en orden inverso (respetando foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_purchase_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_batch_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_batches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "temporary_products" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_prices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouses" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);

    console.log('Initial schema dropped successfully');
  }
}
