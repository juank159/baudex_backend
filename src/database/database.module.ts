import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { getDatabaseConfig } from './database.config';
import { createDataSourceAndMigrate } from './run-migrations-on-startup';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
      // Aplica las migraciones pendientes al arrancar, antes de atender
      // peticiones (con transacción única, candado y protección contra
      // migraciones que borran información). Ver run-migrations-on-startup.
      dataSourceFactory: async (options) =>
        createDataSourceAndMigrate(options as DataSourceOptions),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
