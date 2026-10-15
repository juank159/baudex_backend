import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class OpenCashRegisterDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El saldo inicial debe ser numérico' })
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  openingAmount: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  openingNotes?: string;

  /**
   * ID generado por la app. Permite abrir la caja sin conexión: al
   * sincronizar se crea con este mismo ID, y si la petición se repite se
   * devuelve la caja ya creada en vez de duplicarla.
   */
  @IsOptional()
  @IsUUID('4', { message: 'El id de la caja no es válido' })
  id?: string;

  /** Hora real de apertura en el equipo (apertura sin conexión). */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de apertura no es válida' })
  openedAt?: string;
}
