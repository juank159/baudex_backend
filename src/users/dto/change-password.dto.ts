import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @IsString({ message: 'La nueva contraseña es requerida' })
  @MinLength(6, {
    message: 'La nueva contraseña debe tener al menos 6 caracteres',
  })
  @MaxLength(50, {
    message: 'La nueva contraseña no puede exceder 50 caracteres',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'La nueva contraseña debe contener al menos una letra minúscula, una mayúscula y un número',
  })
  newPassword: string;

  @IsString({ message: 'La confirmación de contraseña es requerida' })
  confirmPassword: string;
}
