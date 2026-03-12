import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrinterSettingsEntity } from './entities/printer-settings.entity';
import { CreatePrinterSettingsDto } from './dto/create-printer-settings.dto';
import { UpdatePrinterSettingsDto } from './dto/update-printer-settings.dto';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Injectable()
export class PrinterSettingsService {
  constructor(
    @InjectRepository(PrinterSettingsEntity)
    private readonly printerRepository: Repository<PrinterSettingsEntity>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  async create(
    createDto: CreatePrinterSettingsDto,
  ): Promise<PrinterSettingsEntity> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Si es default, limpiar flag en las demás
    if (createDto.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    const printer = this.printerRepository.create({
      ...createDto,
      organizationId: tenantId,
    });

    return this.printerRepository.save(printer);
  }

  async findAll(): Promise<PrinterSettingsEntity[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.printerRepository.find({
      where: { organizationId: tenantId, deletedAt: null },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PrinterSettingsEntity> {
    const tenantId = this.tenantAwareService.getTenantId();
    const printer = await this.printerRepository.findOne({
      where: { id, organizationId: tenantId, deletedAt: null },
    });

    if (!printer) {
      throw new NotFoundException('Impresora no encontrada');
    }

    return printer;
  }

  async update(
    id: string,
    updateDto: UpdatePrinterSettingsDto,
  ): Promise<PrinterSettingsEntity> {
    const tenantId = this.tenantAwareService.getTenantId();
    const printer = await this.findOne(id);

    // Si se marca como default, limpiar flag en las demás
    if (updateDto.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    Object.assign(printer, updateDto);
    return this.printerRepository.save(printer);
  }

  async remove(id: string): Promise<void> {
    const printer = await this.findOne(id);
    await this.printerRepository.softRemove(printer);
  }

  async setDefault(id: string): Promise<PrinterSettingsEntity> {
    const tenantId = this.tenantAwareService.getTenantId();
    const printer = await this.findOne(id);

    await this.clearDefaultFlag(tenantId);

    printer.isDefault = true;
    return this.printerRepository.save(printer);
  }

  private async clearDefaultFlag(organizationId: string): Promise<void> {
    await this.printerRepository.update(
      { organizationId, isDefault: true },
      { isDefault: false },
    );
  }
}
