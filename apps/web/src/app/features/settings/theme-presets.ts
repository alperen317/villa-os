export interface ThemePreset {
  id: string;
  name: string;
  accentColor: string;
}

/** Curated accent colors — each stays within WCAG AA contrast against white button text. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'ocean', name: 'Okyanus Mavisi', accentColor: '#2563eb' },
  { id: 'emerald', name: 'Zümrüt Yeşili', accentColor: '#0f766e' },
  { id: 'terracotta', name: 'Toprak Turuncu', accentColor: '#c2410c' },
  { id: 'violet', name: 'Mor', accentColor: '#6d28d9' },
  { id: 'graphite', name: 'Antrasit', accentColor: '#334155' },
];
