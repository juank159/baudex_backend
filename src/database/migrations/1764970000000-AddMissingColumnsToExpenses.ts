import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingColumnsToExpenses1764970000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "tags" json DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "metadata" json DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "approvedById" uuid DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "approvedAt" timestamptz DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "rejectionReason" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "tags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "approvedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
  }
}
