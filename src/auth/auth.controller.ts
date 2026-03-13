import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
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
  register(
    @Body() registerDto: RegisterDto,
    @TenantId() tenantId?: string,
    @Req() req?: any,
  ) {
    const deviceInfo = req?.headers?.['user-agent'] || 'Unknown';
    const ipAddress =
      req?.headers?.['x-forwarded-for'] || req?.ip || 'Unknown';
    return this.authService.register(
      registerDto,
      tenantId,
      deviceInfo,
      ipAddress,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({
    status: 403,
    description: 'Límite de dispositivos alcanzado',
  })
  login(
    @Body() loginDto: LoginDto,
    @TenantId() tenantId?: string,
    @Req() req?: any,
  ) {
    const deviceInfo = req?.headers?.['user-agent'] || 'Unknown';
    const ipAddress =
      req?.headers?.['x-forwarded-for'] || req?.ip || 'Unknown';
    return this.authService.login(loginDto, tenantId, deviceInfo, ipAddress);
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
    description:
      'Verifica que la contraseña proporcionada coincida con la del usuario autenticado. Usado para operaciones sensibles.',
  })
  @ApiResponse({ status: 200, description: 'Contraseña válida' })
  @ApiResponse({ status: 401, description: 'Contraseña incorrecta' })
  @ApiResponse({ status: 400, description: 'Contraseña requerida' })
  validatePassword(
    @GetUser() user: User,
    @Body() body: { password: string },
  ) {
    return this.authService.validatePassword(user.id, body.password);
  }

  // ==================== LOGOUT ====================

  @Post('logout')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión actual (revocar sesión del dispositivo)',
  })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  logout(@Req() req: any) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    let jti: string | undefined;
    try {
      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );
      jti = decoded.jti;
    } catch {
      // Si no se puede decodificar, intentar revocar por user
    }
    return this.authService.logout(jti);
  }

  // ==================== GESTIÓN DE SESIONES ====================

  @Get('sessions')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario actual' })
  @ApiResponse({
    status: 200,
    description: 'Lista de sesiones activas',
  })
  getSessions(@GetUser() user: User) {
    return this.authService.getUserSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  @ApiResponse({ status: 200, description: 'Sesión revocada' })
  @ApiResponse({ status: 400, description: 'Sesión no encontrada' })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @GetUser() user: User,
  ) {
    return this.authService.revokeSession(sessionId, user.id);
  }

  @Delete('sessions')
  @UseGuards(AuthGuard())
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revocar todas las sesiones excepto la actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesiones revocadas',
  })
  revokeAllSessions(@GetUser() user: User, @Req() req: any) {
    // Extraer jti del token actual para no revocarlo
    const token = req.headers?.authorization?.replace('Bearer ', '');
    let currentJti: string | undefined;
    try {
      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );
      currentJti = decoded.jti;
    } catch {
      // Si no se puede decodificar, revocar todas
    }
    return this.authService.revokeAllSessionsExcept(user.id, currentJti);
  }
}
