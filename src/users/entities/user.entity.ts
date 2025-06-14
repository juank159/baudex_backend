// src/modules/users/entities/user.entity.ts - CORREGIDA
import { Entity, Column, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import * as bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MANAGER = 'manager',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'text', nullable: true })
  avatar?: string;

  // Relaciones
  @OneToMany(() => Product, (product) => product.createdBy)
  products: Product[];

  // Campo privado para controlar si el password cambió
  private passwordChanged = false;

  // Métodos para manejar password - CORREGIDOS
  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (this.password) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    // Solo encriptar si la contraseña cambió
    if (this.passwordChanged && this.password) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
      this.passwordChanged = false; // Reset flag
    }
  }

  // Método para cambiar contraseña de forma segura
  async setPassword(newPassword: string): Promise<void> {
    this.password = newPassword;
    this.passwordChanged = true; // Marcar que cambió
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Método para obtener nombre completo
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Método para verificar si el usuario está activo
  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE && !this.deletedAt;
  }
}
