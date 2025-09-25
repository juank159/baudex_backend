import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString({ message: 'La URL del avatar es requerida' })
  @IsUrl({}, { message: 'Debe ser una URL válida' })
  @MaxLength(500, { message: 'La URL no puede exceder 500 caracteres' })
  avatar: string;
}
