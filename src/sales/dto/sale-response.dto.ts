import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaleStatus, SaleType, PaymentStatus } from '../entities/sale.entity';

export class SaleItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  lineNumber: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  unitCost: number;

  @ApiProperty()
  totalCost: number;

  @ApiProperty()
  discountPercentage: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  finalPrice: number;

  @ApiProperty()
  itemProfit: number;

  @ApiProperty()
  profitMargin: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  product: {
    id: string;
    name: string;
    sku: string;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SaleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  saleNumber: string;

  @ApiProperty()
  saleDate: Date;

  @ApiPropertyOptional()
  deliveryDate?: Date;

  @ApiProperty({ enum: SaleStatus })
  status: SaleStatus;

  @ApiProperty({ enum: SaleType })
  type: SaleType;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  taxPercentage: number;

  @ApiProperty()
  taxAmount: number;

  @ApiProperty()
  discountPercentage: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  shippingCost: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalCost: number;

  @ApiProperty()
  grossProfit: number;

  @ApiProperty()
  profitMargin: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  deliveryInstructions?: string;

  @ApiPropertyOptional()
  customerReference?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdBy: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  confirmedById?: string;

  @ApiPropertyOptional()
  confirmedBy?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  confirmedAt?: Date;

  @ApiPropertyOptional()
  invoiceId?: string;

  @ApiProperty({ type: [SaleItemResponseDto] })
  items: SaleItemResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  // Propiedades calculadas
  @ApiProperty()
  isEditable: boolean;

  @ApiProperty()
  canBeInvoiced: boolean;

  @ApiProperty()
  isCompleted: boolean;

  @ApiProperty()
  totalQuantity: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  averageItemValue: number;

  @ApiProperty()
  profitMarginPercentage: number;
}
