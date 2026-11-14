import 'server-only';
import { NextResponse } from 'next/server';
import { MAX_BODY_BYTES } from '@/lib/limits';

/** JSON response that no browser, proxy or CDN may cache (requests and answers can carry keys or user text). */
export function json(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

/**
 * Parse a JSON body without letting a parser error echo part of it (which could contain a key)
 * into logs or the response. Returns null on malformed or oversized input.
 */
export async function readJson<T>(req: Request, maxBytes = MAX_BODY_BYTES): Promise<T | null> {
  const declared = Number(req.headers.get('content-length'));
  if (declared > maxBytes) return null;
  try {
    const raw = await req.text();
    // the header can be missing or wrong (chunked uploads), so check the body too (in characters, close enough)
    if (raw.length > maxBytes) return null;
    const body = JSON.parse(raw) as unknown;
    return body && typeof body === 'object' ? (body as T) : null;
  } catch {
    return null;
  }
}
