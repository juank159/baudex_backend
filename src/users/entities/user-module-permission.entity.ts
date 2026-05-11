import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from './user.entity';

/**
 * Códigos de módulo permitidos. Mantener en sync con el frontend
 * (`PermissionsService.modules`) y el seeder.
 */
export enum PermissionModuleCode {
  DASHBOARD = 'dashboard',
  INVOICES = 'invoices',
  EXPENSES = 'expenses',
  CUSTOMERS = 'customers',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  PURCHASE_ORDERS = 'purchase_orders',
  BANK_ACCOUNTS = 'bank_accounts',
  CASH_REGISTER = 'cash_register',
  REPORTS = 'reports',
  SETTINGS = 'settings', // Módulos de configuración (org, impresoras, etc.)
  EMPLOYEES = 'employees', // Gestión del equipo
}

/**
 * Permisos granulares por usuario y por módulo.
 *
 * - **admin**: ignora completamente esta tabla (siempre puede todo).
 * - **manager**: por defecto puede todo, pero un admin puede crear
 *   registros aquí para restringirle acciones específicas.
 * - **user**: por defecto solo lectura básica (canView=true en algunos
 *   módulos); admin/manager configuran lo demás.
 *
 * La unicidad por (userId, moduleCode) impide registros duplicados —
 * cada combinación user+módulo tiene UNA fila.
 */
@Entity({ name: 'user_module_permissions' })
@Unique('UQ_user_module_permissions_user_module', ['userId', 'moduleCode'])
@Index('IDX_user_module_permissions_organization_id', ['organizationId'])
export class UserModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'module_code',
  })
  moduleCode: PermissionModuleCode;

  @Column({ type: 'boolean', name: 'can_view', default: false })
  canView: boolean;

  @Column({ type: 'boolean', name: 'can_edit', default: false })
  canEdit: boolean;

  @Column({ type: 'boolean', name: 'can_delete', default: false })
  canDelete: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
