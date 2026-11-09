import { json } from '@/lib/server/http';
import { listOpenRouterModels } from '@/lib/server/llm';

// The upstream catalog fetch is cached for an hour (next.revalidate); our own response is not cached.
export const dynamic = 'force-dynamic';

/**
 * OpenRouter's public model catalog (chat models, plus decision models with ?kind=decisions).
 * No key is involved. Direct providers (OpenAI, Anthropic, Google, xAI) use the curated
 * suggestions in src/lib/store.ts (MODEL_SUGGESTIONS) because their model lists need a key.
 */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind === 'decisions') {
    const res = await fetch('https://openrouter.ai/api/v1/models?output_modalities=decisions', { next: { revalidate: 3600 } });
    const data = res.ok ? await res.json() : { data: [] };
    return json(
      (data.data || [])
        .filter((m: { endpoints?: string[] }) => !m.endpoints || m.endpoints.includes('/api/alpha/decisions'))
        .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })),
    );
  }
  return json(await listOpenRouterModels());
}
