import { PartialType } from '@nestjs/swagger';
import { CreatePrinterSettingsDto } from './create-printer-settings.dto';

export class UpdatePrinterSettingsDto extends PartialType(CreatePrinterSettingsDto) {}
