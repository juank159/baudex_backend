import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer'; // 👈 CORRECCIÓN: Importar desde class-transformer
import { UserRole, UserStatus } from '../entities/user.entity';

export class UserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

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
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsEnum(
    [
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'createdAt',
      'updatedAt',
    ],
    {
      message: 'El campo de ordenamiento no es válido',
    },
  )
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
