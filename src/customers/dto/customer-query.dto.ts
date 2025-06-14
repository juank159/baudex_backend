import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerStatus, DocumentType } from '../entities/customer.entity';

export class CustomerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

  @IsOptional()
  @IsEnum(CustomerStatus, {
    message: 'El estado debe ser active, inactive o suspended',
  })
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(DocumentType, {
    message: 'El tipo de documento debe ser cc, nit, ce, passport u other',
  })
  documentType?: DocumentType;

  @IsOptional()
  @IsString({ message: 'La ciudad debe ser una cadena de texto' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'El estado debe ser una cadena de texto' })
  state?: string;

  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsEnum(
    [
      'firstName',
      'lastName',
      'companyName',
      'email',
      'documentNumber',
      'city',
      'status',
      'totalPurchases',
      'lastPurchaseAt',
      'createdAt',
      'updatedAt',
    ],
    {
      message: 'El campo de ordenamiento no es válido',
    },
  )
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
