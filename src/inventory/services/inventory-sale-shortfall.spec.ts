import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

// Venta ya hecha con menos stock del que el servidor cree que hay: antes se
// rechazaba la factura entera y quedaba trabada en "sin sincronizar".
describe('InventoryService.registerSale con faltante de stock', () => {
  function setup(available: number) {
    const saved: any[] = [];
    const queryRunner: any = {
      manager: {
        create: (_: any, data: any) => ({ ...data }),
        save: async (e: any) => {
          saved.push(e);
          return { id: 'mov-1', ...e };
        },
        findOne: async () => null,
      },
    };
    const service: any = Object.create(InventoryService.prototype);
    service.logger = { warn: jest.fn(), log: jest.fn() };
    service.getAvailableStock = jest.fn(async () => available);
    service.getCurrentStock = jest.fn(async () => 0);
    service.calculateStockValue = jest.fn(async () => 0);
    service.generateMovementNumber = jest.fn(async () => 'MOV-1');
    service.updateProductStock = jest.fn(async () => undefined);
    service.consumeStockDynamic = jest.fn(async (_p: string, qty: number) => ({
      batches: [],
      totalQuantityConsumed: qty,
      totalCost: qty * 100,
      averageCost: 100,
    }));
    const sale = (allowShortfall?: boolean) =>
      service.registerSale(
        'prod-1', 50, 300, 'org-1', 'user-1', 'invoice_paid', 'inv-1',
        { invoiceNumber: 'INV-1' }, 'wh-1', 'item-1', queryRunner, allowShortfall,
      );
    return { service, saved, sale };
  }

  it('sin permiso sigue rechazando (venta en línea con validación)', async () => {
    const { sale, service } = setup(22);
    await expect(sale()).rejects.toBeInstanceOf(BadRequestException);
    expect(service.consumeStockDynamic).not.toHaveBeenCalled();
  });

  it('venta ya hecha: descuenta lo que hay y anota el faltante', async () => {
    const { sale, service, saved } = setup(22);
    const { movement } = await sale(true);
    expect(service.consumeStockDynamic).toHaveBeenCalledWith('prod-1', 22, 'org-1', expect.anything());
    expect(movement.quantity).toBe(-50);
    expect(movement.metadata).toEqual({ invoiceNumber: 'INV-1', stockShortfall: 28 });
    expect(movement.totalCost).toBe(5000);
    expect(saved).toHaveLength(1);
  });

  it('sin nada de stock no intenta consumir lotes', async () => {
    const { sale, service } = setup(0);
    const { movement } = await sale(true);
    expect(service.consumeStockDynamic).not.toHaveBeenCalled();
    expect(movement.metadata.stockShortfall).toBe(50);
  });

  it('con stock suficiente no cambia nada', async () => {
    const { sale, service } = setup(80);
    const { movement } = await sale(true);
    expect(service.consumeStockDynamic).toHaveBeenCalledWith('prod-1', 50, 'org-1', expect.anything());
    expect(movement.metadata).toEqual({ invoiceNumber: 'INV-1' });
  });
});
