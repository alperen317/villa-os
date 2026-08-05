import { Injectable } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { UPLOADS_ROOT } from '../../infra/uploads/uploads-path';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsRepository } from './settings.repository';
import { Settings } from '../../../generated/prisma/client';

const UPLOADS_URL_PREFIX = '/uploads/';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getOrCreate(): Promise<Settings> {
    const existing = await this.settingsRepository.findFirst();
    if (existing) {
      return existing;
    }

    return this.settingsRepository.create({});
  }

  async update(dto: UpdateSettingsDto): Promise<Settings> {
    const settings = await this.getOrCreate();
    return this.settingsRepository.update(settings.id, {
      companyName: dto.companyName,
      accentColor: dto.accentColor,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      contactAddress: dto.contactAddress,
    });
  }

  async updateLogo(logoPath: string): Promise<Settings> {
    const settings = await this.getOrCreate();
    this.deleteLogoFile(settings.logoPath);
    return this.settingsRepository.update(settings.id, { logoPath });
  }

  async removeLogo(): Promise<Settings> {
    const settings = await this.getOrCreate();
    this.deleteLogoFile(settings.logoPath);
    return this.settingsRepository.update(settings.id, { logoPath: null });
  }

  /** Removes the previously stored logo file from disk so replacing/clearing it doesn't leak orphans. */
  private deleteLogoFile(logoPath: string | null): void {
    if (!logoPath?.startsWith(UPLOADS_URL_PREFIX)) {
      return;
    }

    const absolutePath = join(UPLOADS_ROOT, logoPath.slice(UPLOADS_URL_PREFIX.length));
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
    }
  }
}
