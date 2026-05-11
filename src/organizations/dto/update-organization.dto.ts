import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, [
    'slug',
    'adminEmail',
    'adminPassword',
    'adminFirstName',
    'adminLastName',
  ] as const),
) {
  @ApiPropertyOptional({
    description: 'Estado activo de la organización',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Habilitar/deshabilitar soporte multi-moneda',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  multiCurrencyEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Habilitar/deshabilitar el módulo de caja registradora para el tenant. ' +
      'Cuando es false, los flujos de apertura/cierre de caja, validaciones ' +
      'previas a facturación y la opción "Caja del día" en gastos quedan ' +
      'desactivados para esta organización. Default: true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  cashRegisterEnabled?: boolean;
}
