import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import seedExpenseCategories from './expense-categories.seed';

async function bootstrap() {
  const configService = new ConfigService();
  
  console.log('🚀 Iniciando seed de categorías de gastos...');

  const config: DataSourceOptions = {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'password'),
    database: configService.get<string>('DB_NAME', 'facturacion_db'),
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('NODE_ENV', 'development') === 'development',
    logging: false,
  };
  
  const dataSource = new DataSource(config);

  try {
    await dataSource.initialize();
    console.log('📊 Conexión a la base de datos establecida');

    await seedExpenseCategories(dataSource);

    console.log('🎉 Seed de categorías de gastos completado exitosamente');
  } catch (error) {
    console.error('❌ Error durante el seed de categorías de gastos:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
}

bootstrap();