import { NextResponse } from 'next/server';
import { listOpenRouterModels } from '@/lib/server/llm';

export const revalidate = 3600;

/** OpenRouter's public model catalog (chat models, plus decision models with ?kind=decisions). */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind === 'decisions') {
    const res = await fetch('https://openrouter.ai/api/v1/models?output_modalities=decisions', { next: { revalidate: 3600 } });
    const data = res.ok ? await res.json() : { data: [] };
    return NextResponse.json(
      (data.data || [])
        .filter((m: { endpoints?: string[] }) => !m.endpoints || m.endpoints.includes('/api/alpha/decisions'))
        .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })),
    );
  }
  return NextResponse.json(await listOpenRouterModels());
}
