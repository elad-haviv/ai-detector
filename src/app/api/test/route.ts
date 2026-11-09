import { NextResponse } from 'next/server';
import { ProviderError, chatJson, resolveKey } from '@/lib/server/llm';
import type { ProviderId } from '@/lib/types';

export const runtime = 'nodejs';

/** Minimal round-trip to verify provider, key and model. */
export async function POST(req: Request) {
  const b = (await req.json()) as { provider: ProviderId; apiKey?: string; model: string };
  try {
    const text = await chatJson({
      provider: b.provider,
      apiKey: resolveKey(b.provider, b.apiKey),
      model: b.model,
      system: 'Reply with the JSON object {"ok": true} and nothing else.',
      user: 'ping',
      maxTokens: 2000,
    });
    return NextResponse.json({ ok: /ok/.test(text) });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
