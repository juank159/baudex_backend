// src/common/interceptors/smart-response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Interceptor inteligente que detecta el tipo de respuesta
 * y aplica el formato correcto automáticamente
 */
@Injectable()
export class SmartResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Verificar si es una respuesta paginada
        if (this.isPaginatedResponse(data)) {
          return {
            success: true,
            data: data.data, // Extraer solo el array de datos
            meta: data.meta, // Mantener meta como propiedad adicional
            timestamp: new Date().toISOString(),
          } as any;
        }

        // Para respuestas normales, envolver en el formato estándar
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  /**
   * Detecta si la respuesta tiene estructura paginada
   */
  private isPaginatedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      'meta' in data &&
      Array.isArray(data.data) &&
      data.meta &&
      typeof data.meta === 'object' &&
      ('totalItems' in data.meta || 'total' in data.meta)
    );
  }
}
