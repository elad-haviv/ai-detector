/**
 * Sign in with Google: OAuth 2.0 authorization code flow with PKCE, written by hand with fetch.
 *
 * We only need the verified email and the display name. They come from the id_token returned by
 * Google's token endpoint in the server-to-server code exchange (over TLS, authenticated with our
 * client secret), so per OpenID Connect Core §3.1.3.7 the signature check may be skipped for a token
 * received this way. We still verify `iss`, `aud`, `exp` and `email_verified`. Nothing is stored:
 * the claims go straight into the signed session cookie.
 */
import 'server-only';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

/** `hl` sets the language of Google's consent screen (we pass the UI language). */
export function authorizeUrl(args: { clientId: string; redirectUri: string; state: string; challenge: string; hl?: string }): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', args.state);
  u.searchParams.set('code_challenge', args.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('prompt', 'select_account');
  if (args.hl) u.searchParams.set('hl', args.hl);
  return u.toString();
}

export interface GoogleIdentity {
  email: string;
  name?: string;
}

/** Decode the claims part of a JWT (no signature check, see the note at the top of this file). */
export function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

/** Validate id_token claims; returns the identity or null. */
export function identityFromClaims(claims: Record<string, unknown> | null, clientId: string, nowSec = Math.floor(Date.now() / 1000)): GoogleIdentity | null {
  if (!claims) return null;
  const aud = claims.aud;
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  if (!audOk) return null;
  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) return null;
  if (typeof claims.exp !== 'number' || claims.exp <= nowSec - 60) return null;
  if (claims.email_verified !== true && claims.email_verified !== 'true') return null;
  if (typeof claims.email !== 'string' || !claims.email.includes('@')) return null;
  const name = typeof claims.name === 'string' ? claims.name.slice(0, 120) : undefined;
  return { email: claims.email.toLowerCase(), name };
}

/** Exchange the authorization code; returns the identity from the id_token. */
export async function exchangeCode(args: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string; fetchImpl?: typeof fetch }): Promise<GoogleIdentity | null> {
  const res = await (args.fetchImpl || fetch)(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: args.verifier,
    }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (typeof data.id_token !== 'string') return null;
  return identityFromClaims(decodeJwtClaims(data.id_token), args.clientId);
}
