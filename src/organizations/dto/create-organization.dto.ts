import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsUrl, IsObject, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan } from '../entities/organization.entity';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Nombre de la organización',
    example: 'Mi Empresa S.A.',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Slug único de la organización (usado para subdominios)',
    example: 'mi-empresa',
    minLength: 2,
    maxLength: 100,
    pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones, sin empezar o terminar con guión',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Dominio personalizado opcional',
    example: 'facturacion.miempresa.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional({
    description: 'URL del logo de la organización',
    example: 'https://miempresa.com/logo.png',
  })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Plan de suscripción',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.BASIC,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Moneda por defecto',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Idioma por defecto',
    example: 'es',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({
    description: 'Zona horaria',
    example: 'America/Mexico_City',
    default: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Configuraciones adicionales de la organización',
    example: { 
      companyAddress: 'Calle 123, Ciudad',
      taxId: 'RFC123456789',
      phone: '+1234567890' 
    },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  // Información del usuario administrador inicial
  @ApiProperty({
    description: 'Email del administrador inicial',
    example: 'admin@miempresa.com',
  })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({
    description: 'Contraseña del administrador inicial',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword: string;

  @ApiProperty({
    description: 'Nombre del administrador inicial',
    example: 'Juan',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  adminFirstName: string;

  @ApiProperty({
    description: 'Apellido del administrador inicial',
    example: 'Pérez',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  adminLastName: string;
}