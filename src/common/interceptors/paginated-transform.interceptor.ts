// src/common/interceptors/paginated-transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { PaginatedResponseDto } from '../dto/pagination-response.dto';

/**
 * Interceptor especializado para transformar respuestas paginadas
 *
 * Este interceptor maneja correctamente las respuestas que tienen la estructura:
 * {
 *   data: [...], // Array que necesita transformación
 *   meta: {...}  // Metadatos de paginación que NO necesitan transformación
 * }
 */
@Injectable()
export class PaginatedTransformInterceptor<T>
  implements NestInterceptor<PaginatedResponseDto<any>, PaginatedResponseDto<T>>
{
  constructor(private readonly classToTransform: ClassConstructor<T>) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<PaginatedResponseDto<T>> {
    return next.handle().pipe(
      map((response: PaginatedResponseDto<any>) => {
        // Verificar si es una respuesta paginada
        if (
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'meta' in response
        ) {
          return {
            data: Array.isArray(response.data)
              ? response.data.map((item) =>
                  plainToInstance(this.classToTransform, item, {
                    excludeExtraneousValues: true,
                  }),
                )
              : [], // Si data no es array, devolver array vacío
            meta: response.meta, // Mantener meta sin transformación
          };
        }

        // Si no es una respuesta paginada, transformar como objeto simple
        return plainToInstance(this.classToTransform, response, {
          excludeExtraneousValues: true,
        }) as any;
      }),
    );
  }
}
