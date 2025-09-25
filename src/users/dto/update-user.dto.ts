import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { UserRole, UserStatus } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El apellido no puede exceder 100 caracteres' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'La contraseña debe contener al menos una letra minúscula, una mayúscula y un número',
  })
  password?: string;

  @IsOptional()
  @IsPhoneNumber('CO', {
    message: 'Debe ser un número de teléfono válido de Colombia',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'El rol debe ser admin, manager o user',
  })
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'El estado debe ser active, inactive o suspended',
  })
  status?: UserStatus;

  @IsOptional()
  @IsString({ message: 'El avatar debe ser una URL válida' })
  @MaxLength(500, {
    message: 'La URL del avatar no puede exceder 500 caracteres',
  })
  avatar?: string;
}
