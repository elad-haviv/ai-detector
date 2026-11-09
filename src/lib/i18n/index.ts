import type { Locale } from './config';
import { en } from './en';
import { he, type Dict } from './he';

export * from './config';
export type { Dict } from './he';

const DICTS: Record<Locale, Dict> = { he, en };

/** UI dictionary for a locale. Both dictionaries share the `Dict` type derived from he.ts. */
export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}
