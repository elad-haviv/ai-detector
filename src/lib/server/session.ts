/**
 * Stateless signed session (no database, nothing written server-side).
 *
 * Token format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload part, SESSION_SECRET))>`.
 * The payload is readable by anyone holding the cookie (it is the user's own email and plan), but it
 * cannot be changed without the secret. Verification uses a constant-time compare and checks `exp`.
 *
 * This file has no value imports other than node:crypto so it can be unit-tested with plain Node
 * (`node --conditions=react-server --experimental-strip-types`).
 */
import 'server-only';
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export const SESSION_COOKIE = 'penprint_session';
export const OAUTH_COOKIE = 'penprint_oauth';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, seconds
export const OAUTH_MAX_AGE = 10 * 60; // 10 minutes

/** Cached subscription state inside the session (Paddle stays the source of truth). */
export interface SessionSub {
  /** Paddle status (active, trialing, past_due, …) or `none` when no subscription was found. */
  status: string;
  plan: 'pro' | 'free';
  customerId: string;
  /** ms epoch of the last Paddle lookup. */
  checkedAt: number;
  /** ISO date of the next renewal, when known. */
  renewsAt?: string;
  /** ISO date when a scheduled cancellation takes effect. */
  cancelsAt?: string;
  /** ms epoch until which a past_due subscription still counts as Pro. */
  graceUntil?: number;
}

export interface SessionPayload {
  email: string;
  name?: string;
  /** seconds since epoch */
  iat: number;
  /** seconds since epoch */
  exp: number;
  sub?: SessionSub;
}

export function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function mac(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** A secret shorter than 32 characters is treated as missing (sign-in is then disabled). */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

/** Sign any JSON object. */
export function signToken(payload: object, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(mac(body, secret))}`;
}

/**
 * Verify a token and return its payload, or null when the signature is wrong, the format is off, or
 * `exp` (seconds) has passed. Never throws.
 */
export function verifyToken<T extends { exp: number }>(token: string | undefined | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): T | null {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  const expected = mac(body, secret);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSession(email: string, name: string | undefined, sub?: SessionSub, nowSec = Math.floor(Date.now() / 1000)): SessionPayload {
  return { email, ...(name ? { name } : {}), iat: nowSec, exp: nowSec + SESSION_MAX_AGE, ...(sub ? { sub } : {}) };
}

/** Read one cookie from a request's Cookie header. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      const v = part.slice(i + 1).trim();
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

/** Verified session from the request cookie, or null. */
export function readSession(req: Request): SessionPayload | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const s = verifyToken<SessionPayload>(readCookie(req, SESSION_COOKIE), secret);
  return s && typeof s.email === 'string' && s.email.includes('@') ? s : null;
}

/** Public origin of the app: APP_URL when set, else the request's own origin. */
export function appOrigin(req: Request): string {
  const env = process.env.APP_URL?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {}
  }
  return new URL(req.url).origin;
}

/** Cookies are Secure everywhere except plain http on localhost (local development). */
export function secureCookies(origin: string): boolean {
  try {
    const u = new URL(origin);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    return !(local && u.protocol === 'http:');
  } catch {
    return true;
  }
}

export function cookieHeader(name: string, value: string, opts: { maxAge: number; secure: boolean; path?: string; httpOnly?: boolean }): string {
  return [
    `${name}=${value}`,
    `Path=${opts.path || '/'}`,
    `Max-Age=${opts.maxAge}`,
    opts.httpOnly === false ? '' : 'HttpOnly',
    opts.secure ? 'Secure' : '',
    'SameSite=Lax',
  ]
    .filter(Boolean)
    .join('; ');
}

export function sessionCookie(payload: SessionPayload, secret: string, origin: string): string {
  return cookieHeader(SESSION_COOKIE, signToken(payload, secret), { maxAge: SESSION_MAX_AGE, secure: secureCookies(origin) });
}

export function clearCookie(name: string, origin: string, path = '/'): string {
  return cookieHeader(name, '', { maxAge: 0, secure: secureCookies(origin), path });
}

/**
 * Only same-origin relative paths are allowed as a post-login destination: must start with a single
 * "/", no "//" or "/\" (protocol-relative), no backslashes or control characters, no scheme.
 */
export function safeReturnTo(value: unknown, fallback = '/account'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const u = new URL(value, 'http://x.invalid');
    if (u.origin !== 'http://x.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Random URL-safe string (state, PKCE verifier). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** PKCE S256 code challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
