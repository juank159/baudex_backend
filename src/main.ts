// import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import { AppModule } from './app.module';
// import { HttpExceptionFilter } from './common/filters/http-exception.filter';
// import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// import { ResponseInterceptor } from './common/interceptors/response.interceptor';
// import { LoggerMiddleware } from './common/middlewares/logger.middleware';
// import { useContainer } from 'class-validator';
// import * as os from 'os';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const configService = app.get(ConfigService);

//   // Configurar prefijo global para la API
//   app.setGlobalPrefix('api', {
//     exclude: ['health', '/'], // Excluir endpoints específicos del prefijo
//   });

//   // Obtener IP local para acceso desde móvil
//   const networkInterfaces = os.networkInterfaces();
//   const localIp =
//     Object.values(networkInterfaces)
//       .flat()
//       .find(
//         (details: any) =>
//           details && details.family === 'IPv4' && !details.internal,
//       )?.address || 'localhost';

//   // Puerto de la aplicación
//   const port = configService.get<number>('PORT') || 3000;

//   // 🆕 CONFIGURACIÓN DE SWAGGER
//   const config = new DocumentBuilder()
//     .setTitle('Sistema de Facturación API')
//     .setDescription(
//       'API completa para sistema de facturación con NestJS - Gestión de usuarios, categorías, productos y facturación',
//     )
//     .setVersion('1.0.0')
//     .addBearerAuth(
//       {
//         type: 'http',
//         scheme: 'bearer',
//         bearerFormat: 'JWT',
//         name: 'JWT',
//         description: 'Ingresa tu token JWT (sin "Bearer ")',
//         in: 'header',
//       },
//       'JWT-auth',
//     )
//     .addTag('Auth', 'Endpoints de autenticación y autorización')
//     .addTag('Users', 'Gestión de usuarios del sistema')
//     .addTag('Categories', 'Gestión de categorías de productos')
//     .addTag('Products', 'Gestión de productos e inventario')
//     .addTag('Prices', 'Gestión de precios de productos')
//     .addTag('Admin', 'Endpoints administrativos')
//     .addServer(`http://localhost:${port}`, 'Servidor de desarrollo (localhost)')
//     .addServer(
//       `http://${localIp}:${port}`,
//       'Servidor de desarrollo (red local)',
//     )
//     .build();

//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api/docs', app, document, {
//     swaggerOptions: {
//       persistAuthorization: true, // Mantener token entre recargas
//       tagsSorter: 'alpha', // Ordenar tags alfabéticamente
//       operationsSorter: 'alpha', // Ordenar operaciones alfabéticamente
//       docExpansion: 'none', // No expandir automáticamente
//       filter: true, // Habilitar filtro de búsqueda
//       showRequestHeaders: true, // Mostrar headers de request
//     },
//     customSiteTitle: 'API Facturación - Documentación',
//     customfavIcon: '/favicon.ico',
//     customJs: [
//       'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
//       'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
//     ],
//     customCssUrl: [
//       'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
//     ],
//   });

//   // Configurar validaciones globales
//   app.useGlobalPipes(
//     new ValidationPipe({
//       transform: true,
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transformOptions: {
//         enableImplicitConversion: true,
//       },
//       // Mensajes de error en español
//       exceptionFactory: (errors) => {
//         const messages = errors.map((error) => {
//           const constraints = error.constraints;
//           if (constraints) {
//             return Object.values(constraints).join(', ');
//           }
//           return 'Error de validación';
//         });
//         return new Error(messages.join('; '));
//       },
//     }),
//   );

//   // Configurar filtros de excepción globales
//   app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

//   // Configurar interceptor de respuesta global
//   app.useGlobalInterceptors(new ResponseInterceptor());

//   // Permitir inyección de dependencias en validadores
//   useContainer(app.select(AppModule), { fallbackOnErrors: true });

//   // Configurar CORS - ACTUALIZADO para permitir acceso desde móvil
//   app.enableCors({
//     origin: [
//       'http://localhost:3000',
//       `http://${localIp}:${port}`,
//       'http://localhost:8080', // Para desarrollo web
//       '*', // Permitir todos los orígenes en desarrollo
//     ],
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: [
//       'Content-Type',
//       'Authorization',
//       'X-Requested-With',
//       'Accept',
//       'Origin',
//       'Access-Control-Request-Method',
//       'Access-Control-Request-Headers',
//     ],
//     credentials: true,
//     optionsSuccessStatus: 200, // Para soportar navegadores legacy
//   });

//   // IMPORTANTE: Escuchar en todas las interfaces (0.0.0.0) para permitir acceso desde red local
//   await app.listen(port, '0.0.0.0');

//   // Logs informativos con URLs para diferentes dispositivos
//   console.log('🚀 Aplicación iniciada correctamente');
//   console.log('═══════════════════════════════════════════════════════════');
//   console.log(`🌐 Servidor LOCAL: http://localhost:${port}`);
//   console.log(`📱 Servidor RED LOCAL: http://${localIp}:${port}`);
//   console.log('───────────────────────────────────────────────────────────');
//   console.log(`📚 API LOCAL: http://localhost:${port}/api`);
//   console.log(`📱 API RED LOCAL: http://${localIp}:${port}/api`);
//   console.log('───────────────────────────────────────────────────────────');
//   console.log(`📖 Swagger Docs LOCAL: http://localhost:${port}/api/docs`);
//   console.log(`📱 Swagger Docs RED: http://${localIp}:${port}/api/docs`);
//   console.log('───────────────────────────────────────────────────────────');
//   console.log(`❤️  Health check: http://localhost:${port}/health`);
//   console.log(`📋 Info API: http://localhost:${port}/api/info`);
//   console.log('═══════════════════════════════════════════════════════════');
//   console.log('');
//   console.log('📱 Para probar desde móvil:');
//   console.log(`   1. Usa esta IP en tu app Flutter: ${localIp}`);
//   console.log(`   2. URL base para Flutter: http://${localIp}:${port}/api`);
//   console.log(`   3. Asegúrate de estar en la misma red WiFi`);
//   console.log('');
//   console.log('🔧 Configuración:');
//   console.log(`   - Escuchando en: 0.0.0.0:${port}`);
//   console.log(`   - IP detectada: ${localIp}`);
//   console.log(`   - CORS habilitado para todas las IPs en desarrollo`);
//   console.log('═══════════════════════════════════════════════════════════');
// }

// bootstrap().catch((error) => {
//   console.error('❌ Error al iniciar la aplicación:', error);
//   process.exit(1);
// });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SmartResponseInterceptor } from './common/interceptors/smart-response.interceptor'; // 👈 CAMBIO AQUÍ
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { useContainer } from 'class-validator';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configurar prefijo global para la API
  app.setGlobalPrefix('api', {
    exclude: ['health', '/'], // Excluir endpoints específicos del prefijo
  });

  // Obtener IP local para acceso desde móvil
  const networkInterfaces = os.networkInterfaces();
  const localIp =
    Object.values(networkInterfaces)
      .flat()
      .find(
        (details: any) =>
          details && details.family === 'IPv4' && !details.internal,
      )?.address || 'localhost';

  // Puerto de la aplicación
  const port = configService.get<number>('PORT') || 3000;

  // 🆕 CONFIGURACIÓN DE SWAGGER
  const config = new DocumentBuilder()
    .setTitle('Sistema de Facturación API')
    .setDescription(
      'API completa para sistema de facturación con NestJS - Gestión de usuarios, categorías, productos y facturación',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu token JWT (sin "Bearer ")',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Endpoints de autenticación y autorización')
    .addTag('Users', 'Gestión de usuarios del sistema')
    .addTag('Categories', 'Gestión de categorías de productos')
    .addTag('Products', 'Gestión de productos e inventario')
    .addTag('Prices', 'Gestión de precios de productos')
    .addTag('Admin', 'Endpoints administrativos')
    .addServer(`http://localhost:${port}`, 'Servidor de desarrollo (localhost)')
    .addServer(
      `http://${localIp}:${port}`,
      'Servidor de desarrollo (red local)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantener token entre recargas
      tagsSorter: 'alpha', // Ordenar tags alfabéticamente
      operationsSorter: 'alpha', // Ordenar operaciones alfabéticamente
      docExpansion: 'none', // No expandir automáticamente
      filter: true, // Habilitar filtro de búsqueda
      showRequestHeaders: true, // Mostrar headers de request
    },
    customSiteTitle: 'API Facturación - Documentación',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  // Configurar validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Mensajes de error en español
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints;
          if (constraints) {
            return Object.values(constraints).join(', ');
          }
          return 'Error de validación';
        });
        return new Error(messages.join('; '));
      },
    }),
  );

  // Configurar filtros de excepción globales
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // 👈 CAMBIO CRÍTICO: Usar SmartResponseInterceptor en lugar de ResponseInterceptor
  app.useGlobalInterceptors(new SmartResponseInterceptor());

  // Permitir inyección de dependencias en validadores
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Configurar CORS - ACTUALIZADO para permitir acceso desde móvil
  app.enableCors({
    origin: [
      'http://localhost:3000',
      `http://${localIp}:${port}`,
      'http://localhost:8080', // Para desarrollo web
      '*', // Permitir todos los orígenes en desarrollo
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    credentials: true,
    optionsSuccessStatus: 200, // Para soportar navegadores legacy
  });

  // IMPORTANTE: Escuchar en todas las interfaces (0.0.0.0) para permitir acceso desde red local
  await app.listen(port, '0.0.0.0');

  // Logs informativos con URLs para diferentes dispositivos
  console.log('🚀 Aplicación iniciada correctamente');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🌐 Servidor LOCAL: http://localhost:${port}`);
  console.log(`📱 Servidor RED LOCAL: http://${localIp}:${port}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`📚 API LOCAL: http://localhost:${port}/api`);
  console.log(`📱 API RED LOCAL: http://${localIp}:${port}/api`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`📖 Swagger Docs LOCAL: http://localhost:${port}/api/docs`);
  console.log(`📱 Swagger Docs RED: http://${localIp}:${port}/api/docs`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`❤️  Health check: http://localhost:${port}/health`);
  console.log(`📋 Info API: http://localhost:${port}/api/info`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Para probar desde móvil:');
  console.log(`   1. Usa esta IP en tu app Flutter: ${localIp}`);
  console.log(`   2. URL base para Flutter: http://${localIp}:${port}/api`);
  console.log(`   3. Asegúrate de estar en la misma red WiFi`);
  console.log('');
  console.log('🔧 Configuración:');
  console.log(`   - Escuchando en: 0.0.0.0:${port}`);
  console.log(`   - IP detectada: ${localIp}`);
  console.log(`   - CORS habilitado para todas las IPs en desarrollo`);
  console.log('═══════════════════════════════════════════════════════════');
}

bootstrap().catch((error) => {
  console.error('❌ Error al iniciar la aplicación:', error);
  process.exit(1);
});
