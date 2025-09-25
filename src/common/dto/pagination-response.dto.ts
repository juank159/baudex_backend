export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Alias para compatibilidad con tu código existente
export interface PaginationMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta | PaginationMetaDto;
}

// // src/common/dto/pagination-response.dto.ts
// import { Expose } from 'class-transformer';

// // Clase para la metadata de paginación
// export class PaginationMetaDto {
//   @Expose()
//   readonly page: number;

//   @Expose()
//   readonly limit: number;

//   @Expose()
//   readonly totalItems: number;

//   @Expose()
//   readonly totalPages: number;

//   @Expose()
//   readonly hasPreviousPage: boolean;

//   @Expose()
//   readonly hasNextPage: boolean;

//   constructor(options: {
//     page: number;
//     limit: number;
//     totalItems: number;
//     hasPreviousPage: boolean;
//     hasNextPage: boolean;
//   }) {
//     this.page = options.page;
//     this.limit = options.limit;
//     this.totalItems = options.totalItems;
//     this.totalPages = Math.ceil(options.totalItems / options.limit);
//     this.hasPreviousPage = options.hasPreviousPage;
//     this.hasNextPage = options.hasNextPage;
//   }
// }

// // DTO para la respuesta paginada general
// export class PaginatedResponseDto<T> {
//   @Expose()
//   readonly data: T[];

//   @Expose()
//   readonly meta: PaginationMetaDto;

//   constructor(data: T[], meta: PaginationMetaDto) {
//     this.data = data;
//     this.meta = meta;
//   }
// }
