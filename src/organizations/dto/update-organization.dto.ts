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
}
