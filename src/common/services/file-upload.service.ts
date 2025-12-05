import { Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

@Injectable()
export class FileUploadService {
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  private readonly allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  private readonly allowedAttachmentTypes = [
    ...this.allowedImageTypes,
    ...this.allowedDocumentTypes,
  ];

  private readonly maxImageSize = 5 * 1024 * 1024; // 5MB
  private readonly maxDocumentSize = 10 * 1024 * 1024; // 10MB

  validateImageFile(file: Express.Multer.File): void {
    if (!this.allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo se permiten: JPEG, PNG, WebP, GIF',
      );
    }

    if (file.size > this.maxImageSize) {
      throw new BadRequestException(
        'El archivo es demasiado grande. Máximo 5MB para imágenes',
      );
    }
  }

  validateAttachmentFile(file: Express.Multer.File): void {
    if (!this.allowedAttachmentTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Tipos permitidos: imágenes (JPEG, PNG, WebP, GIF), documentos (PDF, Word, Excel, TXT, CSV)',
      );
    }

    const maxSize = this.allowedImageTypes.includes(file.mimetype)
      ? this.maxImageSize
      : this.maxDocumentSize;

    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      throw new BadRequestException(
        `El archivo es demasiado grande. Máximo ${maxSizeMB}MB`,
      );
    }
  }

  generateFileName(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    const sanitizedBaseName = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9]/g, '-')
      .substring(0, 50);
    const baseName = prefix || 'file';

    return `${baseName}-${sanitizedBaseName}-${timestamp}-${randomString}${extension}`;
  }

  ensureDirectoryExists(dirPath: string): void {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getFileUrl(filename: string, baseUrl: string): string {
    return `${baseUrl}/uploads/attachments/${filename}`;
  }
}
