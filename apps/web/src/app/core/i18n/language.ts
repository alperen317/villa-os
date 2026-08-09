/**
 * Turkish is the product language: the system is built for a single Turkish
 * villa rental business, and `provideNzI18n(tr_TR)` sets the component library
 * to match. English exists so the string catalogue has a second locale to keep
 * it honest — a key that only reads correctly in Turkish is a key that has the
 * sentence baked into it.
 */
export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'tr';

export const LANGUAGE_STORAGE_KEY = 'villaos.language';

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}
