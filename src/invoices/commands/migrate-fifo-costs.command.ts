import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InventoryService } from '../../inventory/services/inventory.service';

@Injectable()
@Command({
  name: 'migrate-fifo-costs',
  description: 'Migrar costos FIFO para facturas existentes que no los tienen',
})
export class MigrateFifoCostsCommand extends CommandRunner {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    private readonly inventoryService: InventoryService,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('🚀 === MIGRACIÓN FIFO COSTS ===');
    console.log('Buscando facturas sin costos FIFO...');

    // Buscar todas las facturas con items que no tienen totalCost calculado
    const invoicesWithoutFifo = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .where('item.totalCost = 0 OR item.totalCost IS NULL')
      .andWhere('item.productId IS NOT NULL') // Solo productos registrados
      .getMany();

    console.log(`📊 Encontradas ${invoicesWithoutFifo.length} facturas sin FIFO`);

    let processedItems = 0;
    let updatedItems = 0;

    for (const invoice of invoicesWithoutFifo) {
      console.log(`\n💰 Procesando factura ${invoice.number} (${invoice.items.length} items)`);
      
      for (const item of invoice.items) {
        processedItems++;
        
        // Solo procesar items con productos registrados y sin FIFO
        if (item.productId && (!item.totalCost || item.totalCost === 0)) {
          try {
            console.log(`  📦 Calculando FIFO para producto ${item.productId}: ${item.description}`);
            
            // Calcular costo FIFO
            const fifoCost = await this.inventoryService.calculateFifoCost(
              item.productId,
              item.quantity,
              invoice.organizationId,
            );

            // Actualizar el item con los costos FIFO
            await this.invoiceItemRepository.update(item.id, {
              unitCost: fifoCost.unitCost,
              totalCost: fifoCost.totalCost,
            });

            console.log(`    ✅ FIFO actualizado: Unitario=$${fifoCost.unitCost.toFixed(4)}, Total=$${fifoCost.totalCost.toFixed(2)}`);
            updatedItems++;
            
          } catch (error) {
            console.warn(`    ⚠️ No se pudo calcular FIFO para ${item.description}: ${error.message}`);
          }
        } else {
          console.log(`  ⏭️ Saltando item: ${item.description} (sin producto o ya tiene FIFO)`);
        }
      }
    }

    console.log('\n🎉 === MIGRACIÓN COMPLETADA ===');
    console.log(`📊 Items procesados: ${processedItems}`);
    console.log(`✅ Items actualizados: ${updatedItems}`);
    console.log(`⏭️ Items saltados: ${processedItems - updatedItems}`);
    
    if (updatedItems > 0) {
      console.log('\n🔄 ¡Ahora el dashboard debería mostrar costos FIFO correctos!');
    } else {
      console.log('\n💡 No se encontraron items para actualizar.');
    }
  }
}