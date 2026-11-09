import type { Locale } from '@/lib/i18n/config';
import type { Pattern } from './catalog';
import { PATTERN_TEXT_EN } from './catalog.en';

/** A pattern's name, description and fix in the UI language (Hebrew text lives in catalog.ts). */
export function patternText(p: Pattern, locale: Locale): { name: string; description: string; fix: string } {
  if (locale === 'en') {
    const t = PATTERN_TEXT_EN[p.id];
    return { name: p.nameEn, description: t?.description ?? p.descriptionHe, fix: t?.fix ?? p.fixHe };
  }
  return { name: p.nameHe, description: p.descriptionHe, fix: p.fixHe };
}
