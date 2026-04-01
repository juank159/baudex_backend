import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceToExpenses1764960000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "reference" varchar(100) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "reference"`,
    );
  }
}
