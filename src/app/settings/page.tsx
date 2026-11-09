'use client';
import { useEffect, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { DEFAULT_MODELS, MODEL_SUGGESTIONS, useSettings } from '@/lib/store';
import type { ProviderId } from '@/lib/types';

const PROVIDERS: { id: ProviderId; note: string; keyUrl: string }[] = [
  { id: 'openrouter', note: 'מפתח אחד לכל המודלים, כולל מודלי החלטה כמו Jev', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'google', note: 'מודלי Gemini, יש מכסה חינמית', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', note: 'מודלי GPT דרך ה-API', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', note: 'מודלי Claude דרך ה-API', keyUrl: 'https://console.anthropic.com/settings/keys' },
];

function KeyField({ provider }: { provider: ProviderId }) {
  const [s, update] = useSettings();
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={s.keys[provider] || ''}
        onChange={(e) => update({ keys: { ...s.keys, [provider]: e.target.value.trim() } })}
        placeholder={he.settings.apiKeyPlaceholder}
        className="min-h-11 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-[14px]"
        aria-label={`${he.settings.apiKey} ${he.settings.providers[provider]}`}
      />
      <button type="button" onClick={() => setShow((v) => !v)} className="min-h-11 rounded-md border border-border px-3 text-[14px] font-semibold">
        {show ? he.settings.hideKey : he.settings.showKey}
      </button>
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

  const label = 'mb-1 block text-[13px] font-semibold';
  const section = 'card space-y-4 p-4 md:p-5';

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-4 py-6 md:py-10">
      <h1 className="text-[22px] font-bold">{he.settings.title}</h1>

      <section className={section}>
        <h2 className="text-[17px] font-bold">{he.settings.providerSection}</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={he.settings.provider}>
          {PROVIDERS.map((pr) => (
            <button
              key={pr.id}
              role="radio"
              aria-checked={p === pr.id}
              onClick={() => {
                update({ provider: pr.id });
                setTest({ state: 'idle' });
              }}
              className={`rounded-lg border p-3 text-start ${p === pr.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 font-bold">
                {he.settings.providers[pr.id]}
                {s.keys[pr.id] && <span className="rounded-full bg-success/15 px-2 text-[11px] text-success">מחובר</span>}
              </div>
              <div className="text-[13px] text-muted">{pr.note}</div>
            </button>
          ))}
        </div>

        <div>
          <label className={label}>
            {he.settings.apiKey} · {he.settings.providers[p]}
          </label>
          <KeyField provider={p} />
          <p className="mt-1 text-[12px] text-muted">
            המפתח נשמר רק בדפדפן שלך, ועובר דרך שרת האתר לספק בכל בקשה בלי שיישמר שם.{' '}
            <a href={PROVIDERS.find((x) => x.id === p)!.keyUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              איפה מקבלים מפתח?
            </a>
          </p>
        </div>

        <div>
          <label className={label} htmlFor="model">
            {he.settings.model}
          </label>
          <input
            id="model"
            dir="ltr"
            list="model-list"
            value={s.models[p]}
            onChange={(e) => update({ models: { ...s.models, [p]: e.target.value } })}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-[14px]"
          />
          <datalist id="model-list">
            {modelOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MODEL_SUGGESTIONS[p].map((m) => (
              <button key={m} onClick={() => update({ models: { ...s.models, [p]: m } })} dir="ltr" className="rounded-full border border-border px-2 py-0.5 font-mono text-[12px] hover:border-accent">
                {m}
              </button>
            ))}
            {s.models[p] !== DEFAULT_MODELS[p] && (
              <button onClick={() => update({ models: { ...s.models, [p]: DEFAULT_MODELS[p] } })} className="text-[12px] text-muted underline">
                ברירת מחדל
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={testConnection} disabled={!s.keys[p] || test.state === 'testing'} className="min-h-11 rounded-md border border-border px-4 font-semibold disabled:opacity-40">
            {test.state === 'testing' ? he.settings.testing : he.settings.testConnection}
          </button>
          {test.state === 'ok' && <span className="text-success">{he.settings.testSuccess}</span>}
          {test.state === 'fail' && (
            <span className="break-all text-[13px] text-danger">{he.settings.testFailed.replace('{reason}', test.msg?.slice(0, 200) || '')}</span>
          )}
        </div>

        <details className="text-[13px] text-muted">
          <summary className="cursor-pointer font-semibold">מה לגבי מנוי ChatGPT Plus או Claude Pro?</summary>
          <p className="mt-1">
            מנויי צ׳אט אינם כוללים גישה ל-API, ואתר חיצוני לא יכול להשתמש בהם. צריך מפתח API נפרד (OpenAI Platform או Anthropic Console), או מפתח OpenRouter
            שנותן גישה גם ל-GPT וגם ל-Claude דרך חשבון אחד.
          </p>
        </details>
      </section>

      <section className={section}>
        <h2 className="text-[17px] font-bold">מודל החלטה (אופציונלי)</h2>
        <p className="text-[13px] text-muted">
          מודלי החלטה, כמו Jev של TypeSafe, לא מייצרים טקסט. הם מחזירים הסתברות מכוילת לשאלת כן/לא לכל משפט. הציון שלהם משוקלל יחד עם מודל השפה והכללים המקומיים. נדרש מפתח OpenRouter.
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.useDecisionModel} onChange={(e) => update({ useDecisionModel: e.target.checked })} className="size-5 accent-[var(--accent)]" />
          <span className="font-semibold">להשתמש במודל החלטה</span>
        </label>
        {s.useDecisionModel && (
          <>
            <div>
              <label className={label} htmlFor="dm">
                מודל
              </label>
              <select
                id="dm"
                dir="ltr"
                value={s.decisionModel}
                onChange={(e) => update({ decisionModel: e.target.value })}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-[14px]"
              >
                {[...new Set([s.decisionModel, ...decisionModels.map((m) => m.id)])].map((id) => (
                  <option key={id} value={id}>
                    {decisionModels.find((m) => m.id === id)?.name || id}
                  </option>
                ))}
              </select>
            </div>
            {p !== 'openrouter' && (
              <div>
                <label className={label}>מפתח OpenRouter (למודל ההחלטה)</label>
                <KeyField provider="openrouter" />
              </div>
            )}
            {!s.keys.openrouter && <p className="text-[13px] text-warning">בלי מפתח OpenRouter מודל ההחלטה לא יופעל.</p>}
          </>
        )}
      </section>

      <section className={section}>
        <h2 className="text-[17px] font-bold">ניתוח ותצוגה</h2>
        <div>
          <div className={label}>{he.settings.sensitivity}</div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((v) => (
              <button
                key={v}
                onClick={() => update({ sensitivity: v })}
                aria-pressed={s.sensitivity === v}
                className={`min-h-11 flex-1 rounded-md border font-semibold ${s.sensitivity === v ? 'border-accent bg-accent/10' : 'border-border'}`}
              >
                {v === 'low' ? he.settings.sensitivityLow : v === 'medium' ? he.settings.sensitivityMedium : he.settings.sensitivityHigh}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-muted">{he.settings.sensitivityHint}</p>
        </div>
        <div>
          <div className={label}>{he.settings.explanationLanguage}</div>
          <div className="flex gap-2">
            {([
              ['he', 'עברית'],
              ['en', 'English'],
              ['auto', 'כשפת הטקסט'],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => update({ explanationLanguage: v })}
                aria-pressed={s.explanationLanguage === v}
                className={`min-h-11 flex-1 rounded-md border font-semibold ${s.explanationLanguage === v ? 'border-accent bg-accent/10' : 'border-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className={label}>ערכת צבעים</div>
          <div className="flex gap-2">
            {([
              ['system', 'לפי המכשיר'],
              ['light', 'בהירה'],
              ['dark', 'כהה'],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => update({ theme: v })}
                aria-pressed={s.theme === v}
                className={`min-h-11 flex-1 rounded-md border font-semibold ${s.theme === v ? 'border-accent bg-accent/10' : 'border-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.alwaysShowPercent} onChange={(e) => update({ alwaysShowPercent: e.target.checked })} className="size-5" />
          <span>להציג אחוז גם ליד משפטים ברמת &quot;אפשרי&quot;</span>
        </label>
      </section>

      <p className="text-[12px] text-muted">ההגדרות נשמרות אוטומטית בדפדפן הזה.</p>
    </div>
  );
}
