import 'server-only';
import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, resolveLocale, type Locale } from './config';
import { getDict, type Dict } from './index';

/** The request's UI locale: `penprint_lang` cookie, else Accept-Language, else Hebrew. */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLocale(c.get(LANG_COOKIE)?.value, h.get('accept-language'));
}

/** Dictionary for the current request (server components, generateMetadata). */
export async function getT(): Promise<Dict> {
  return getDict(await getLocale());
}

/** `<title>` helper: "<page> · <app name>". */
export async function pageTitle(pick: (t: Dict) => string): Promise<{ title: string }> {
  const t = await getT();
  return { title: `${pick(t)} · ${t.appName}` };
}
