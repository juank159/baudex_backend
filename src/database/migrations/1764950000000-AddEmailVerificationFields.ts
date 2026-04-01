import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationFields1764950000000
  implements MigrationInterface
{
  name = 'AddEmailVerificationFields1764950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_email_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "email_verification_code" varchar(6),
      ADD COLUMN IF NOT EXISTS "email_verification_expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "password_reset_code" varchar(6),
      ADD COLUMN IF NOT EXISTS "password_reset_expires_at" timestamptz
    `);

    console.log(
      '✅ Added email verification and password reset fields to users',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "password_reset_expires_at",
      DROP COLUMN IF EXISTS "password_reset_code",
      DROP COLUMN IF EXISTS "email_verification_expires_at",
      DROP COLUMN IF EXISTS "email_verification_code",
      DROP COLUMN IF EXISTS "is_email_verified"
    `);
  }
}
