import { Component, OnInit, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'villa-os-pwa-install-dismissed';

@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  templateUrl: './install-prompt.html',
  styleUrl: './install-prompt.scss',
})
export class InstallPrompt implements OnInit {
  protected readonly visible = signal(false);
  protected readonly mode = signal<'android' | 'ios'>('android');
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  ngOnInit(): void {
    if (localStorage.getItem(DISMISS_KEY) || this.isStandalone() || !this.isMobile()) {
      return;
    }

    if (this.isIos()) {
      // iOS Safari has no beforeinstallprompt API — the user has to be walked through the manual flow.
      this.mode.set('ios');
      this.visible.set(true);
      return;
    }

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.mode.set('android');
      this.visible.set(true);
    });
  }

  protected async install(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }
    await this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.dismiss();
  }

  protected dismiss(): void {
    this.visible.set(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  private isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  private isIos(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}
