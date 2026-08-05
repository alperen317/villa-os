import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { logoUploadOptions } from './logo-upload.config';
import { SettingsService } from './settings.service';
import { Settings, UserRole } from '../../../generated/prisma/client';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get whitelabel/branding settings (public — needed by the login screen)' })
  get(): Promise<Settings> {
    return this.settingsService.getOrCreate();
  }

  @Patch()
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Update whitelabel/branding settings' })
  update(@Body() dto: UpdateSettingsDto): Promise<Settings> {
    return this.settingsService.update(dto);
  }

  @Post('logo')
  @Roles(UserRole.Administrator)
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  @ApiOperation({ summary: 'Upload/replace the company logo' })
  uploadLogo(@UploadedFile() file: Express.Multer.File): Promise<Settings> {
    if (!file) {
      throw new BadRequestException('Logo dosyası gerekli');
    }

    return this.settingsService.updateLogo(`/uploads/logo/${file.filename}`);
  }

  @Delete('logo')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Remove the company logo' })
  removeLogo(): Promise<Settings> {
    return this.settingsService.removeLogo();
  }
}
