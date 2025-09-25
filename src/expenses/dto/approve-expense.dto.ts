import { IsOptional, IsString } from 'class-validator';

export class ApproveExpenseDto {
  @IsOptional()
  @IsString({ message: 'Las notas de aprobación deben ser una cadena' })
  notes?: string;
}
