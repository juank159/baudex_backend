import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsOptional()
  @IsString({ message: 'La razón del cambio debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  updateReason?: string;
}
