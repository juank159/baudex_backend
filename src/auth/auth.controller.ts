import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GetUser } from './decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { TenantId } from '../common/decorators/current-tenant.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar nuevo usuario en la organización actual',
  })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'Usuario ya existe' })
  register(@Body() registerDto: RegisterDto, @TenantId() tenantId?: string) {
    return this.authService.register(registerDto, tenantId);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() loginDto: LoginDto, @TenantId() tenantId?: string) {
    return this.authService.login(loginDto, tenantId);
  }

  @Get('profile')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  getProfile(@GetUser() user: User) {
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        phone: user.phone,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        organizationId: user.organizationId,
        organizationSlug: user.organization?.slug,
        organizationName: user.organization?.name,
      },
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refrescar token de acceso' })
  @ApiResponse({ status: 200, description: 'Token refrescado exitosamente' })
  refreshToken(@GetUser() user: User) {
    return this.authService.refreshToken(user);
  }

  @Post('validate-password')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validar contraseña del usuario actual',
    description: 'Verifica que la contraseña proporcionada coincida con la del usuario autenticado. Usado para operaciones sensibles.'
  })
  @ApiResponse({ status: 200, description: 'Contraseña válida' })
  @ApiResponse({ status: 401, description: 'Contraseña incorrecta' })
  @ApiResponse({ status: 400, description: 'Contraseña requerida' })
  validatePassword(
    @GetUser() user: User,
    @Body() body: { password: string }
  ) {
    return this.authService.validatePassword(user.id, body.password);
  }
}
