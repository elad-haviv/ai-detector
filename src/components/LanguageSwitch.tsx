'use client';
import { useLocale, useSetLocale, useT } from '@/lib/i18n/client';
import { IconGlobe } from './icons';

/**
 * Header language switch. It names the OTHER language in that language ("English" on the Hebrew
 * UI, "עברית" on the English one), marked with its `lang` so screen readers pronounce it right, and
 * its accessible name ("Switch language to English" / "החלפת שפה: עברית") contains the visible text as a word
 * (WCAG 2.5.3). Icon-only below 400px, like the other header chips, so the header fits 320px.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const t = useT();
  const setLocale = useSetLocale();
  const target = locale === 'he' ? 'en' : 'he';
  return (
    <button
      type="button"
      lang={target}
      aria-label={t.shell.langSwitchLabel}
      onClick={() => setLocale(target)}
      data-lang-switch
      className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border-strong px-3 text-caption font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text max-[400px]:px-2.5"
    >
      <IconGlobe width={16} height={16} className="shrink-0" />
      <span className="max-[400px]:sr-only">{t.shell.langSwitch}</span>
    </button>
  );
}
