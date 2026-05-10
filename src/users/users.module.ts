// src/modules/users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesService } from './user-preferences.service';
import { PermissionsService } from './permissions.service';
import { User } from './entities/user.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { UserModulePermission } from './entities/user-module-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreferences, UserModulePermission]),
    forwardRef(() => AuthModule), // forwardRef para evitar dependencias circulares
    CommonModule, // Para TenantAwareService
  ],
  controllers: [UsersController, UserPreferencesController],
  providers: [UsersService, UserPreferencesService, PermissionsService],
  exports: [
    UsersService,
    UserPreferencesService,
    PermissionsService,
    TypeOrmModule,
  ],
})
export class UsersModule {}
