import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CloseCashRegisterDto {
  /**
   * Efectivo físico contado al cierre. Si difiere de lo esperado por
   * sistema, queda registrado como sobrante (positivo) o faltante
   * (negativo) en `closingDifference`.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @Min(0, { message: 'El monto contado no puede ser negativo' })
  closingActualAmount: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  closingNotes?: string;
}
