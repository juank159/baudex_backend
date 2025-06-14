// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(AuthGuard())
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== ENDPOINTS DE CREACIÓN ====================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // ==================== ENDPOINTS DE CONSULTA ====================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  getProfile(@GetUser() user: User) {
    return { user };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.usersService.getStats();
  }

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  search(@Query('q') searchTerm: string, @Query('limit') limit: number = 10) {
    return this.usersService.search(searchTerm, limit);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // ==================== ENDPOINTS DE ACTUALIZACIÓN ====================

  @Patch('me')
  updateProfile(@GetUser() user: User, @Body() updateUserDto: UpdateUserDto) {
    // Los usuarios solo pueden actualizar ciertos campos de su perfil
    const allowedFields = ['firstName', 'lastName', 'phone', 'avatar'];
    const filteredDto = Object.keys(updateUserDto)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateUserDto[key];
        return obj;
      }, {});

    return this.usersService.update(user.id, filteredDto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  changeMyPassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Patch('me/avatar')
  updateMyAvatar(
    @GetUser() user: User,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(user.id, updateAvatarDto.avatar);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() currentUser: User,
  ) {
    // Verificar permisos para la acción
    const canPerform = await this.usersService.canPerformAction(
      currentUser.id,
      id,
      'update',
    );

    if (!canPerform) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar este usuario',
      );
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @GetUser() currentUser: User,
  ) {
    // Verificar permisos para la acción
    const canPerform = await this.usersService.canPerformAction(
      currentUser.id,
      id,
      'updateStatus',
    );

    if (!canPerform) {
      throw new ForbiddenException(
        'No tienes permisos para cambiar el estado de este usuario',
      );
    }

    return this.usersService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/password')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async changeUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(id, changePasswordDto);
  }

  @Patch(':id/avatar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateUserAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(id, updateAvatarDto.avatar);
  }

  // ==================== ENDPOINTS DE ELIMINACIÓN ====================

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.restore(id);
  }

  // ==================== ENDPOINTS DE VALIDACIÓN ====================

  @Get('email/:email/available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async checkEmailAvailability(
    @Param('email') email: string,
    @Query('excludeId') excludeId?: string,
  ) {
    const isAvailable = await this.usersService.isEmailAvailable(
      email,
      excludeId,
    );
    return {
      email,
      available: isAvailable,
      message: isAvailable ? 'Email disponible' : 'Email ya está en uso',
    };
  }
}
