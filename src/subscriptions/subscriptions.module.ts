import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionExpirationService } from './services/subscription-expiration.service';
import { SubscriptionRenewalService } from './services/subscription-renewal.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionAdminController } from './controllers/subscription-admin.controller';
import { Subscription } from './entities/subscription.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Organization]),
  ],
  controllers: [
    SubscriptionsController,
    SubscriptionAdminController,
  ],
  providers: [
    SubscriptionService,
    SubscriptionExpirationService,
    SubscriptionRenewalService,
  ],
  exports: [
    SubscriptionService,
    SubscriptionExpirationService,
    SubscriptionRenewalService,
  ],
})
export class SubscriptionsModule {}