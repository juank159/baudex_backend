import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum SubscriptionPlan {
  TRIAL = 'trial',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum SubscriptionType {
  TRIAL = 'trial',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

@Entity('subscriptions')
@Index(['organizationId', 'status'])
@Index(['plan', 'status'])
@Index(['endDate'])
export class Subscription extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.subscriptions)
  organization: Organization;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.TRIAL,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionType,
    default: SubscriptionType.TRIAL,
  })
  type: SubscriptionType;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSubscriptionId?: string; // ID de Stripe, PayPal, etc.

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'int', default: -1 })
  maxUsers: number; // -1 = unlimited

  @Column({ type: 'timestamptz', nullable: true })
  lastBillingDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextBillingDate?: Date;

  @Column({ type: 'int', default: 0 })
  billingCycle: number; // 0 = one-time, 1 = monthly, 12 = yearly

  @Column({ type: 'boolean', default: true })
  autoRenew: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt?: Date;

  @Column({ type: 'boolean', default: false })
  isTrialUsed: boolean;

  // Computed properties
  get isActive(): boolean {
    return (
      this.status === SubscriptionStatus.ACTIVE && this.endDate > new Date()
    );
  }

  get isExpired(): boolean {
    return this.endDate < new Date();
  }

  get isTrial(): boolean {
    return this.plan === SubscriptionPlan.TRIAL;
  }

  get daysUntilExpiration(): number {
    const now = new Date();
    const diffTime = this.endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  get subscriptionProgress(): number {
    const now = new Date();
    const totalDays = this.endDate.getTime() - this.startDate.getTime();
    const elapsedDays = now.getTime() - this.startDate.getTime();

    if (totalDays <= 0) return 1.0;
    return Math.min(Math.max(elapsedDays / totalDays, 0), 1);
  }

  get remainingDays(): number {
    return this.daysUntilExpiration;
  }

  // Business logic methods
  canPerformAction(action: string): boolean {
    // ❌ Si la suscripción no está activa, bloquear TODAS las acciones CRUD
    if (!this.isActive) {
      const restrictedActions = [
        'create_product',
        'update_product',
        'delete_product',
        'create_customer',
        'update_customer',
        'delete_customer',
        'create_invoice',
        'update_invoice',
        'delete_invoice',
        'create_expense',
        'update_expense',
        'delete_expense',
        'create_category',
        'update_category',
        'delete_category',
        'update_organization',
        'create_user',
        'update_user',
        'delete_user',
      ];

      return !restrictedActions.includes(action);
    }

    // ✅ Si la suscripción está ACTIVA, permitir TODAS las acciones CRUD
    // (según solicitud del usuario: solo limitación de usuarios)
    return true;
  }

  checkUserLimit(currentUserCount: number): boolean {
    if (this.maxUsers === -1) return true; // Unlimited
    return currentUserCount < this.maxUsers;
  }

  activate(): void {
    this.status = SubscriptionStatus.ACTIVE;
  }

  suspend(reason?: string): void {
    this.status = SubscriptionStatus.SUSPENDED;
    if (reason) {
      this.cancelReason = reason;
    }
  }

  cancel(reason?: string): void {
    this.status = SubscriptionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.autoRenew = false;
    if (reason) {
      this.cancelReason = reason;
    }
  }

  expire(): void {
    this.status = SubscriptionStatus.EXPIRED;
    this.autoRenew = false;
  }

  renew(endDate: Date, price?: number): void {
    this.status = SubscriptionStatus.ACTIVE;
    this.endDate = endDate;
    this.lastBillingDate = new Date();

    if (this.billingCycle > 0) {
      const nextBilling = new Date(this.lastBillingDate);
      nextBilling.setMonth(nextBilling.getMonth() + this.billingCycle);
      this.nextBillingDate = nextBilling;
    }

    if (price !== undefined) {
      this.price = price;
    }
  }

  upgrade(newPlan: SubscriptionPlan, newPrice?: number): void {
    this.plan = newPlan;
    this.updateMaxUsers();

    if (newPrice !== undefined) {
      this.price = newPrice;
    }
  }

  private updateMaxUsers(): void {
    const limits = {
      [SubscriptionPlan.TRIAL]: 2,
      [SubscriptionPlan.BASIC]: 5,
      [SubscriptionPlan.PREMIUM]: 15,
      [SubscriptionPlan.ENTERPRISE]: -1, // Unlimited
    };

    this.maxUsers = limits[this.plan];
  }

  static createTrial(organizationId: string): Subscription {
    const subscription = new Subscription();
    subscription.organizationId = organizationId;
    subscription.plan = SubscriptionPlan.TRIAL;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.type = SubscriptionType.TRIAL;
    subscription.startDate = new Date();

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days trial
    subscription.endDate = endDate;
    subscription.trialEndsAt = endDate;

    subscription.maxUsers = 2;
    subscription.autoRenew = false;
    subscription.isTrialUsed = true;

    return subscription;
  }

  static createPaidSubscription(
    organizationId: string,
    plan: SubscriptionPlan,
    type: SubscriptionType,
    price: number,
    currency: string,
    durationMonths: number = 1,
  ): Subscription {
    const subscription = new Subscription();
    subscription.organizationId = organizationId;
    subscription.plan = plan;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.type = type;
    subscription.price = price;
    subscription.currency = currency;
    subscription.startDate = new Date();

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);
    subscription.endDate = endDate;

    subscription.billingCycle =
      type === SubscriptionType.MONTHLY
        ? 1
        : type === SubscriptionType.YEARLY
          ? 12
          : 0;

    subscription.lastBillingDate = new Date();
    if (subscription.billingCycle > 0) {
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + subscription.billingCycle);
      subscription.nextBillingDate = nextBilling;
    }

    subscription.autoRenew = type !== SubscriptionType.LIFETIME;
    subscription.updateMaxUsers();

    return subscription;
  }
}
