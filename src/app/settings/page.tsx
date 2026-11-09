'use client';
import { useEffect, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { DEFAULT_MODELS, MODEL_SUGGESTIONS, useSettings } from '@/lib/store';
import type { ProviderId, Settings } from '@/lib/types';
import { Button, Checkbox, Field, Input, Section, SegmentedControl, Select, type FieldControlProps } from '@/components/ui';

const PROVIDERS: { id: ProviderId; note: string; keyUrl: string }[] = [
  { id: 'openrouter', note: 'מפתח אחד לכל המודלים, כולל מודלי החלטה כמו Jev', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'google', note: 'מודלי Gemini, יש מכסה חינמית', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', note: 'מודלי GPT דרך ה-API', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', note: 'מודלי Claude דרך ה-API', keyUrl: 'https://console.anthropic.com/settings/keys' },
];

const SECTIONS = [
  { id: 'access', title: he.settings.accessSection },
  { id: 'analysis', title: he.settings.analysisSection },
  { id: 'display', title: he.settings.displaySection },
] as const;

function KeyField({ provider, field }: { provider: ProviderId; field: FieldControlProps }) {
  const [s, update] = useSettings();
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        {...field}
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={s.keys[provider] || ''}
        onChange={(e) => update({ keys: { ...s.keys, [provider]: e.target.value.trim() } })}
        placeholder={he.settings.apiKeyPlaceholder}
        className="flex-1 font-mono text-sm"
      />
      <Button onClick={() => setShow((v) => !v)} aria-pressed={show} aria-controls={field.id}>
        {show ? he.settings.hideKey : he.settings.showKey}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const [s, update] = useSettings();
  const [mounted, setMounted] = useState(false);
  const [orModels, setOrModels] = useState<{ id: string; name: string }[]>([]);
  const [decisionModels, setDecisionModels] = useState<{ id: string; name: string }[]>([]);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then(setOrModels).catch(() => {});
    fetch('/api/models?kind=decisions').then((r) => r.json()).then(setDecisionModels).catch(() => {});
  }, []);

  // Honour #access / #analysis / #display after the client-only render
  useEffect(() => {
    if (mounted && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [mounted]);

  if (!mounted) return null;
  const p = s.provider;
  const modelOptions = p === 'openrouter' && orModels.length ? orModels.map((m) => m.id) : MODEL_SUGGESTIONS[p];

  async function testConnection() {
    setTest({ state: 'testing' });
    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p, apiKey: s.keys[p], model: s.models[p] }),
      });
      const data = await res.json();
      setTest(data.ok ? { state: 'ok' } : { state: 'fail', msg: data.error || 'unknown' });
    } catch (e) {
      setTest({ state: 'fail', msg: e instanceof Error ? e.message : String(e) });
    }
  }

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
        {/* ── Access (M2 replaces this block with provider cards + BYOK storage + subscription) ── */}
        <Section id="access" title={he.settings.accessSection} intro={he.settings.accessIntro}>
          <SegmentedControl<ProviderId>
            legend={he.settings.provider}
            variant="cards"
            value={p}
            onChange={(v) => {
              update({ provider: v });
              setTest({ state: 'idle' });
            }}
            options={PROVIDERS.map((pr) => ({
              value: pr.id,
              label: (
                <>
                  {he.settings.providers[pr.id]}
                  {s.keys[pr.id] && <span className="rounded-full border border-success px-2 text-micro text-success">{he.settings.connected}</span>}
                </>
              ),
              description: pr.note,
            }))}
          />

          <Field
            label={`${he.settings.apiKey} · ${he.settings.providers[p]}`}
            hint={
              <>
                {he.settings.keyStorageNote}{' '}
                <a href={PROVIDERS.find((x) => x.id === p)!.keyUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">
                  {he.settings.whereKey}
                </a>
              </>
            }
          >
            {(f) => <KeyField provider={p} field={f} />}
          </Field>

          <Field label={he.settings.model} id="model">
            {(f) => (
              <>
                <Input {...f} dir="ltr" list="model-list" value={s.models[p]} onChange={(e) => update({ models: { ...s.models, [p]: e.target.value } })} className="font-mono text-sm" />
                <datalist id="model-list">
                  {modelOptions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <div role="group" aria-label={he.settings.modelSuggestions} className="-mt-3 flex flex-wrap gap-1.5">
            {MODEL_SUGGESTIONS[p].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ models: { ...s.models, [p]: m } })}
                aria-pressed={s.models[p] === m}
                dir="ltr"
                className={`min-h-8 rounded-full border px-2.5 font-mono text-xs ${s.models[p] === m ? 'border-accent bg-accent-soft' : 'border-border-strong hover:bg-surface-2'}`}
              >
                {m}
              </button>
            ))}
            {s.models[p] !== DEFAULT_MODELS[p] && (
              <button type="button" onClick={() => update({ models: { ...s.models, [p]: DEFAULT_MODELS[p] } })} className="min-h-8 px-1 text-xs text-muted underline">
                {he.settings.defaultModel}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={testConnection} disabled={!s.keys[p] || test.state === 'testing'}>
              {test.state === 'testing' ? he.settings.testing : he.settings.testConnection}
            </Button>
            <p role="status" className="min-w-0 flex-1">
              {test.state === 'ok' && <span className="font-semibold text-success">{he.settings.testSuccess}</span>}
              {test.state === 'fail' && <span className="break-all text-caption text-danger">{he.settings.testFailed.replace('{reason}', test.msg?.slice(0, 200) || '')}</span>}
            </p>
          </div>

          <details className="rounded-lg border border-border px-3 text-caption text-muted">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{he.settings.chatPlanQ}</summary>
            <p className="pb-3">{he.settings.chatPlanA}</p>
          </details>
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
                {!s.keys.openrouter && <p className="text-caption font-semibold text-warning">{he.settings.decisionNoKey}</p>}
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
