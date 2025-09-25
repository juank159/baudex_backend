import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Category } from '../../categories/entities/category.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index()
  domain?: string;

  @Column({ type: 'text', nullable: true })
  logo?: string;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, any>;

  // DEPRECATED: Estos campos se mantienen temporalmente para compatibilidad
  // Los datos reales de suscripción ahora están en la tabla subscriptions
  @Column({ type: 'varchar', length: 50, nullable: true })
  subscriptionPlan?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  subscriptionStatus?: string;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @Column({ type: 'varchar', length: 50, default: 'America/New_York' })
  timezone: string;

  @Column({ type: 'uuid', nullable: true })
  mainWarehouseId?: string;

  // Relaciones
  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Product, (product) => product.organization)
  products: Product[];

  @OneToMany(() => Customer, (customer) => customer.organization)
  customers: Customer[];

  @OneToMany(() => Category, (category) => category.organization)
  categories: Category[];

  @OneToMany(() => Invoice, (invoice) => invoice.organization)
  invoices: Invoice[];

  @OneToMany(() => Expense, (expense) => expense.organization)
  expenses: Expense[];

  @OneToMany(() => Subscription, (subscription) => subscription.organization)
  subscriptions: Subscription[];

  @OneToMany(() => Supplier, (supplier) => supplier.organization)
  suppliers: Supplier[];

  @OneToMany(() => Sale, (sale) => sale.organization)
  sales: Sale[];

  // Métodos útiles
  get displayName(): string {
    return this.name || this.slug;
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  get isActivePlan(): boolean {
    console.warn(
      '⚠️  isActivePlan está deprecado. Usar currentSubscription?.isActive',
    );
    return this.isActive;
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  get hasValidSubscription(): boolean {
    console.warn(
      '⚠️  hasValidSubscription está deprecado. Usar currentSubscription?.isActive',
    );
    return true; // Temporalmente true para compatibilidad
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  get isTrialExpired(): boolean {
    console.warn(
      '⚠️  isTrialExpired está deprecado. Usar currentSubscription?.isExpired',
    );
    return false; // Temporalmente false para compatibilidad
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  get daysUntilExpiration(): number {
    console.warn(
      '⚠️  daysUntilExpiration está deprecado. Usar currentSubscription?.daysUntilExpiration',
    );
    return 30; // Temporalmente 30 para compatibilidad
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  canPerformAction(action: string): boolean {
    console.warn(
      '⚠️  canPerformAction está deprecado. Usar currentSubscription?.canPerformAction',
    );
    return true; // Temporalmente true para compatibilidad
  }

  // DEPRECADO: Usar currentSubscription en su lugar
  checkPlanLimits(feature: string): boolean {
    console.warn(
      '⚠️  checkPlanLimits está deprecado. Usar currentSubscription?.checkUserLimit',
    );
    return true; // Temporalmente true para compatibilidad
  }

  // DEPRECADO: Las suscripciones ahora se crean automáticamente via SubscriptionService
  startTrial(): void {
    console.warn(
      '⚠️  startTrial está deprecado. Usar SubscriptionService.createTrialSubscription',
    );
    // Método mantenido solo para compatibilidad temporal
  }

  // Nuevo método para obtener la suscripción activa
  get currentSubscription(): Subscription | undefined {
    if (!this.subscriptions || this.subscriptions.length === 0) {
      return undefined;
    }

    // Buscar la suscripción activa más reciente
    return this.subscriptions
      .filter((sub) => sub.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  // Helper para verificar si tiene acceso a una funcionalidad
  hasFeatureAccess(action: string): boolean {
    const subscription = this.currentSubscription;
    if (!subscription) return false;
    return subscription.canPerformAction(action);
  }

  // Helper para verificar límite de usuarios
  canAddUser(currentUserCount: number): boolean {
    const subscription = this.currentSubscription;
    if (!subscription) return false;
    return subscription.checkUserLimit(currentUserCount);
  }
}

// Re-export enums from Subscription entity for backward compatibility
export {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../subscriptions/entities/subscription.entity';
