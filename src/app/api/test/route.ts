import { getEntitlement } from '@/lib/server/entitlement';
import { json, readJson } from '@/lib/server/http';
import { ProviderError, chatJson, publicError, resolveAccess } from '@/lib/server/llm';
import { isProviderId, type ProviderId } from '@/lib/types';

export const runtime = 'nodejs';

/** Minimal round-trip to verify provider, key and model. Works for every provider in PROVIDER_IDS. */
export async function POST(req: Request) {
  const b = await readJson<{ provider: ProviderId; apiKey?: string; model: string }>(req);
  if (!b || !isProviderId(b.provider)) return json({ ok: false, error: 'bad_request' }, { status: 400 });
  try {
    const { provider, apiKey, model } = resolveAccess(await getEntitlement(req), b);
    const text = await chatJson({
      provider,
      apiKey,
      model,
      system: 'Reply with the JSON object {"ok": true} and nothing else.',
      user: 'ping',
      maxTokens: 2000,
      signal: req.signal,
    });
    return json({ ok: /ok/.test(text) });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    const code = e instanceof ProviderError ? e.code : 'unknown';
    return json({ ok: false, code, error: publicError(e, [b.apiKey]) }, { status });
  }
}
