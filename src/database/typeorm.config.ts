// src/database/typeorm.config.ts
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: +configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // Siempre false para migraciones
  logging: true,
});

// package.json - agregar estos scripts
/*
"scripts": {
  "typeorm": "typeorm-ts-node-commonjs",
  "migration:generate": "npm run typeorm -- migration:generate src/database/migrations/migration -d src/database/typeorm.config.ts",
  "migration:create": "npm run typeorm -- migration:create src/database/migrations/migration",
  "migration:run": "npm run typeorm -- migration:run -d src/database/typeorm.config.ts",
  "migration:revert": "npm run typeorm -- migration:revert -d src/database/typeorm.config.ts"
}
*/
