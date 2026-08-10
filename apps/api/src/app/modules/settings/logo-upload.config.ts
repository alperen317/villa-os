import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { LOGO_UPLOAD_DIR } from '../../infra/uploads/uploads-path';

/**
 * The accepted types, each mapped to the extension the stored file gets.
 *
 * The extension is chosen here rather than taken from the upload, because everything the
 * client sends about a file is the client's to choose — `originalname` included. Deriving
 * `.png` from a declared `image/png` keeps the two from disagreeing, so a part labelled
 * `image/png` can't land on disk as `evil.html` and come back out of /uploads as a document.
 * (The stored name itself is a UUID, so the client never influences the path either.)
 */
const ALLOWED_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/svg+xml', '.svg'],
  ['image/webp', '.webp'],
]);

export const logoUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
      callback(null, LOGO_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${ALLOWED_TYPES.get(file.mimetype) ?? ''}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('Sadece PNG, JPEG, SVG veya WEBP dosyaları yüklenebilir'), false);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
};
