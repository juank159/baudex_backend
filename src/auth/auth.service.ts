import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const {
      email,
      password,
      firstName,
      lastName,
      role = UserRole.USER,
    } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya existe con este email');
    }

    // Crear usuario (el password se encripta automáticamente en @BeforeInsert)
    const user = this.userRepository.create({
      email,
      password, // Se encriptará automáticamente
      firstName,
      lastName,
      role,
      status: UserStatus.ACTIVE,
    });

    await this.userRepository.save(user);

    // Generar token
    const token = this.getJwtToken({ id: user.id });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Buscar usuario activo
    const user = await this.userRepository.findOne({
      where: {
        email,
        status: UserStatus.ACTIVE,
      },
      select: [
        'id',
        'email',
        'password',
        'firstName',
        'lastName',
        'role',
        'status',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña usando el método de la entidad
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generar token
    const token = this.getJwtToken({ id: user.id });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const { id } = payload;

    const user = await this.userRepository.findOne({
      where: {
        id,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    return user;
  }

  public getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  async refreshToken(user: User): Promise<{ token: string }> {
    const token = this.getJwtToken({ id: user.id });
    return { token };
  }
}
