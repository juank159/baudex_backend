import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('active_sessions')
@Index(['userId', 'isActive', 'expiresAt'])
export class ActiveSession extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  jti: string;

  @Column({ type: 'text', nullable: true, name: 'device_info' })
  deviceInfo: string;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({
    type: 'timestamptz',
    name: 'last_activity_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastActivityAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
