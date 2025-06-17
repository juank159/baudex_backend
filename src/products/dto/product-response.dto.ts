// import { Expose, Type, Transform } from 'class-transformer';
// import { ProductStatus, ProductType } from '../entities/product.entity';
// import { PriceType, PriceStatus } from '../entities/product-price.entity';

// export class ProductPriceResponseDto {
//   @Expose()
//   id: string;

//   @Expose()
//   type: PriceType;

//   @Expose()
//   name?: string;

//   @Expose()
//   amount: number;

//   @Expose()
//   currency: string;

//   @Expose()
//   status: PriceStatus;

//   @Expose()
//   discountPercentage: number;

//   @Expose()
//   discountAmount?: number;

//   @Expose()
//   minQuantity: number;

//   @Expose()
//   finalAmount: number;

//   @Expose()
//   formattedAmount: string;

//   @Expose()
//   validFrom?: Date;

//   @Expose()
//   validTo?: Date;

//   @Expose()
//   notes?: string;

//   @Expose()
//   isActive: boolean;

//   @Expose()
//   isValidNow: boolean;
// }

// // ✅ CORREGIDO: UserResponseDto compatible
// export class UserResponseDto {
//   @Expose()
//   id: string;

//   @Expose()
//   firstName: string;

//   @Expose()
//   lastName: string;

//   @Expose()
//   email: string;

//   @Expose()
//   @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
//   fullName: string;

//   // ✅ AGREGADO: Propiedades que espera el sistema
//   @Expose()
//   @Transform(({ obj }) => obj.role === 'admin')
//   isAdmin: boolean;

//   @Expose()
//   @Transform(({ obj }) => obj.role === 'manager')
//   isManager: boolean;

//   @Expose()
//   @Transform(({ obj }) => obj.role === 'user')
//   isUser: boolean;

//   @Expose()
//   createdAt: Date;

//   @Expose()
//   updatedAt: Date;
// }

// // ✅ CORREGIDO: CategoryResponseDto simple
// export class CategoryResponseDto {
//   @Expose()
//   id: string;

//   @Expose()
//   name: string;

//   @Expose()
//   slug: string;

//   @Expose()
//   description?: string;

//   @Expose()
//   status: string;
// }

// export class ProductResponseDto {
//   @Expose()
//   id: string;

//   @Expose()
//   name: string;

//   @Expose()
//   description?: string;

//   @Expose()
//   sku: string;

//   @Expose()
//   barcode?: string;

//   @Expose()
//   type: ProductType;

//   @Expose()
//   status: ProductStatus;

//   @Expose()
//   stock: number;

//   @Expose()
//   minStock: number;

//   @Expose()
//   unit?: string;

//   @Expose()
//   weight?: number;

//   @Expose()
//   length?: number;

//   @Expose()
//   width?: number;

//   @Expose()
//   height?: number;

//   @Expose()
//   images?: string[];

//   @Expose()
//   metadata?: Record<string, any>;

//   // Getters expuestos
//   @Expose()
//   @Transform(({ obj }) =>
//     obj.images && obj.images.length > 0 ? obj.images[0] : null,
//   )
//   primaryImage?: string;

//   @Expose()
//   @Transform(({ obj }) => obj.status === ProductStatus.ACTIVE && !obj.deletedAt)
//   isActive: boolean;

//   @Expose()
//   @Transform(
//     ({ obj }) => obj.stock > 0 && obj.status !== ProductStatus.OUT_OF_STOCK,
//   )
//   isInStock: boolean;

//   @Expose()
//   @Transform(({ obj }) => obj.stock <= obj.minStock)
//   isLowStock: boolean;

//   // ✅ IMPORTANTE: IDs expuestos
//   @Expose()
//   categoryId: string;

//   @Expose()
//   createdById: string;

//   // Relaciones anidadas
//   @Expose()
//   @Type(() => ProductPriceResponseDto)
//   prices?: ProductPriceResponseDto[];

//   @Expose()
//   @Type(() => CategoryResponseDto)
//   category?: CategoryResponseDto;

//   @Expose()
//   @Type(() => UserResponseDto)
//   createdBy?: UserResponseDto;

//   @Expose()
//   createdAt: Date;

//   @Expose()
//   updatedAt: Date;
// }

// src/modules/products/dto/product-response.dto.ts - CORRECCIÓN FINAL
import { Expose, Type, Transform } from 'class-transformer';
import { ProductStatus, ProductType } from '../entities/product.entity';
import { PriceType, PriceStatus } from '../entities/product-price.entity';

export class ProductPriceResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: PriceType;

  @Expose()
  name?: string;

  @Expose()
  amount: number;

  @Expose()
  currency: string;

  @Expose()
  status: PriceStatus;

  @Expose()
  discountPercentage: number;

  @Expose()
  discountAmount?: number;

  @Expose()
  minQuantity: number;

  @Expose()
  finalAmount: number;

  @Expose()
  formattedAmount: string;

  @Expose()
  validFrom?: Date;

  @Expose()
  validTo?: Date;

  @Expose()
  notes?: string;

  @Expose()
  isActive: boolean;

  @Expose()
  isValidNow: boolean;
}

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullName: string;

  @Expose()
  @Transform(({ obj }) => obj.role === 'admin')
  isAdmin: boolean;

  @Expose()
  @Transform(({ obj }) => obj.role === 'manager')
  isManager: boolean;

  @Expose()
  @Transform(({ obj }) => obj.role === 'user')
  isUser: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class CategoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description?: string;

  @Expose()
  status: string;
}

export class ProductResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  sku: string;

  @Expose()
  barcode?: string;

  @Expose()
  type: ProductType;

  @Expose()
  status: ProductStatus;

  @Expose()
  stock: number;

  @Expose()
  minStock: number;

  @Expose()
  unit?: string;

  @Expose()
  weight?: number;

  @Expose()
  length?: number;

  @Expose()
  width?: number;

  @Expose()
  height?: number;

  @Expose()
  images?: string[];

  @Expose()
  metadata?: Record<string, any>;

  // Getters expuestos - ✅ CORRECCIÓN FINAL
  @Expose()
  @Transform(({ obj }) =>
    obj.images && obj.images.length > 0 ? obj.images[0] : null,
  )
  primaryImage?: string;

  @Expose()
  @Transform(({ obj }) => obj.status === ProductStatus.ACTIVE && !obj.deletedAt)
  isActive: boolean;

  @Expose()
  @Transform(
    ({ obj }) => obj.stock > 0 && obj.status !== ProductStatus.OUT_OF_STOCK,
  )
  isInStock: boolean;

  // ✅ SOLUCIÓN FINAL: Solo stock <= minStock (usando valores individuales de cada producto)
  @Expose()
  @Transform(({ obj }) => {
    // ✅ Convertir a números para comparación correcta
    const stock = Number(obj.stock) || 0;
    const minStock = Number(obj.minStock) || 0;
    const result = stock <= minStock;

    console.log(
      `🔍 DTO isLowStock para ${obj.name}: stock=${stock} (num), minStock=${minStock} (num), resultado=${result}`,
    );
    return result;
  })
  isLowStock: boolean;

  @Expose()
  categoryId: string;

  @Expose()
  createdById: string;

  @Expose()
  @Type(() => ProductPriceResponseDto)
  prices?: ProductPriceResponseDto[];

  @Expose()
  @Type(() => CategoryResponseDto)
  category?: CategoryResponseDto;

  @Expose()
  @Type(() => UserResponseDto)
  createdBy?: UserResponseDto;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
