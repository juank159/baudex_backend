import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { User } from '../users/entities/user.entity';
import { InventoryService } from '../inventory/services/inventory.service';
import { RegisterProductWasteDto } from './dto/register-product-waste.dto';

/**
 * Endpoint dedicado para registrar mermas (desperdicios) de productos.
 * Crea un InventoryMovement tipo WASTE consumiendo del FIFO.
 */
@ApiTags('Productos - Merma')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('products/:productId/waste')
export class ProductWasteController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra una merma del producto (cantidad en unidad base)',
  })
  async register(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: RegisterProductWasteDto,
    @GetUser() user: User,
    @TenantId() tenantId: string,
  ) {
    const result = await this.inventoryService.registerWaste(
      productId,
      dto.quantity,
      dto.reason,
      tenantId,
      user.id,
      dto.warehouseId,
    );
    return {
      movementId: result.movement.id,
      movementNumber: result.movement.movementNumber,
      quantity: dto.quantity,
      totalCost: result.movement.totalCost,
      reason: dto.reason,
    };
  }
}
