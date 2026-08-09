import { TestBed } from '@angular/core/testing';
import { ViewportService } from './viewport.service';

/** Minimal stand-in for MediaQueryList — jsdom's own never evaluates a real query, so the
 *  test drives `matches` and the change event by hand. */
class FakeMediaQueryList {
  matches = false;
  private listeners = new Set<(event: MediaQueryListEvent) => void>();

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  emit(matches: boolean): void {
    this.matches = matches;
    this.listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

describe('ViewportService', () => {
  let query: FakeMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    query = new FakeMediaQueryList();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('seeds isMobile from the query it is constructed with', () => {
    query.matches = true;
    expect(TestBed.inject(ViewportService).isMobile()).toBe(true);
  });

  it('tracks the breakpoint as the viewport crosses it', () => {
    const service = TestBed.inject(ViewportService);
    expect(service.isMobile()).toBe(false);

    query.emit(true);
    expect(service.isMobile()).toBe(true);

    query.emit(false);
    expect(service.isMobile()).toBe(false);
  });

  it('detaches its listener when the injector is destroyed', () => {
    TestBed.inject(ViewportService);
    expect(query.listenerCount).toBe(1);

    TestBed.resetTestingModule();
    expect(query.listenerCount).toBe(0);
  });

  it('stays on the desktop default when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(TestBed.inject(ViewportService).isMobile()).toBe(false);
  });
});
