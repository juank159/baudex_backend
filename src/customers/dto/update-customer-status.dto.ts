import { IsEnum } from 'class-validator';
import { CustomerStatus } from '../entities/customer.entity';

export class UpdateCustomerStatusDto {
  @IsEnum(CustomerStatus, {
    message: 'El estado debe ser active, inactive o suspended',
  })
  status: CustomerStatus;
}
