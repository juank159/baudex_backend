import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SendPurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Notas de envío' })
  @IsOptional()
  @IsString()
  notes?: string;
}
