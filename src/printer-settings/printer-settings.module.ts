import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterSettingsService } from './printer-settings.service';
import { PrinterSettingsController } from './printer-settings.controller';
import { PrinterSettingsEntity } from './entities/printer-settings.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrinterSettingsEntity]),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  controllers: [PrinterSettingsController],
  providers: [PrinterSettingsService],
  exports: [PrinterSettingsService],
})
export class PrinterSettingsModule {}
