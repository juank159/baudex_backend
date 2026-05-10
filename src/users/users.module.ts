// src/modules/users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesService } from './user-preferences.service';
import { User } from './entities/user.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreferences]),
    forwardRef(() => AuthModule), // forwardRef para evitar dependencias circulares
    CommonModule, // Para TenantAwareService
  ],
  controllers: [UsersController, UserPreferencesController],
  providers: [UsersService, UserPreferencesService],
  exports: [UsersService, UserPreferencesService, TypeOrmModule], // Exportar para uso en AuthModule
})
export class UsersModule {}
