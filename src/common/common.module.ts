import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlugService } from './services/slug.service';
import { SkuService } from './services/sku.service';
import { FileUploadService } from './services/file-upload.service';
import { PaginationService } from './services/pagination.service';
import { AuditService } from './services/audit.service';
import { TenantAwareService } from './services/tenant-aware.service';
import { SeedService } from './services/seed.service';
import { SubscriptionCheckService } from './services/subscription-check.service';
import { IsUniqueConstraint } from './validators/is-unique.validator';
import { ExistsConstraint } from './validators/exists.validator';
import { SubscriptionGuard } from './guards/subscription.guard';

// Importar entidades necesarias para SeedService
import { Category } from '../categories/entities/category.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { ProductPrice } from '../products/entities/product-price.entity';
import { ExpenseCategory } from '../expenses/entities/expense-category.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Customer,
      Product,
      ProductPrice,
      ExpenseCategory,
      Expense,
      Invoice,
      InvoiceItem,
      Organization,
    ]),
  ],
  providers: [
    SlugService,
    SkuService,
    FileUploadService,
    PaginationService,
    AuditService,
    TenantAwareService,
    SeedService,
    SubscriptionCheckService,
    SubscriptionGuard,
    IsUniqueConstraint,
    ExistsConstraint,
  ],
  exports: [
    TypeOrmModule,
    SlugService,
    SkuService,
    FileUploadService,
    PaginationService,
    AuditService,
    TenantAwareService,
    SeedService,
    SubscriptionCheckService,
    SubscriptionGuard,
  ],
})
export class CommonModule {}
