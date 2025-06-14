import { Module, Global } from '@nestjs/common';
import { SlugService } from './services/slug.service';
import { SkuService } from './services/sku.service';
import { FileUploadService } from './services/file-upload.service';
import { PaginationService } from './services/pagination.service';
import { AuditService } from './services/audit.service';
import { IsUniqueConstraint } from './validators/is-unique.validator';
import { ExistsConstraint } from './validators/exists.validator';

@Global()
@Module({
  providers: [
    SlugService,
    SkuService,
    FileUploadService,
    PaginationService,
    AuditService,
    IsUniqueConstraint,
    ExistsConstraint,
  ],
  exports: [
    SlugService,
    SkuService,
    FileUploadService,
    PaginationService,
    AuditService,
  ],
})
export class CommonModule {}
