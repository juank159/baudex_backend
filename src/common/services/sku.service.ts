import { Injectable } from '@nestjs/common';

@Injectable()
export class SkuService {
  generateSku(
    categoryCode: string,
    productName: string,
    increment?: number,
  ): string {
    const cleanName = productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);

    const cleanCategory = categoryCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3);

    const timestamp = Date.now().toString().slice(-4);
    const incrementStr = increment ? increment.toString().padStart(3, '0') : '';

    return `${cleanCategory}-${cleanName}-${timestamp}${incrementStr}`;
  }

  validateSku(sku: string): boolean {
    const skuRegex = /^[A-Z0-9-_]{3,50}$/;
    return skuRegex.test(sku);
  }
}
