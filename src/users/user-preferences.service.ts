import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferences } from './entities/user-preferences.entity';
import {
  UpdateUserPreferencesDto,
  UserPreferencesResponseDto,
} from './dto/user-preferences.dto';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectRepository(UserPreferences)
    private readonly preferencesRepository: Repository<UserPreferences>,
  ) {}

  async getUserPreferences(
    userId: string,
    organizationId: string,
  ): Promise<UserPreferencesResponseDto> {
    let preferences = await this.preferencesRepository.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    // Si no existen preferencias, crear con valores por defecto
    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId, organizationId);
    }

    return this.toResponseDto(preferences);
  }

  async updateUserPreferences(
    userId: string,
    organizationId: string,
    updateDto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    let preferences = await this.preferencesRepository.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    if (!preferences) {
      // Crear si no existe
      preferences = this.preferencesRepository.create({
        userId,
        organizationId,
        ...updateDto,
      });
    } else {
      // Actualizar existente
      Object.assign(preferences, updateDto);
    }

    const savedPreferences = await this.preferencesRepository.save(preferences);
    return this.toResponseDto(savedPreferences);
  }

  async shouldAutoDeductInventory(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const preferences = await this.preferencesRepository.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    // Si no existen preferencias, usar valor por defecto
    return preferences?.autoDeductInventory ?? true;
  }

  private async createDefaultPreferences(
    userId: string,
    organizationId: string,
  ): Promise<UserPreferences> {
    const defaultPreferences = this.preferencesRepository.create({
      userId,
      organizationId,
      autoDeductInventory: true,
      useFifoCosting: true,
      validateStockBeforeInvoice: true,
      allowOverselling: false,
      showStockWarnings: true,
      showConfirmationDialogs: true,
      useCompactMode: false,
      enableExpiryNotifications: true,
      enableLowStockNotifications: true,
    });

    return await this.preferencesRepository.save(defaultPreferences);
  }

  private toResponseDto(
    preferences: UserPreferences,
  ): UserPreferencesResponseDto {
    return {
      id: preferences.id,
      userId: preferences.userId,
      organizationId: preferences.organizationId,
      autoDeductInventory: preferences.autoDeductInventory,
      useFifoCosting: preferences.useFifoCosting,
      validateStockBeforeInvoice: preferences.validateStockBeforeInvoice,
      allowOverselling: preferences.allowOverselling,
      showStockWarnings: preferences.showStockWarnings,
      showConfirmationDialogs: preferences.showConfirmationDialogs,
      useCompactMode: preferences.useCompactMode,
      enableExpiryNotifications: preferences.enableExpiryNotifications,
      enableLowStockNotifications: preferences.enableLowStockNotifications,
      defaultWarehouseId: preferences.defaultWarehouseId,
      additionalSettings: preferences.additionalSettings,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    };
  }
}
