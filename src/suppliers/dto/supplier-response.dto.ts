import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus } from '../entities/supplier.entity';
import { PurchaseOrder } from '../../inventory/entities/purchase-order.entity';
import { ProductPurchaseHistory } from '../../inventory/entities/product-purchase-history.entity';

export class SupplierResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  documentType?: string;

  @ApiPropertyOptional()
  documentNumber?: string;

  @ApiPropertyOptional()
  contactPerson?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  mobile?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  state?: string;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  website?: string;

  @ApiProperty({ enum: SupplierStatus })
  status: SupplierStatus;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  paymentTermsDays: number;

  @ApiProperty()
  creditLimit: number;

  @ApiProperty()
  discountPercentage: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  // Propiedades calculadas
  @ApiProperty()
  displayName: string;

  @ApiProperty()
  fullAddress: string;

  @ApiProperty()
  isActive: boolean;

  // Relaciones
  @ApiPropertyOptional({ type: () => [PurchaseOrder] })
  purchaseOrders?: PurchaseOrder[];

  @ApiPropertyOptional({ type: () => [ProductPurchaseHistory] })
  purchaseHistory?: ProductPurchaseHistory[];
}
