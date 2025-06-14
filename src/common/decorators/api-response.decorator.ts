import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiSuccessResponse<T>(
  model: Type<T>,
  description?: string,
  status: number = 200,
) {
  return applyDecorators(
    ApiResponse({
      status,
      description: description || 'Operación exitosa',
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            // Aquí podrías agregar más detalles del schema
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}
