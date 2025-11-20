// src/products/enums/tax.enums.ts
/**
 * Categorías de impuestos según la DIAN (Colombia)
 * Referencia: Dataico API para facturación electrónica
 */
export enum TaxCategory {
  /**
   * Impuesto al Valor Agregado
   * Tarifas comunes: 0%, 5%, 19%
   */
  IVA = 'IVA',

  /**
   * Impuesto Nacional al Consumo
   * Aplicable a ciertos productos (restaurantes, bares, telefonía, etc.)
   * Tarifas: 4%, 8%, 16%
   */
  INC = 'INC',

  /**
   * Impuesto Nacional al Consumo de Bolsas Plásticas
   * Tarifa: Valor fijo por unidad
   */
  INC_BOLSA = 'INC_BOLSA',

  /**
   * Producto exento de impuestos
   * Tarifa: 0%
   */
  EXENTO = 'EXENTO',

  /**
   * Producto no gravado (no aplica IVA)
   * Ejemplo: Servicios profesionales, alimentos básicos
   */
  NO_GRAVADO = 'NO_GRAVADO',
}

/**
 * Categorías de retenciones en la fuente
 */
export enum RetentionCategory {
  /**
   * Retención en la fuente por IVA
   * Tarifa común: 15%
   */
  RET_IVA = 'RET_IVA',

  /**
   * Retención en la fuente por Renta
   * Tarifas variables según concepto
   */
  RET_RENTA = 'RET_RENTA',

  /**
   * Retención de Industria y Comercio
   * Tarifa variable según municipio
   */
  RET_ICA = 'RET_ICA',

  /**
   * Retención por CREE (Impuesto sobre la Renta para la Equidad)
   */
  RET_CREE = 'RET_CREE',
}

/**
 * Tarifas de IVA comunes en Colombia
 */
export enum IVATaxRate {
  /** Sin IVA - Productos exentos o no gravados */
  ZERO = 0,

  /** IVA reducido - Productos de la canasta básica */
  REDUCED = 5,

  /** IVA general - Mayoría de productos y servicios */
  GENERAL = 19,
}

/**
 * Tarifas de INC (Impuesto Nacional al Consumo)
 */
export enum INCTaxRate {
  /** Tarifa del 4% */
  FOUR = 4,

  /** Tarifa del 8% */
  EIGHT = 8,

  /** Tarifa del 16% */
  SIXTEEN = 16,
}

/**
 * Helper para determinar si una categoría requiere tarifa
 */
export function requiresTaxRate(category: TaxCategory): boolean {
  return category !== TaxCategory.NO_GRAVADO;
}

/**
 * Helper para obtener la tasa predeterminada según categoría
 */
export function getDefaultTaxRate(category: TaxCategory): number {
  switch (category) {
    case TaxCategory.IVA:
      return IVATaxRate.GENERAL; // 19%
    case TaxCategory.INC:
      return INCTaxRate.EIGHT; // 8%
    case TaxCategory.EXENTO:
      return 0;
    case TaxCategory.NO_GRAVADO:
      return 0;
    case TaxCategory.INC_BOLSA:
      return 0; // Valor fijo, no porcentaje
    default:
      return 0;
  }
}
