import { IsString, MinLength } from 'class-validator';

export class RejectExpenseDto {
  @IsString({ message: 'La razón de rechazo es requerida' })
  @MinLength(5, {
    message: 'La razón de rechazo debe tener al menos 5 caracteres',
  })
  rejectionReason: string;
}
