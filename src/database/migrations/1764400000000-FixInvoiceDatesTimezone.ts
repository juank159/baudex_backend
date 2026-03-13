import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInvoiceDatesTimezone1764400000000
  implements MigrationInterface
{
  name = 'FixInvoiceDatesTimezone1764400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Corregir invoice.date: recalcular desde created_at usando timezone de la organización
    // Antes, el backend guardaba new Date() (UTC) en una columna "date" (tipo date),
    // lo que causaba que facturas creadas en horario nocturno (ej: 8pm Colombia = 1am UTC+1 día)
    // se guardaran con la fecha del día siguiente.
    //
    // Fix: (created_at AT TIME ZONE org.timezone)::date = fecha real del negocio
    await queryRunner.query(`
      UPDATE invoices i
      SET date = (i.created_at AT TIME ZONE COALESCE(o.timezone, 'America/New_York'))::date
      FROM organizations o
      WHERE i.organization_id = o.id
        AND i.deleted_at IS NULL
        AND i.date != (i.created_at AT TIME ZONE COALESCE(o.timezone, 'America/New_York'))::date
    `);

    // Corregir due_date para facturas de pago inmediato (cash, card, transfer)
    // donde due_date debería ser = date (mismo día, no día siguiente en UTC)
    // Solo corregir cuando due_date original == date original (ambas estaban mal por 1 día)
    await queryRunner.query(`
      UPDATE invoices i
      SET due_date = (i.created_at AT TIME ZONE COALESCE(o.timezone, 'America/New_York'))::date
      FROM organizations o
      WHERE i.organization_id = o.id
        AND i.deleted_at IS NULL
        AND i.payment_method IN ('cash', 'credit_card', 'debit_card', 'bank_transfer')
        AND i.due_date != (i.created_at AT TIME ZONE COALESCE(o.timezone, 'America/New_York'))::date
    `);

    console.log('✅ Migración: Fechas de facturas corregidas con timezone de organización');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No se puede revertir: las fechas UTC originales eran incorrectas
    // Las fechas corregidas son las correctas
    console.log('⚠️ down() no revierte: las fechas corregidas son las correctas');
  }
}
