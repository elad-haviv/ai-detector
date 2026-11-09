'use client';
import { useEffect, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { useKeys } from '@/lib/keyStore';
import { useSettings } from '@/lib/store';
import type { Settings } from '@/lib/types';
import { Checkbox, Field, Section, SegmentedControl, Select } from '@/components/ui';
import { AccessSection, KeyField } from '@/components/settings/AccessSection';

const SECTIONS = [
  { id: 'access', title: he.settings.accessSection },
  { id: 'analysis', title: he.settings.analysisSection },
  { id: 'display', title: he.settings.displaySection },
] as const;

export default function SettingsPage() {
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
      <h1 className="text-title font-bold">{he.settings.title}</h1>
      <p className="mt-1 text-sm text-muted">{he.settings.autosaved}</p>

      <nav aria-label={he.settings.sectionsNav} className="sticky top-14 z-10 -mx-4 mt-3 bg-bg/95 px-4 py-2 backdrop-blur">
        <ul className="flex gap-2">
          {SECTIONS.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong px-4 text-sm font-semibold hover:bg-surface-2">
                {x.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-3 space-y-5">
        <Section id="access" title={he.settings.accessSection} intro={he.settings.accessIntro}>
          <AccessSection />
        </Section>

        <Section id="analysis" title={he.settings.analysisSection} intro={he.settings.analysisIntro}>
          <SegmentedControl<Settings['sensitivity']>
            legend={he.settings.sensitivity}
            hint={he.settings.sensitivityHint}
            value={s.sensitivity}
            onChange={(v) => update({ sensitivity: v })}
            options={[
              { value: 'low', label: he.settings.sensitivityLow },
              { value: 'medium', label: he.settings.sensitivityMedium },
              { value: 'high', label: he.settings.sensitivityHigh },
            ]}
          />
          <SegmentedControl<Settings['explanationLanguage']>
            legend={he.settings.explanationLanguage}
            value={s.explanationLanguage}
            onChange={(v) => update({ explanationLanguage: v })}
            options={[
              { value: 'he', label: he.settings.langHe },
              { value: 'en', label: <span lang="en">{he.settings.langEn}</span> },
              { value: 'auto', label: he.settings.langAuto },
            ]}
          />

          <div className="space-y-4 border-t border-border pt-5">
            <h3 className="font-bold">{he.settings.decisionTitle}</h3>
            <p className="-mt-3 text-caption text-muted">{he.settings.decisionIntro}</p>
            <Checkbox label={he.settings.useDecision} checked={s.useDecisionModel} onChange={(v) => update({ useDecisionModel: v })} />
            {s.useDecisionModel && (
              <>
                <Field label={he.settings.model} id="dm">
                  {(f) => (
                    <Select {...f} dir="ltr" value={s.decisionModel} onChange={(e) => update({ decisionModel: e.target.value })} className="font-mono text-sm">
                      {[...new Set([s.decisionModel, ...decisionModels.map((m) => m.id)])].map((id) => (
                        <option key={id} value={id}>
                          {decisionModels.find((m) => m.id === id)?.name || id}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {p !== 'openrouter' && <Field label={he.settings.decisionKey}>{(f) => <KeyField provider="openrouter" field={f} />}</Field>}
                {!keys.openrouter && <p className="text-caption font-semibold text-warning">{he.settings.decisionNoKey}</p>}
              </>
            )}
          </div>
        </Section>

        <Section id="display" title={he.settings.displaySection} intro={he.settings.displayIntro}>
          <SegmentedControl<Settings['theme']>
            legend={he.settings.theme}
            value={s.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: he.settings.themeSystem },
              { value: 'light', label: he.settings.themeLight },
              { value: 'dark', label: he.settings.themeDark },
            ]}
          />
          <SegmentedControl<Settings['textSize']>
            legend={he.settings.textSize}
            hint={he.settings.textSizeHint}
            value={s.textSize}
            onChange={(v) => update({ textSize: v })}
            options={[
              { value: 'normal', label: he.settings.textSizeNormal },
              { value: 'large', label: <span className="text-[1.125em]">{he.settings.textSizeLarge}</span> },
              { value: 'larger', label: <span className="text-[1.25em]">{he.settings.textSizeLarger}</span> },
            ]}
          />
          <Checkbox
            label={he.settings.alwaysShowPercent}
            hint={he.settings.alwaysShowPercentHint}
            checked={s.alwaysShowPercent}
            onChange={(v) => update({ alwaysShowPercent: v })}
          />
        </Section>
      </div>
    </div>
  );
}
