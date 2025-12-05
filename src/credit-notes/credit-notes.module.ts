// src/credit-notes/credit-notes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNote } from './entities/credit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CreditNotesService } from './services/credit-notes.service';
import { CreditNotePdfService } from './services/credit-note-pdf.service';
import { CreditNotesController } from './credit-notes.controller';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

/**
 * Módulo de Notas de Crédito
 *
 * Gestiona toda la funcionalidad relacionada con notas de crédito:
 * - Creación y validación
 * - Aplicación de créditos
 * - Restauración de inventario
 * - Consultas y reportes
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CreditNote, CreditNoteItem, Invoice]),
    CustomersModule, // Para actualizar balance del cliente
    InventoryModule, // Para restaurar inventario
    OrganizationsModule, // Para obtener datos de organización en PDF
    WarehousesModule, // Para obtener almacén principal
  ],
  controllers: [CreditNotesController],
  providers: [CreditNotesService, CreditNotePdfService, TenantAwareService],
  exports: [CreditNotesService, CreditNotePdfService],
})
export class CreditNotesModule {}
