import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDynamicNotificationStatesTable1764300000000
  implements MigrationInterface
{
  name = 'CreateDynamicNotificationStatesTable1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dynamic_notification_states" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dynamic_notification_id" varchar(255) NOT NULL,
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dynamic_notification_states" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dynamic_notification_state" UNIQUE ("dynamic_notification_id", "user_id", "organization_id"),
        CONSTRAINT "FK_dynamic_notification_states_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dynamic_notification_states_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Índices para optimizar consultas
    await queryRunner.query(
      `CREATE INDEX "IDX_dynamic_notification_states_org_user" ON "dynamic_notification_states" ("organization_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dynamic_notification_states_user_read" ON "dynamic_notification_states" ("user_id", "is_read")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dynamic_notification_states_notification_id" ON "dynamic_notification_states" ("dynamic_notification_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dynamic_notification_states_org" ON "dynamic_notification_states" ("organization_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "dynamic_notification_states"`,
    );
  }
}
