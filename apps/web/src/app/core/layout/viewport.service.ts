import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * The same 768px breakpoint the stylesheets use (see the mobile section of `styles.scss`).
 * Kept in one place so the handful of layouts that have to change *behaviour* — not just
 * shape — read the breakpoint the CSS already draws, instead of inventing a second one.
 */
const MOBILE_QUERY = '(max-width: 768px)';

/**
 * Exposes the mobile breakpoint as a signal. Only for cases CSS genuinely can't express —
 * a different component input (e.g. the calendar's fullscreen mode) or a different set of
 * rendered nodes. Anything that is purely visual belongs in a media query.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly mobile = signal(false);

  readonly isMobile = this.mobile.asReadonly();

  constructor() {
    // No window/matchMedia means no viewport to measure — a unit test's jsdom, not a browser
    // (the app builds browser-only; there is no server or prerender target). Holding the
    // desktop default is the deliberate choice: it renders the fuller layout, and there is no
    // server-rendered markup for it to disagree with. Covered by the spec.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(MOBILE_QUERY);
    this.mobile.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => this.mobile.set(event.matches);
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }
}
