import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCategorySlugUniqueConstraint1754105970000
  implements MigrationInterface
{
  name = 'FixCategorySlugUniqueConstraint1754105970000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el índice único global anterior
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_categories_slug_not_deleted"`,
    );

    // Crear el nuevo índice único por organización y slug (excluyendo soft-deleted)
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_categories_slug_organization_not_deleted" 
            ON "categories" ("slug", "organization_id") 
            WHERE "deleted_at" IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el nuevo índice
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_categories_slug_organization_not_deleted"`,
    );

    // Restaurar el índice único global anterior (solo si no hay conflictos)
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_categories_slug_not_deleted" 
            ON "categories" ("slug") 
            WHERE "deleted_at" IS NULL
        `);
  }
}
