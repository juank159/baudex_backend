import { Expose, Type } from 'class-transformer';

export class CategoryTreeDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  image?: string;

  @Expose()
  sortOrder: number;

  @Expose()
  @Type(() => CategoryTreeDto)
  children?: CategoryTreeDto[];

  @Expose()
  productsCount?: number;
}
