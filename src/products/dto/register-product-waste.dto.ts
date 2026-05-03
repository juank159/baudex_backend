import { IsNumber, IsString, IsOptional, IsUUID, MinLength, Min } from 'class-validator';

/**
 * DTO para registrar una merma (desperdicio) de un producto.
 *
 * `quantity` se interpreta en la **unidad base** del producto (gramos para
 * queso, unidades para huevos). El frontend, si vendió/compró en otra
 * presentación, debe convertir antes de enviar.
 */
export class RegisterProductWasteDto {
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser un número' })
  @Min(0.0001, { message: 'La cantidad debe ser mayor a 0' })
  quantity: number;

  @IsString({ message: 'La razón debe ser texto' })
  @MinLength(3, { message: 'La razón debe tener al menos 3 caracteres' })
  reason: string;

  @IsOptional()
  @IsUUID('4', { message: 'warehouseId debe ser UUID válido' })
  warehouseId?: string;
}
