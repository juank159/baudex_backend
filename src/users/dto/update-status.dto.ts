import { IsEnum } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class UpdateStatusDto {
  @IsEnum(UserStatus, {
    message: 'El estado debe ser active, inactive o suspended',
  })
  status: UserStatus;
}
