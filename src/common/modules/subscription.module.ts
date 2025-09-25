import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAwareService } from '../services/tenant-aware.service';
import { Organization } from '../../organizations/entities/organization.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [TenantAwareService],
  exports: [TenantAwareService],
})
export class SubscriptionModule {}
