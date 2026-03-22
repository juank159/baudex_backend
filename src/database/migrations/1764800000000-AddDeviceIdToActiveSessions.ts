import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceIdToActiveSessions1764800000000
  implements MigrationInterface
{
  name = 'AddDeviceIdToActiveSessions1764800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna device_id para identificación única del dispositivo
    await queryRunner.query(`
      ALTER TABLE active_sessions
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(128)
    `);

    // Índice compuesto para búsqueda rápida por usuario+dispositivo
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_active_sessions_user_device
      ON active_sessions(user_id, device_id)
      WHERE is_active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_active_sessions_user_device`,
    );
    await queryRunner.query(`
      ALTER TABLE active_sessions DROP COLUMN IF EXISTS device_id
    `);
  }
}
