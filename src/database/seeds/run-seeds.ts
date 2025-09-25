import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { OrganizationSeeder } from './organization.seed';
import { UserSeeder } from './user.seed';
import { CategorySeeder } from './category.seed';

// Cargar variables de entorno
config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function runSeeds() {
  try {
    await dataSource.initialize();
    console.log('🌱 Iniciando seeds...');

    // Ejecutar seeds en orden: Organizaciones primero, luego usuarios y categorías
    const organizationSeeder = new OrganizationSeeder(dataSource);
    await organizationSeeder.run();

    // Los user y category seeds necesitarán ser actualizados para multitenant
    // await UserSeeder.run(dataSource);
    // await CategorySeeder.run(dataSource);

    console.log('✅ Seeds completados exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando seeds:', error);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
