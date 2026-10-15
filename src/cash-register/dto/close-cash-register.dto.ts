import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CloseCashRegisterDto {
  /**
   * Efectivo contado físicamente al cerrar.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @Min(0, { message: 'El monto contado no puede ser negativo' })
  closingActualAmount: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  closingNotes?: string;

  /**
   * Hora real del cierre en el equipo (cierre sin conexión). El resumen del
   * turno se calcula hasta esta hora, no hasta que llegó la petición.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de cierre no es válida' })
  closedAt?: string;
}
