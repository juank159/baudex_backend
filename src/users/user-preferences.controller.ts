import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { UserPreferencesService } from './user-preferences.service';
import {
  UpdateUserPreferencesDto,
  UserPreferencesResponseDto,
} from './dto/user-preferences.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('User Preferences')
@Controller('user-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener configuraciones del usuario actual' })
  @ApiResponse({
    status: 200,
    description: 'Configuraciones de usuario obtenidas exitosamente',
    type: UserPreferencesResponseDto,
  })
  async getUserPreferences(
    @CurrentUser() user: any,
  ): Promise<UserPreferencesResponseDto> {
    return this.userPreferencesService.getUserPreferences(
      user.id,
      user.organizationId,
    );
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Actualizar configuraciones del usuario actual' })
  @ApiResponse({
    status: 200,
    description: 'Configuraciones actualizadas exitosamente',
    type: UserPreferencesResponseDto,
  })
  async updateUserPreferences(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    return this.userPreferencesService.updateUserPreferences(
      user.id,
      user.organizationId,
      updateDto,
    );
  }
}
