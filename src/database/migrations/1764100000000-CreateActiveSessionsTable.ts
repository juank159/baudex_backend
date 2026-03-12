import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActiveSessionsTable1764100000000
  implements MigrationInterface
{
  name = 'CreateActiveSessionsTable1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        jti VARCHAR(255) NOT NULL UNIQUE,
        device_info TEXT,
        ip_address VARCHAR(45),
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_active_sessions_jti ON active_sessions(jti)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_active_sessions_org_id ON active_sessions(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(user_id, is_active, expires_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS active_sessions`);
  }
}
