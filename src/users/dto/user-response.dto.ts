// import { UserRole, UserStatus } from '../entities/user.entity';

// export class UserResponseDto {
//   id: string;
//   firstName: string;
//   lastName: string;
//   fullName: string;
//   email: string;
//   phone?: string;
//   role: UserRole;
//   status: UserStatus;
//   avatar?: string;
//   lastLoginAt?: Date;
//   isActive: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// src/modules/users/dto/user-response.dto.ts

import { Expose } from 'class-transformer'; // ✅ Importante: Asegúrate de importar Expose
import { UserRole, UserStatus } from '../entities/user.entity'; // Asegúrate de que las rutas sean correctas

export class UserResponseDto {
  @Expose() // ✅ Todas las propiedades que quieras exponer deben llevar @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  // Si fullName es un getter en tu entidad User, o es una propiedad que quieres computar aquí:
  @Expose()
  fullName: string;

  @Expose()
  email: string;

  @Expose()
  phone?: string;

  @Expose()
  role: UserRole;

  @Expose()
  status: UserStatus;

  @Expose()
  avatar?: string;

  @Expose()
  lastLoginAt?: Date;

  // Si isActive es un getter en tu entidad User, o es una propiedad que quieres computar aquí:
  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // ✅ Añade estos getters y DECORALOS con @Expose()
  // Asumen que la lógica para determinar el rol está basada en 'this.role'
  @Expose()
  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  @Expose()
  get isManager(): boolean {
    return this.role === UserRole.MANAGER;
  }

  @Expose()
  get isUser(): boolean {
    return this.role === UserRole.USER;
  }
}
