import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Controller()
@UseInterceptors(ResponseInterceptor)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }

  @Get('api/info')
  getApiInfo() {
    return {
      name: 'Sistema de Facturación API',
      version: '1.0.0',
      description:
        'API REST para sistema de facturación baudex con NestJS y PostgreSQL',
      endpoints: {
        users: '/api/users',
        categories: '/api/categories',
        products: '/api/products',
        health: '/health',
      },
      documentation: '/api/docs', // TODO: Implementar Swagger
    };
  }
}
