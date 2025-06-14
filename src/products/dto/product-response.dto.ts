import { ProductStatus, ProductType } from '../entities/product.entity';
import { PriceType, PriceStatus } from '../entities/product-price.entity';

export class ProductPriceResponseDto {
  id: string;
  type: PriceType;
  name?: string;
  amount: number;
  currency: string;
  status: PriceStatus;
  discountPercentage: number;
  discountAmount?: number;
  minQuantity: number;
  finalAmount: number;
  formattedAmount: string;
  validFrom?: Date;
  validTo?: Date;
  notes?: string;
  isActive: boolean;
  isValidNow: boolean;
}

export class ProductResponseDto {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  type: ProductType;
  status: ProductStatus;
  stock: number;
  minStock: number;
  unit?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  images?: string[];
  metadata?: Record<string, any>;
  primaryImage?: string;
  isActive: boolean;
  isInStock: boolean;
  isLowStock: boolean;
  categoryId: string;
  createdById: string;
  prices?: ProductPriceResponseDto[];
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
