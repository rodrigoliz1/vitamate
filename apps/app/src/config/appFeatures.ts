import type { AppLocale } from '@vitamate/domain';

export type ColorTheme = 'light' | 'dark';

// Conservamos toda la infraestructura de idioma para reactivarla cuando la
// traducción profunda esté completa. Mientras tanto, la interfaz usa español.
export const LANGUAGE_SELECTION_ENABLED = false;

export function resolveUiLocale(locale: AppLocale): AppLocale {
  return LANGUAGE_SELECTION_ENABLED ? locale : 'es-MX';
}
