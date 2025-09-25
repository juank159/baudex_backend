import { Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FileUploadService {
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  validateImageFile(file: Express.Multer.File): void {
    if (!this.allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo se permiten: JPEG, PNG, WebP, GIF',
      );
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        'El archivo es demasiado grande. Máximo 5MB',
      );
    }
  }

  generateFileName(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    const baseName = prefix || 'file';

    return `${baseName}-${timestamp}-${randomString}${extension}`;
  }

  ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
