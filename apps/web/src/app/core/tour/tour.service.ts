import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Driver, DriveStep, driver } from 'driver.js';
import { AuthService } from '../auth/auth.service';
import { TOUR_STEPS, TourStep } from './tour-steps';

const SEEN_KEY_PREFIX = 'villa-os-tour-seen-';

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private driverObj: Driver | null = null;
  /** True while a navigation was triggered by the tour itself, so the NavigationStart watcher below doesn't mistake it for the user clicking away. */
  private navigatingViaTour = false;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => {
      if (this.driverObj?.isActive() && !this.navigatingViaTour) {
        this.driverObj.destroy();
      }
    });
  }

  hasSeenTour(userId: string): boolean {
    return localStorage.getItem(SEEN_KEY_PREFIX + userId) !== null;
  }

  markSeen(userId: string): void {
    localStorage.setItem(SEEN_KEY_PREFIX + userId, '1');
  }

  async start(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user || this.driverObj?.isActive()) {
      return;
    }

    const steps = TOUR_STEPS.filter((step) => !step.roles || step.roles.includes(user.role));
    if (steps.length === 0) {
      return;
    }

    try {
      await this.goToStep(steps[0]);
    } catch {
      return;
    }

    this.driverObj = driver({
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'İleri',
      prevBtnText: 'Geri',
      doneBtnText: 'Bitir',
      steps: this.buildDriveSteps(steps),
      // On the last step driver.js looks for a distinct onDoneClick handler (falling back to
      // onNextClick only when onDoneClick is unset) — without this, clicking "Bitir" no-ops.
      onDoneClick: (_element, _step, opts) => {
        opts.driver.destroy();
      },
      onDestroyed: () => {
        this.markSeen(user.sub);
        this.driverObj = null;
      },
    });

    this.driverObj.drive();
  }

  private buildDriveSteps(steps: TourStep[]): DriveStep[] {
    return steps.map((step, index) => ({
      element: `#${step.elementId}`,
      popover: {
        title: step.title,
        description: step.description,
        onNextClick:
          index < steps.length - 1
            ? async (_element, _driveStep, opts) => {
                try {
                  await this.goToStep(steps[index + 1]);
                  opts.driver.moveNext();
                } catch {
                  opts.driver.destroy();
                }
              }
            : undefined,
        onPrevClick:
          index > 0
            ? async (_element, _driveStep, opts) => {
                try {
                  await this.goToStep(steps[index - 1]);
                  opts.driver.movePrevious();
                } catch {
                  opts.driver.destroy();
                }
              }
            : undefined,
      },
    }));
  }

  private async goToStep(step: TourStep): Promise<void> {
    this.navigatingViaTour = true;
    try {
      if (this.router.url !== step.path) {
        await this.router.navigateByUrl(step.path);
      }
      await this.waitForElement(step.elementId);
    } finally {
      this.navigatingViaTour = false;
    }
  }

  private waitForElement(id: string, timeoutMs = 4000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.getElementById(id)) {
          observer.disconnect();
          clearTimeout(timer);
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Tour anchor #${id} bulunamadı`));
      }, timeoutMs);
    });
  }
}
