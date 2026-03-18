import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      // Solo loguear errores (4xx y 5xx) para evitar spam de logs en producción
      if (res.statusCode >= 400) {
        const duration = Date.now() - start;
        const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
        console.error(`${logMessage}`);
      }
    });

    next();
  }
}
