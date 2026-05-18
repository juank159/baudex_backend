import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trigger PostgreSQL que mantiene `organizations` sincronizado con
 * `subscriptions` automáticamente. Resuelve el bug de denormalización
 * histórico (algunos tenants tenían `organizations.subscriptionPlan='trial'`
 * mientras `subscriptions.plan='premium'`).
 *
 * Antes la sincronización era manual: cada service del backend que
 * modificaba una suscripción tenía que recordar tocar AMBAS tablas.
 * Cualquier omisión (UPDATE directo por SQL, migración antigua, fix
 * manual en producción, endpoint admin nuevo que se olvidó del doble
 * UPDATE) generaba drift permanente.
 *
 * Con este trigger, cualquier INSERT o UPDATE sobre `subscriptions`
 * propaga inmediatamente a `organizations` a nivel DB. Es imposible
 * que las dos tablas queden inconsistentes desde ahora — la garantía
 * vive en el motor, no en la disciplina del developer.
 *
 * IMPORTANTE — la migración NO modifica datos existentes. Solo crea
 * la función + trigger. Si quieres re-sincronizar los planes ya
 * existentes después, ejecuta un `UPDATE subscriptions SET id=id` que
 * disparará el trigger y propagará los valores actuales. El usuario
 * pidió explícitamente dejar los planes vigentes como están, así que
 * no hago ese touch automático aquí.
 */
export class AddSubscriptionSyncTrigger1778900000000
  implements MigrationInterface
{
  name = 'AddSubscriptionSyncTrigger1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Función que copia los campos relevantes de subscriptions →
    //    organizations. Sólo toca las 4 columnas de la denormalización
    //    de suscripción; `trialStartDate`/`trialEndDate` se preservan
    //    porque son histórico del trial original (cuando lo hubo).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_org_subscription_from_sub()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE organizations
        SET
          "subscriptionPlan" = NEW.plan,
          "subscriptionStatus" = NEW.status,
          "subscriptionStartDate" = NEW."startDate",
          "subscriptionEndDate" = NEW."endDate",
          updated_at = NOW()
        WHERE id = NEW."organizationId";
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2) Trigger: AFTER INSERT y AFTER UPDATE OF las 4 columnas que
    //    nos interesan. No usamos AFTER UPDATE genérico porque
    //    tocaría también `metadata` u otros cambios irrelevantes
    //    (más overhead innecesario).
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_sync_org_subscription ON subscriptions;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_sync_org_subscription
      AFTER INSERT OR UPDATE OF plan, status, "startDate", "endDate"
      ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION sync_org_subscription_from_sub();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_sync_org_subscription ON subscriptions;
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS sync_org_subscription_from_sub();
    `);
  }
}
