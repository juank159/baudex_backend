import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

      if (res.statusCode >= 400) {
        console.error(`❌ ${logMessage}`);
      } else {
        console.log(`✅ ${logMessage}`);
      }
    });

    next();
  }
}
