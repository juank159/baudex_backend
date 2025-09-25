import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupplierStatus,
  SupplierDocumentType,
} from '../entities/supplier.entity';
import { IsUniqueSupplierDocument } from '../validators/unique-supplier-document.validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Nombre del proveedor', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ description: 'Código del proveedor', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({
    description: 'Tipo de documento',
    enum: SupplierDocumentType,
    example: SupplierDocumentType.NIT,
  })
  @IsNotEmpty({ message: 'Tipo de documento es requerido' })
  @IsEnum(SupplierDocumentType, {
    message: 'Tipo de documento debe ser uno de los valores permitidos',
  })
  documentType: SupplierDocumentType;

  @ApiProperty({ description: 'Número de documento', maxLength: 50 })
  @IsNotEmpty({ message: 'Número de documento es requerido' })
  @IsString()
  @MaxLength(50)
  @IsUniqueSupplierDocument({
    message: 'Ya existe un proveedor con este documento en la organización',
  })
  documentNumber: string;

  @ApiPropertyOptional({ description: 'Persona de contacto', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Email de contacto' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Móvil', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional({ description: 'Dirección' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Ciudad', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Estado/Provincia', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'País', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'Código postal', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Sitio web', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;

  @ApiPropertyOptional({
    description: 'Estado del proveedor',
    enum: SupplierStatus,
  })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({ description: 'Moneda', default: 'COP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Días de plazo de pago', default: 30 })
  @IsOptional()
  @IsNumber()
  paymentTermsDays?: number;

  @ApiPropertyOptional({ description: 'Límite de crédito', default: 0 })
  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento', default: 0 })
  @IsOptional()
  @IsNumber()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  metadata?: Record<string, any>;
}
