import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PermissionsTab } from '../permissions-tab/permissions-tab';
import { SettingsStore } from '../settings.store';
import { THEME_PRESETS, ThemePreset } from '../theme-presets';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzTabsModule,
    PermissionsTab,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  @ViewChild('logoInput') private readonly logoInput?: ElementRef<HTMLInputElement>;

  protected readonly saving = signal(false);
  protected readonly logoUploading = signal(false);
  protected readonly themePresets = THEME_PRESETS;

  protected readonly form = this.formBuilder.nonNullable.group({
    companyName: ['', Validators.required],
    accentColor: ['#2563eb', [Validators.required, Validators.pattern(HEX_COLOR_PATTERN)]],
    contactEmail: [''],
    contactPhone: [''],
    contactAddress: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.store.ensureLoaded();
    this.resetFormFromStore();
  }

  private resetFormFromStore(): void {
    const settings = this.store.settings();
    if (!settings) {
      return;
    }

    this.form.reset({
      companyName: settings.companyName,
      accentColor: settings.accentColor,
      contactEmail: settings.contactEmail ?? '',
      contactPhone: settings.contactPhone ?? '',
      contactAddress: settings.contactAddress ?? '',
    });
  }

  isPresetSelected(preset: ThemePreset): boolean {
    return this.form.controls.accentColor.value.toLowerCase() === preset.accentColor.toLowerCase();
  }

  selectPreset(preset: ThemePreset): void {
    this.form.controls.accentColor.setValue(preset.accentColor);
    this.form.controls.accentColor.markAsDirty();
  }

  triggerLogoSelect(): void {
    this.logoInput?.nativeElement.click();
  }

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      this.message.error('Sadece PNG, JPEG, SVG veya WEBP dosyaları yüklenebilir');
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      this.message.error('Logo dosyası en fazla 2 MB olabilir');
      return;
    }

    this.logoUploading.set(true);
    try {
      await this.store.uploadLogo(file);
      this.message.success('Logo güncellendi');
    } catch {
      this.message.error('Logo yüklenemedi');
    } finally {
      this.logoUploading.set(false);
    }
  }

  async removeLogo(): Promise<void> {
    this.logoUploading.set(true);
    try {
      await this.store.removeLogo();
      this.message.success('Logo kaldırıldı');
    } catch {
      this.message.error('Logo kaldırılamadı');
    } finally {
      this.logoUploading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();

    try {
      await this.store.update(value);
      this.message.success('Ayarlar kaydedildi');
    } catch {
      this.message.error('Ayarlar kaydedilemedi');
    } finally {
      this.saving.set(false);
    }
  }
}
