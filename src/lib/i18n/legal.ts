import type { Locale } from './config';
import * as legalEn from './legal.en';
import * as legalHe from './legal.he';

export type { LegalDoc } from './legal.he';

const LEGAL = { he: legalHe, en: legalEn } as const;

/** Long-form legal documents for a locale (server components only; keeps them out of client bundles). */
export function getLegal(locale: Locale) {
  const l = LEGAL[locale];
  return { privacy: l.privacyDoc, terms: l.termsDoc, accessibility: l.accessibilityDoc };
}
