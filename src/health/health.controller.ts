import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  
  @Get('health')
  getHealthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Baudex Backend API',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        type: 'postgresql'
      },
      api: {
        status: 'operational',
        endpoints: {
          auth: 'active',
          dashboard: 'active',
          expenses: 'active',
          categories: 'active'
        }
      }
    };
  }
}