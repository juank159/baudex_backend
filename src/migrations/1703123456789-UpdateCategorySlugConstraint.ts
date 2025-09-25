import { MigrationInterface, QueryRunner } from 'typeorm';

// IMPORTANTE: También actualiza tu entidad Category
// Agregar este decorador ANTES de @Entity('categories'):
// @Index('UQ_categories_slug_not_deleted', ['slug'], {
//   unique: true,
//   where: 'deleted_at IS NULL'
// })

// Y cambiar la línea del slug de:
// @Column({ type: 'varchar', length: 50, unique: true })
// A:
// @Column({ type: 'varchar', length: 50 })

export class UpdateCategorySlugConstraint1703123456789
  implements MigrationInterface
{
  name = 'UpdateCategorySlugConstraint1703123456789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Verificar si existe el constraint UQ_420d9f679d41281f282f5bc7d09
    const constraintExists = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'categories' 
            AND constraint_name = 'UQ_420d9f679d41281f282f5bc7d09'
            AND constraint_type = 'UNIQUE'
        `);

    // 2. Si existe, eliminarlo
    if (constraintExists.length > 0) {
      await queryRunner.query(`
                ALTER TABLE "categories" 
                DROP CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09"
            `);
    }

    // 3. Verificar si existe algún otro constraint único en la columna slug
    const slugConstraints = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'categories' 
            AND kcu.column_name = 'slug'
            AND tc.constraint_type = 'UNIQUE'
        `);

    // 4. Eliminar cualquier constraint único existente en slug
    for (const constraint of slugConstraints) {
      await queryRunner.query(`
                ALTER TABLE "categories" 
                DROP CONSTRAINT "${constraint.constraint_name}"
            `);
    }

    // 5. Crear el nuevo índice único parcial
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_categories_slug_not_deleted" 
            ON "categories" ("slug") 
            WHERE "deleted_at" IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar el índice único parcial
    await queryRunner.query(`
            DROP INDEX IF EXISTS "UQ_categories_slug_not_deleted"
        `);

    // 2. Restaurar el constraint único original
    await queryRunner.query(`
            ALTER TABLE "categories" 
            ADD CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" 
            UNIQUE ("slug")
        `);
  }
}
