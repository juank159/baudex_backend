import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeSupplierDocumentFieldsRequired1734000000000
  implements MigrationInterface
{
  name = 'MakeSupplierDocumentFieldsRequired1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update existing NULL values to default values before making columns NOT NULL
    await queryRunner.query(`
      UPDATE suppliers 
      SET document_type = 'NIT', document_number = 'PENDIENTE'
      WHERE document_type IS NULL OR document_number IS NULL
    `);

    // Alter columns to be NOT NULL
    await queryRunner.query(`
      ALTER TABLE "suppliers" 
      ALTER COLUMN "document_type" SET NOT NULL,
      ALTER COLUMN "document_number" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert columns to be nullable
    await queryRunner.query(`
      ALTER TABLE "suppliers" 
      ALTER COLUMN "document_type" DROP NOT NULL,
      ALTER COLUMN "document_number" DROP NOT NULL
    `);
  }
}
