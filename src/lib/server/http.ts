import 'server-only';
import { NextResponse } from 'next/server';

/** JSON response that no browser, proxy or CDN may cache (requests and answers can carry keys or user text). */
export function json(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

/**
 * Parse a JSON body without letting a parser error echo part of it (which could contain a key)
 * into logs or the response. Returns null on malformed input.
 */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === 'object' ? (body as T) : null;
  } catch {
    return null;
  }
}
