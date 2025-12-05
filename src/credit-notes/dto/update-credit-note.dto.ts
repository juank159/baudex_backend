// src/credit-notes/dto/update-credit-note.dto.ts
import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditNoteReason } from '../entities/credit-note.entity';

/**
 * DTO para actualizar una nota de crédito
 *
 * Solo se pueden actualizar notas de crédito en estado DRAFT
 */
export class UpdateCreditNoteDto {
  @ApiPropertyOptional({
    description: 'Razón de la nota de crédito',
    enum: CreditNoteReason,
    example: CreditNoteReason.DAMAGED_GOODS,
  })
  @IsOptional()
  @IsEnum(CreditNoteReason)
  reason?: CreditNoteReason;

  @ApiPropertyOptional({
    description: 'Descripción adicional de la razón',
    example: 'Los productos llegaron dañados durante el transporte',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonDescription?: string;

  @ApiPropertyOptional({
    description: '¿Restaurar inventario al confirmar?',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  restoreInventory?: boolean;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Se acordó con el cliente aplicar el crédito en próxima compra',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Términos y condiciones',
    example: 'Crédito válido por 90 días',
  })
  @IsOptional()
  @IsString()
  terms?: string;
}
