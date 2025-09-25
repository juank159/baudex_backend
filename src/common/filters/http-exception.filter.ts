import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'Error interno del servidor',
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {}),
    };

    // Log del error para desarrollo
    if (status >= 500) {
      console.error('❌ Server Error:', {
        url: request.url,
        method: request.method,
        error: exception.message,
        stack: exception.stack,
      });
    }

    response.status(status).json(errorResponse);
  }
}
