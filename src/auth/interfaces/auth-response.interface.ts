import { UserRole, UserStatus } from '../../users/entities/user.entity';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
    isActive: boolean;
  };
}
