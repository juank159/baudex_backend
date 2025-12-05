// src/credit-notes/dto/create-credit-note.dto.ts
import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditNoteType, CreditNoteReason } from '../entities/credit-note.entity';

/**
 * DTO para crear un item de nota de crédito
 */
export class CreateCreditNoteItemDto {
  @ApiPropertyOptional({
    description: 'ID del item de factura original (opcional pero recomendado)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  invoiceItemId?: string;

  @ApiPropertyOptional({
    description: 'ID del producto (si aplica)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({
    description: 'Descripción del item',
    example: 'Laptop Dell Inspiron 15',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Cantidad a acreditar',
    example: 2,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({
    description: 'Precio unitario',
    example: 1500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Unidad de medida',
    example: 'unidad',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Costo unitario (para restauración de inventario)',
    example: 1200000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de descuento',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Monto de descuento',
    example: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Notas sobre el item',
    example: 'Producto devuelto por defecto de fábrica',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO para crear una nota de crédito
 */
export class CreateCreditNoteDto {
  @ApiProperty({
    description: 'ID de la factura a acreditar',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({
    description: 'Tipo de nota de crédito',
    enum: CreditNoteType,
    example: CreditNoteType.PARTIAL,
  })
  @IsEnum(CreditNoteType)
  type: CreditNoteType;

  @ApiProperty({
    description: 'Razón de la nota de crédito',
    enum: CreditNoteReason,
    example: CreditNoteReason.RETURNED_GOODS,
  })
  @IsEnum(CreditNoteReason)
  reason: CreditNoteReason;

  @ApiPropertyOptional({
    description: 'Descripción adicional de la razón',
    example: 'El cliente devolvió los productos porque llegaron con defectos de fábrica',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonDescription?: string;

  @ApiProperty({
    description: 'Items a acreditar (requerido para tipo PARTIAL, opcional para FULL)',
    type: [CreateCreditNoteItemDto],
    example: [
      {
        invoiceItemId: '123e4567-e89b-12d3-a456-426614174002',
        productId: '123e4567-e89b-12d3-a456-426614174001',
        description: 'Laptop Dell Inspiron 15',
        quantity: 2,
        unitPrice: 1500000,
        unit: 'unidad',
        unitCost: 1200000,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteItemDto)
  items: CreateCreditNoteItemDto[];

  @ApiPropertyOptional({
    description: '¿Restaurar inventario al confirmar?',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  restoreInventory?: boolean;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Nota de crédito por devolución de mercancía defectuosa',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Términos y condiciones',
    example: 'El crédito será aplicado en la próxima compra',
  })
  @IsOptional()
  @IsString()
  terms?: string;
}
