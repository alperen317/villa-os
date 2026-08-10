import { BadRequestException } from '@nestjs/common';
import {
  acceptLogoUpload,
  logoFilename,
  logoUploadOptions,
} from './logo-upload.config';

function upload(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    mimetype: 'image/png',
    originalname: 'logo.png',
    ...overrides,
  } as Express.Multer.File;
}

function filter(file: Express.Multer.File): {
  error: Error | null;
  accepted: boolean;
} {
  let result = { error: null as Error | null, accepted: false };
  acceptLogoUpload(null, file, (error, accepted) => {
    result = { error, accepted };
  });
  return result;
}

describe('logo upload config', () => {
  describe('logoFilename', () => {
    it('derives the extension from the accepted mimetype', () => {
      expect(logoFilename('image/png')).toMatch(/\.png$/);
      expect(logoFilename('image/jpeg')).toMatch(/\.jpg$/);
      expect(logoFilename('image/svg+xml')).toMatch(/\.svg$/);
      expect(logoFilename('image/webp')).toMatch(/\.webp$/);
    });

    it('takes no extension from a type it does not know, rather than inventing one', () => {
      expect(logoFilename('text/html')).not.toContain('.');
    });

    it('names the file after a UUID, so the client never influences the path', () => {
      expect(logoFilename('image/png')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
      );
      expect(logoFilename('image/png')).not.toEqual(logoFilename('image/png'));
    });
  });

  describe('acceptLogoUpload', () => {
    it('accepts every type the extension map knows', () => {
      for (const mimetype of [
        'image/png',
        'image/jpeg',
        'image/svg+xml',
        'image/webp',
      ]) {
        expect(filter(upload({ mimetype })).accepted).toBe(true);
      }
    });

    it('rejects a type that is not an image', () => {
      const { error, accepted } = filter(upload({ mimetype: 'text/html' }));

      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('rejects a disguised document even when it is named like an image', () => {
      expect(
        filter(upload({ mimetype: 'text/html', originalname: 'logo.png' }))
          .accepted,
      ).toBe(false);
    });
  });

  it('caps the upload at 2MB', () => {
    expect(logoUploadOptions.limits.fileSize).toBe(2 * 1024 * 1024);
  });
});
