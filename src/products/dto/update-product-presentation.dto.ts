import { PartialType } from '@nestjs/mapped-types';
import { CreateProductPresentationDto } from './create-product-presentation.dto';

export class UpdateProductPresentationDto extends PartialType(
  CreateProductPresentationDto,
) {}
