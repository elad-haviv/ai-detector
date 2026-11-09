'use client';
import { useEffect, useState } from 'react';
import { useLangAttr, useLocale, useSetLocale, useT } from '@/lib/i18n/client';
import type { Locale } from '@/lib/i18n';
import { useKeys } from '@/lib/keyStore';
import { useSettings } from '@/lib/store';
import type { Settings } from '@/lib/types';
import { Checkbox, Field, Section, SegmentedControl, Select } from '@/components/ui';
import { AccessSection, KeyField } from '@/components/settings/AccessSection';

const SECTIONS = [
  { id: 'access', key: 'accessSection' },
  { id: 'analysis', key: 'analysisSection' },
  { id: 'display', key: 'displaySection' },
] as const;

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const langAttr = useLangAttr();
  const [s, update] = useSettings();
  const [mounted, setMounted] = useState(false);
  const { keys } = useKeys();
  const [decisionModels, setDecisionModels] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch('/api/models?kind=decisions')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setDecisionModels(d))
      .catch(() => {});
  }, []);

  // Honour #access / #analysis / #display after the client-only render
  useEffect(() => {
    if (mounted && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [mounted]);

  if (!mounted) return null;
  const p = s.provider;

  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:py-10">
      <h1 className="text-title font-bold">{t.settings.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.settings.autosaved}</p>

      <nav aria-label={t.settings.sectionsNav} className="unstick-short sticky top-14 z-10 -mx-4 mt-3 bg-bg/95 px-4 py-2 backdrop-blur">
        <ul className="flex gap-2">
          {SECTIONS.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong px-4 text-sm font-semibold hover:bg-surface-2">
                {t.settings[x.key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-3 space-y-5">
        <Section id="access" title={t.settings.accessSection} intro={t.settings.accessIntro}>
          <AccessSection />
        </Section>

        <Section id="analysis" title={t.settings.analysisSection} intro={t.settings.analysisIntro}>
          <SegmentedControl<Settings['sensitivity']>
            legend={t.settings.sensitivity}
            hint={t.settings.sensitivityHint}
            value={s.sensitivity}
            onChange={(v) => update({ sensitivity: v })}
            options={[
              { value: 'low', label: t.settings.sensitivityLow },
              { value: 'medium', label: t.settings.sensitivityMedium },
              { value: 'high', label: t.settings.sensitivityHigh },
            ]}
          />
          <SegmentedControl<Settings['explanationLanguage']>
            legend={t.settings.explanationLanguage}
            hint={t.settings.explanationLanguageHint}
            value={s.explanationLanguage}
            onChange={(v) => update({ explanationLanguage: v })}
            options={[
              { value: 'ui', label: t.settings.langUi },
              { value: 'he', label: <span lang={langAttr('he')}>{t.settings.langHe}</span> },
              { value: 'en', label: <span lang={langAttr('en')}>{t.settings.langEn}</span> },
              { value: 'auto', label: t.settings.langAuto },
            ]}
          />

          <div className="space-y-4 border-t border-border pt-5">
            <h3 className="font-bold">{t.settings.decisionTitle}</h3>
            <p className="-mt-3 text-caption text-muted">{t.settings.decisionIntro}</p>
            <Checkbox label={t.settings.useDecision} checked={s.useDecisionModel} onChange={(v) => update({ useDecisionModel: v })} />
            {s.useDecisionModel && (
              <>
                <Field label={t.settings.model} id="dm">
                  {(f) => (
                    <Select {...f} dir="ltr" lang={langAttr("en")} value={s.decisionModel} onChange={(e) => update({ decisionModel: e.target.value })} className="font-mono text-sm">
                      {[...new Set([s.decisionModel, ...decisionModels.map((m) => m.id)])].map((id) => (
                        <option key={id} value={id}>
                          {decisionModels.find((m) => m.id === id)?.name || id}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {p !== 'openrouter' && <Field label={t.settings.decisionKey}>{(f) => <KeyField provider="openrouter" field={f} />}</Field>}
                {!keys.openrouter && <p className="text-caption font-semibold text-warning">{t.settings.decisionNoKey}</p>}
              </>
            )}
          </div>
        </Section>

        <Section id="display" title={t.settings.displaySection} intro={t.settings.displayIntro}>
          {/* Interface language: each option is written in its own language (bilingual legend). */}
          <SegmentedControl<Locale>
            legend={
              <>
                {t.settings.uiLanguage}
                {' · '}
                <span lang={locale === 'he' ? 'en' : 'he'}>{locale === 'he' ? 'Language' : 'שפה'}</span>
              </>
            }
            hint={t.settings.uiLanguageHint}
            value={locale}
            onChange={(v) => setLocale(v)}
            options={[
              { value: 'he', label: <span lang={langAttr('he')}>עברית</span> },
              { value: 'en', label: <span lang={langAttr('en')}>English</span> },
            ]}
          />
          <SegmentedControl<Settings['theme']>
            legend={t.settings.theme}
            value={s.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: t.settings.themeSystem },
              { value: 'light', label: t.settings.themeLight },
              { value: 'dark', label: t.settings.themeDark },
            ]}
          />
          <SegmentedControl<Settings['textSize']>
            legend={t.settings.textSize}
            hint={t.settings.textSizeHint}
            value={s.textSize}
            onChange={(v) => update({ textSize: v })}
            options={[
              { value: 'normal', label: t.settings.textSizeNormal },
              { value: 'large', label: <span className="text-[1.125em]">{t.settings.textSizeLarge}</span> },
              { value: 'larger', label: <span className="text-[1.25em]">{t.settings.textSizeLarger}</span> },
            ]}
          />
          <Checkbox
            label={t.settings.alwaysShowPercent}
            hint={t.settings.alwaysShowPercentHint}
            checked={s.alwaysShowPercent}
            onChange={(v) => update({ alwaysShowPercent: v })}
          />
        </Section>
      </div>
    </div>
  );
}
