import { Exclude, Expose, Transform } from 'class-transformer';
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
  validFrom?: Date;

  @Expose()
  validTo?: Date;

  @Expose()
  discountPercentage: number;

  @Expose()
  discountAmount?: number;

  @Expose()
  minQuantity: number;

  @Expose()
  profitMargin?: number;

  @Expose()
  notes?: string;

  @Expose()
  productId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  deletedAt?: Date;

  @Expose()
  @Transform(({ obj }) => obj.status === PriceStatus.ACTIVE && !obj.deletedAt)
  isActive: boolean;

  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    const validFrom = obj.validFrom || new Date(0);
    const validTo = obj.validTo || new Date('2099-12-31');
    return now >= validFrom && now <= validTo;
  })
  isValidNow: boolean;

  @Expose()
  @Transform(({ obj }) => {
    if (obj.discountAmount) {
      return Math.max(0, obj.amount - obj.discountAmount);
    }
    if (obj.discountPercentage > 0) {
      return obj.amount * (1 - obj.discountPercentage / 100);
    }
    return obj.amount;
  })
  finalAmount: number;

  @Expose()
  @Transform(({ obj }) => {
    const finalAmount = obj.discountAmount
      ? Math.max(0, obj.amount - obj.discountAmount)
      : obj.discountPercentage > 0
        ? obj.amount * (1 - obj.discountPercentage / 100)
        : obj.amount;

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: obj.currency || 'COP',
    }).format(finalAmount);
  })
  formattedAmount: string;
}
