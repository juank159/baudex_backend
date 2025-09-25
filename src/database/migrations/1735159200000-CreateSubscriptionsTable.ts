import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreateSubscriptionsTable1735159200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla subscriptions
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'plan',
            type: 'enum',
            enum: ['trial', 'basic', 'premium', 'enterprise'],
            default: "'trial'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'expired', 'cancelled', 'suspended', 'pending'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['trial', 'monthly', 'yearly', 'lifetime'],
            default: "'trial'",
            isNullable: false,
          },
          {
            name: 'startDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'endDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'cancelledAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelReason',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'paymentMethod',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'externalSubscriptionId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'maxUsers',
            type: 'int',
            default: -1,
            isNullable: false,
          },
          {
            name: 'lastBillingDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'nextBillingDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'billingCycle',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'autoRenew',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'trialEndsAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isTrialUsed',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Crear índices para optimizar consultas
    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_organization_status" ON "subscriptions" ("organizationId", "status");
      CREATE INDEX "IDX_subscriptions_plan_status" ON "subscriptions" ("plan", "status");
      CREATE INDEX "IDX_subscriptions_end_date" ON "subscriptions" ("endDate");
      CREATE INDEX "IDX_subscriptions_organization_id" ON "subscriptions" ("organizationId");
      CREATE INDEX "IDX_subscriptions_status" ON "subscriptions" ("status");
      CREATE INDEX "IDX_subscriptions_next_billing_date" ON "subscriptions" ("nextBillingDate");
    `);

    // Crear foreign key con organizations
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD CONSTRAINT "FK_subscriptions_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE;
    `);

    // Migrar datos existentes de organizations a subscriptions
    await queryRunner.query(`
      INSERT INTO subscriptions (
        "organizationId",
        "plan",
        "status", 
        "type",
        "startDate",
        "endDate",
        "trialEndsAt",
        "maxUsers",
        "autoRenew",
        "isTrialUsed",
        "createdAt",
        "updatedAt"
      )
      SELECT 
        o."id" as "organizationId",
        COALESCE(o."subscriptionPlan", 'trial')::text as "plan",
        CASE 
          WHEN o."subscriptionStatus" IS NULL THEN 'active'
          ELSE o."subscriptionStatus"::text
        END as "status",
        'trial' as "type",
        COALESCE(o."trialStartDate", o."createdAt") as "startDate",
        COALESCE(o."trialEndDate", o."createdAt" + INTERVAL '30 days') as "endDate",
        COALESCE(o."trialEndDate", o."createdAt" + INTERVAL '30 days') as "trialEndsAt",
        CASE 
          WHEN COALESCE(o."subscriptionPlan", 'trial') = 'trial' THEN 2
          WHEN COALESCE(o."subscriptionPlan", 'trial') = 'basic' THEN 5
          WHEN COALESCE(o."subscriptionPlan", 'trial') = 'premium' THEN 15
          WHEN COALESCE(o."subscriptionPlan", 'trial') = 'enterprise' THEN -1
          ELSE 2
        END as "maxUsers",
        false as "autoRenew",
        true as "isTrialUsed",
        o."createdAt",
        o."updatedAt"
      FROM organizations o
      WHERE o."deletedAt" IS NULL;
    `);

    console.log('✅ Tabla subscriptions creada y datos migrados exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign key
    await queryRunner.query(
      'ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_organization"',
    );

    // Eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_subscriptions_organization_status";
      DROP INDEX IF EXISTS "IDX_subscriptions_plan_status";
      DROP INDEX IF EXISTS "IDX_subscriptions_end_date";
      DROP INDEX IF EXISTS "IDX_subscriptions_organization_id";
      DROP INDEX IF EXISTS "IDX_subscriptions_status";
      DROP INDEX IF EXISTS "IDX_subscriptions_next_billing_date";
    `);

    // Eliminar tabla
    await queryRunner.dropTable('subscriptions');

    console.log('❌ Tabla subscriptions eliminada');
  }
}
