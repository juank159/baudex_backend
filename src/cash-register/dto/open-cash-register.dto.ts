import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class OpenCashRegisterDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El saldo inicial debe ser numérico' })
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  openingAmount: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  openingNotes?: string;
}
