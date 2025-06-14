import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  IsPhoneNumber,
} from 'class-validator';
import { CustomerStatus, DocumentType } from '../entities/customer.entity';

export class CreateCustomerDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  firstName: string;

  @IsString({ message: 'El apellido es requerido' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El apellido no puede exceder 100 caracteres' })
  lastName: string;

  @IsOptional()
  @IsString({ message: 'El nombre de la empresa debe ser una cadena' })
  @MaxLength(100, {
    message: 'El nombre de la empresa no puede exceder 100 caracteres',
  })
  companyName?: string;

  @IsEmail({}, { message: 'Debe ser un email válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  email: string;

  @IsOptional()
  @IsPhoneNumber('CO', {
    message: 'Debe ser un número de teléfono válido de Colombia',
  })
  phone?: string;

  @IsOptional()
  @IsPhoneNumber('CO', {
    message: 'Debe ser un número de móvil válido de Colombia',
  })
  mobile?: string;

  @IsEnum(DocumentType, {
    message: 'El tipo de documento debe ser cc, nit, ce, passport u other',
  })
  documentType: DocumentType;

  @IsString({ message: 'El número de documento es requerido' })
  @MinLength(3, {
    message: 'El número de documento debe tener al menos 3 caracteres',
  })
  @MaxLength(50, {
    message: 'El número de documento no puede exceder 50 caracteres',
  })
  documentNumber: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'La ciudad debe ser una cadena' })
  @MaxLength(100, { message: 'La ciudad no puede exceder 100 caracteres' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'El estado debe ser una cadena' })
  @MaxLength(100, { message: 'El estado no puede exceder 100 caracteres' })
  state?: string;

  @IsOptional()
  @IsString({ message: 'El código postal debe ser una cadena' })
  @MaxLength(20, { message: 'El código postal no puede exceder 20 caracteres' })
  zipCode?: string;

  @IsOptional()
  @IsString({ message: 'El país debe ser una cadena' })
  @MaxLength(100, { message: 'El país no puede exceder 100 caracteres' })
  country?: string = 'Colombia';

  @IsOptional()
  @IsEnum(CustomerStatus, {
    message: 'El estado debe ser active, inactive o suspended',
  })
  status?: CustomerStatus = CustomerStatus.ACTIVE;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El límite de crédito debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El límite de crédito debe ser mayor o igual a 0' })
  creditLimit?: number = 0;

  @IsOptional()
  @IsNumber({}, { message: 'Los términos de pago deben ser un número' })
  @Min(1, { message: 'Los términos de pago deben ser al menos 1 día' })
  paymentTerms?: number = 30;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de nacimiento debe ser una fecha válida' },
  )
  birthDate?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;

  @IsOptional()
  @IsObject({ message: 'Los metadatos deben ser un objeto' })
  metadata?: Record<string, any>;
}
