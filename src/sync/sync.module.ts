import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [forwardRef(() => AuthModule), SuppliersModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
