import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

export class CategoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  slug: string;

  @Expose()
  image?: string;

  @Expose()
  status: CategoryStatus;

  @Expose()
  sortOrder: number;

  @Expose()
  parentId?: string;

  @Expose()
  @Type(() => CategoryResponseDto)
  parent?: CategoryResponseDto;

  @Expose()
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  deletedAt?: Date;

  @Expose()
  @Transform(
    ({ obj }) => obj.status === CategoryStatus.ACTIVE && !obj.deletedAt,
  )
  isActive: boolean;

  @Expose()
  @Transform(({ obj }) => obj.children && obj.children.length > 0)
  isParent: boolean;

  @Expose()
  @Transform(({ obj }) => {
    let level = 0;
    let current = obj.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  })
  level: number;
}
