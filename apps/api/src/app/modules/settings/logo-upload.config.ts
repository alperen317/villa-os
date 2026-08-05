import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { LOGO_UPLOAD_DIR } from '../../infra/uploads/uploads-path';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);

export const logoUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
      callback(null, LOGO_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('Sadece PNG, JPEG, SVG veya WEBP dosyaları yüklenebilir'), false);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
};
