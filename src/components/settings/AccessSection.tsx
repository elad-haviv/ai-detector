'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useLangAttr, useT } from '@/lib/i18n/client';
import { forgetAllKeys, setKey, setRemember, useKeys } from '@/lib/keyStore';
import { errorCode } from '@/lib/runAnalysis';
import { DEFAULT_MODELS, MODEL_SUGGESTIONS, hasKey, useSettings } from '@/lib/store';
import { useAccount } from '@/lib/account';
import type { ProviderId } from '@/lib/types';
import { Button, ButtonLink, Checkbox, ConfirmDialog, Field, Input, SegmentedControl, Select, useToast, type FieldControlProps } from '@/components/ui';
import { IconExternal, IconInfo, IconShield, IconTrash } from '@/components/icons';

/** Provider order and where each one hands out API keys. */
export const PROVIDERS: { id: ProviderId; keyUrl: string; example: string }[] = [
  { id: 'openrouter', keyUrl: 'https://openrouter.ai/keys', example: 'anthropic/claude-sonnet-5.5' },
  { id: 'openai', keyUrl: 'https://platform.openai.com/api-keys', example: 'gpt-6.1-terra' },
  { id: 'anthropic', keyUrl: 'https://console.anthropic.com/settings/keys', example: 'claude-sonnet-5-5' },
  { id: 'google', keyUrl: 'https://aistudio.google.com/apikey', example: 'gemini-3.8-flash' },
  { id: 'xai', keyUrl: 'https://console.x.ai/team/default/api-keys', example: 'grok-4.3' },
];

const CHATGPT_SIGNIN = process.env.NEXT_PUBLIC_CHATGPT_SIGNIN === '1';
const CUSTOM = '__custom__';

/** Masked key input with a show/hide toggle. Reads and writes the browser key store, never settings. */
export function KeyField({ provider, field }: { provider: ProviderId; field: FieldControlProps }) {
  const t = useT();
  const { keys } = useKeys();
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        {...field}
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={keys[provider] || ''}
        onChange={(e) => setKey(provider, e.target.value)}
        placeholder={t.settings.apiKeyPlaceholder}
        className="min-w-0 flex-1 font-mono text-sm"
      />
      <Button onClick={() => setShow((v) => !v)} aria-controls={field.id}>
        {show ? t.settings.hideKey : t.settings.showKey}
      </Button>
    </div>
  );
}

/** External link that says (to screen readers too) that it opens a new tab. */
function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  const t = useT();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent underline underline-offset-4 hover:no-underline">
      {children}
      <IconExternal width={16} height={16} className="shrink-0 rtl:-scale-x-100" />
      <span className="sr-only">{t.settings.newTab}</span>
    </a>
  );
}

function ModelPicker({ provider, orModels }: { provider: ProviderId; orModels: { id: string; name: string }[] }) {
  const t = useT();
  const langAttr = useLangAttr();
  const [s, update] = useSettings();
  const model = s.models[provider];
  const suggested = MODEL_SUGGESTIONS[provider];
  const catalog = provider === 'openrouter' ? orModels.filter((m) => !suggested.includes(m.id)) : [];
  const known = suggested.includes(model) || catalog.some((m) => m.id === model);
  const [customPicked, setCustomPicked] = useState(false);
  const custom = customPicked || !known;
  const setModel = (m: string) => update({ models: { ...s.models, [provider]: m } });
  const label = (id: string) => (id === DEFAULT_MODELS[provider] ? t.settings.modelDefaultMark.replace('{model}', id) : id);

  return (
    <div className="space-y-3">
      <Field label={t.settings.model}>
        {(f) => (
          <Select
            {...f}
            dir="ltr"
            value={custom ? CUSTOM : model}
            onChange={(e) => {
              if (e.target.value === CUSTOM) setCustomPicked(true);
              else {
                setCustomPicked(false);
                setModel(e.target.value);
              }
            }}
            className="w-full font-mono text-sm"
          >
            <optgroup label={t.settings.modelSuggested}>
              {suggested.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </optgroup>
            {catalog.length > 0 && (
              <optgroup label={t.settings.modelAllOpenRouter}>
                {catalog.map((m) => (
                  <option key={m.id} value={m.id} lang={langAttr('en')}>
                    {m.id}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={CUSTOM}>{t.settings.modelCustom}</option>
          </Select>
        )}
      </Field>
      {custom && (
        <Field label={t.settings.modelCustomLabel} hint={t.settings.modelCustomHint.replace('{example}', PROVIDERS.find((p) => p.id === provider)!.example)}>
          {(f) => <Input {...f} dir="ltr" lang={langAttr('en')} spellCheck={false} autoComplete="off" value={model} onChange={(e) => setModel(e.target.value.trim())} className="w-full font-mono text-sm" />}
        </Field>
      )}
    </div>
  );
}

type TestState = { state: 'idle' | 'testing' | 'ok' | 'fail'; msg?: string; detail?: string };

/** `onKeyError` reports a problem with the key itself (missing / rejected) so the key field can show it. */
function TestConnection({ provider, onKeyError }: { provider: ProviderId; onKeyError: (msg: string | null) => void }) {
  const t = useT();
  const langAttr = useLangAttr();
  const [s] = useSettings();
  const { keys } = useKeys();
  const toast = useToast();
  const [test, setTest] = useState<TestState>({ state: 'idle' });
  const name = t.settings.providers[provider];

  async function run() {
    if (test.state === 'testing') return;
    if (!keys[provider]) {
      setTest({ state: 'fail', msg: t.settings.noKeyToTest });
      onKeyError(t.settings.noKeyToTest);
      toast(t.settings.noKeyToTest, { tone: 'danger' });
      return;
    }
    setTest({ state: 'testing' });
    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ provider, apiKey: keys[provider], model: s.models[provider] }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; error?: string };
      if (data.ok) {
        setTest({ state: 'ok' });
        onKeyError(null);
        toast(`${t.settings.testSuccess} · ${name}`, { tone: 'success' });
      } else {
        const code = errorCode(data.code || data.error || '');
        const msg = t.errors[code];
        setTest({ state: 'fail', msg, detail: data.error });
        onKeyError(code === 'invalidKey' || code === 'missingKey' ? msg : null);
        toast(t.settings.testFailed.replace('{reason}', msg), { tone: 'danger' });
      }
    } catch {
      setTest({ state: 'fail', msg: t.errors.network });
      toast(t.settings.testFailed.replace('{reason}', t.errors.network), { tone: 'danger' });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} aria-disabled={test.state === 'testing' || undefined}>
          {test.state === 'testing' ? t.settings.testing : t.settings.testConnection}
        </Button>
        {/* Visual status; screen readers get the same message from the toast region. */}
        <p className="min-w-0 flex-1 text-sm">
          {test.state === 'ok' && <span className="font-semibold text-success">{t.settings.testSuccess}</span>}
          {test.state === 'fail' && <span className="font-semibold text-danger">{t.settings.testFailed.replace('{reason}', test.msg || '')}</span>}
        </p>
      </div>
      {test.state === 'fail' && test.detail && (
        <details className="text-caption text-muted">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t.settings.testFailedDetails}</summary>
          <p dir="ltr" lang={langAttr('en')} className="mt-1 break-all font-mono text-xs">
            {test.detail.slice(0, 300)}
          </p>
        </details>
      )}
    </div>
  );
}

/** Pro state in Settings → Access: active subscription, or a compact upsell to /pricing. */
function SubscriptionStatus() {
  const t = useT();
  const account = useAccount();
  const [s] = useSettings();
  const { keys } = useKeys();
  if (!account.loaded) return <div data-slot="subscription" className="min-h-20" />;
  if (account.plan === 'pro') {
    return (
      <div data-slot="subscription" className="rounded-lg border border-border border-s-4 border-s-success bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{t.settings.proTitle}</h3>
          <span className="rounded-full border border-success px-2 text-xs font-semibold text-success">{t.settings.proActiveBadge}</span>
        </div>
        <p className="mt-1 text-sm">{t.settings.proActive}</p>
        {hasKey(s, keys) && <p className="mt-1 text-caption text-muted">{t.settings.proActiveKeyNote}</p>}
        <ButtonLink href="/account" variant="link" className="mt-1">
          {t.settings.proManage}
        </ButtonLink>
      </div>
    );
  }
  return (
    <div data-slot="subscription" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-bold">{t.settings.proTitle}</h3>
        <p className="mt-0.5 text-sm text-muted">{t.settings.proBody}</p>
      </div>
      <ButtonLink href="/pricing" variant="secondary">
        {t.settings.proLink}
      </ButtonLink>
    </div>
  );
}

export function AccessSection() {
  const t = useT();
  const langAttr = useLangAttr();
  const [s, update] = useSettings();
  const { keys, remember } = useKeys();
  const toast = useToast();
  const [orModels, setOrModels] = useState<{ id: string; name: string }[]>([]);
  const [confirmForget, setConfirmForget] = useState(false);
  const p = s.provider;
  const info = PROVIDERS.find((x) => x.id === p)!;
  const anyKey = Object.values(keys).some(Boolean);
  // Error tied to the key field (aria-invalid + aria-describedby) after a failed connection test.
  const [keyError, setKeyError] = useState<string | null>(null);
  const currentKey = keys[p];
  useEffect(() => setKeyError(null), [p, currentKey]);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setOrModels(d))
      .catch(() => {});
  }, []);

  return (
    <>
      <SubscriptionStatus />

      <div className="space-y-4">
        <header>
          <h3 className="font-bold">{t.settings.byokTitle}</h3>
          <p className="mt-0.5 text-sm text-muted">{t.settings.byokIntro}</p>
        </header>

        <SegmentedControl<ProviderId>
          legend={t.settings.chooseProvider}
          variant="cards"
          columns={3}
          value={p}
          onChange={(v) => update({ provider: v })}
          options={PROVIDERS.map((pr) => ({
            value: pr.id,
            label: (
              <>
                <span lang={langAttr('en')}>{t.settings.providers[pr.id]}</span>
                {keys[pr.id] && <span className="rounded-full border border-success px-2 text-micro text-success">{t.settings.connected}</span>}
              </>
            ),
            description: t.settings.providerNotes[pr.id],
          }))}
        />

        <div role="group" aria-labelledby="provider-panel-title" className="space-y-4 rounded-lg border border-border-strong p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <h4 id="provider-panel-title" className="text-h2 font-bold" lang={langAttr('en')}>
              {t.settings.providers[p]}
            </h4>
            <NewTabLink href={info.keyUrl}>{t.settings.getKey}</NewTabLink>
          </div>

          <Field
            key={p}
            label={
              <>
                {t.settings.apiKey} · <bdi lang={langAttr('en')}>{t.settings.providers[p]}</bdi>
              </>
            }
            hint={keys[p] ? `${remember ? t.settings.keyOnDevice : t.settings.keyInSession} ${t.settings.keyStorageNote}` : t.settings.keyStorageNote}
            error={keyError}
          >
            {(f) => <KeyField provider={p} field={f} />}
          </Field>

          <Checkbox
            label={t.settings.rememberKey}
            hint={t.settings.rememberHint}
            checked={remember}
            onChange={(v) => {
              setRemember(v);
              toast(v ? t.settings.rememberOn : t.settings.rememberOff);
            }}
          />

          <TestConnection key={`t-${p}`} provider={p} onKeyError={setKeyError} />

          <ModelPicker key={`m-${p}`} provider={p} orModels={orModels} />

          {p === 'openai' && (
            <div className="space-y-1 border-t border-border pt-4">
              <Button
                disabled={!CHATGPT_SIGNIN}
                onClick={() => toast(t.settings.chatgptNotImplemented)}
                aria-describedby="chatgpt-note"
              >
                {t.settings.chatgptButton}
              </Button>
              <p id="chatgpt-note" className="text-caption text-muted">
                {t.settings.chatgptNote}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border border-s-4 border-s-success bg-surface p-3">
          <IconShield className="mt-0.5 shrink-0 text-success" />
          <div className="text-sm">
            <p className="font-bold">{t.settings.privacyTitle}</p>
            <p>{t.settings.privacyNote}</p>
            <p className="mt-1 text-caption text-muted">{t.settings.privacyMore}</p>
          </div>
        </div>

        <div>
          <Button variant="secondary" icon={<IconTrash width={18} height={18} />} className="text-danger" onClick={() => setConfirmForget(true)} disabled={!anyKey && !remember}>
            {t.settings.forgetAll}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-surface-2 p-3">
        <IconInfo className="mt-0.5 shrink-0 text-muted" />
        <div className="text-sm">
          <h3 className="font-bold">{t.settings.localTitle}</h3>
          <p className="text-muted">{t.settings.localBody}</p>
        </div>
      </div>

      <details className="rounded-lg border border-border px-3 text-caption text-muted">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t.settings.chatPlanQ}</summary>
        <p className="pb-3">{t.settings.chatPlanA}</p>
      </details>

      <ConfirmDialog
        open={confirmForget}
        title={t.settings.forgetTitle}
        body={t.settings.forgetBody}
        confirmLabel={t.settings.forgetAll}
        danger
        onCancel={() => setConfirmForget(false)}
        onConfirm={() => {
          forgetAllKeys();
          setConfirmForget(false);
          toast(t.settings.forgetDone, { tone: 'success' });
        }}
      />
    </>
  );
}
