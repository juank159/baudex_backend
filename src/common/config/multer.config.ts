import { diskStorage } from 'multer';
import { Request } from 'express';
import * as path from 'path';
import * as fsSync from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}

export const multerConfig = {
  storage: diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(file.originalname);
      const sanitizedBaseName = path
        .basename(file.originalname, extension)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .substring(0, 50);

      const filename = `expense-${sanitizedBaseName}-${timestamp}-${randomString}${extension}`;
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10, // Max 10 files per request
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb) => {
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, WebP, GIF) y documentos (PDF, Word, Excel, TXT, CSV)',
        ) as any,
        false,
      );
    }
  },
};
