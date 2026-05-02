import { Exclude, Expose } from 'class-transformer';

export class ProductPresentationResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  factor: number;

  @Expose()
  price: number;

  @Expose()
  currency: string;

  @Expose()
  barcode?: string;

  @Expose()
  sku?: string;

  @Expose()
  isDefault: boolean;

  @Expose()
  isActive: boolean;

  @Expose()
  sortOrder: number;

  @Expose()
  productId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  deletedAt?: Date;
}
