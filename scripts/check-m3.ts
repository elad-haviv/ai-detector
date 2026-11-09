/**
 * Unit checks for the stateless account pieces (no network, no server):
 *   node --conditions=react-server --experimental-strip-types scripts/check-m3.ts
 * (also `npm run check:m3`). `react-server` makes the `server-only` marker import a no-op.
 */
import assert from 'node:assert/strict';
import { newSession, safeReturnTo, signToken, verifyToken, pkceChallenge, readCookie, secureCookies, type SessionPayload } from '../src/lib/server/session.ts';
import { identityFromClaims } from '../src/lib/server/google.ts';
import { createPaddleBilling } from '../src/lib/server/billing/paddle.ts';
import { takeToken, resetRateLimit } from '../src/lib/server/rateLimit.ts';

const SECRET = 'x'.repeat(40);
let n = 0;
const ok = (name: string) => console.log(`ok ${++n} - ${name}`);

// --- session sign / verify ---
const s = newSession('a@b.co', 'אבי', { status: 'active', plan: 'pro', customerId: 'ctm_1', checkedAt: Date.now() });
const tok = signToken(s, SECRET);
assert.equal(verifyToken<SessionPayload>(tok, SECRET)?.email, 'a@b.co');
ok('valid token verifies');

const [body, sig] = tok.split('.');
const forged = Buffer.from(JSON.stringify({ ...s, email: 'evil@x.co' })).toString('base64url');
assert.equal(verifyToken(`${forged}.${sig}`, SECRET), null);
ok('changed payload with old signature is rejected');
const flipped = sig.slice(0, -2) + (sig.at(-2) === 'A' ? 'B' : 'A') + sig.at(-1);
assert.equal(verifyToken(`${body}.${flipped}`, SECRET), null);
ok('changed signature is rejected');
assert.equal(verifyToken(tok, 'y'.repeat(40)), null);
ok('wrong secret is rejected');
assert.equal(verifyToken(signToken({ ...s, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET), SECRET), null);
ok('expired token is rejected');
for (const bad of ['', 'abc', 'a.b.c', `${body}.`, `.${sig}`, `${body}.${sig}=`, 'x'.repeat(5000)]) assert.equal(verifyToken(bad, SECRET), null);
ok('malformed tokens are rejected');
assert.equal(verifyToken(`${body.slice(0, -1)}.${sig}`, SECRET), null);
ok('truncated payload is rejected');

// --- cookies ---
const req = new Request('http://localhost/', { headers: { cookie: `foo=1; kulmus_session=${tok}; bar=2` } });
assert.equal(readCookie(req, 'kulmus_session'), tok);
assert.equal(secureCookies('http://localhost:3125'), false);
assert.equal(secureCookies('https://kulmus.app'), true);
assert.equal(secureCookies('http://kulmus.app'), true);
ok('cookie parsing and Secure flag');

// --- returnTo ---
const good: [string, string][] = [
  ['/pricing?checkout=1&period=yearly', '/pricing?checkout=1&period=yearly'],
  ['/account', '/account'],
  ['/settings#access', '/settings#access'],
];
for (const [i, o] of good) assert.equal(safeReturnTo(i), o);
for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'evil.com', '/\u0000x', '\\\\evil.com', '', null, 42, '/x\ny'])
  assert.equal(safeReturnTo(bad), '/account', String(bad));
ok('returnTo accepts same-origin paths only');

// PKCE (RFC 7636 appendix B test vector)
assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
ok('PKCE S256 challenge');

// --- Google id_token claims ---
const now = Math.floor(Date.now() / 1000);
const claims = { iss: 'https://accounts.google.com', aud: 'cid', exp: now + 300, email: 'A@B.co', email_verified: true, name: 'A' };
assert.deepEqual(identityFromClaims(claims, 'cid'), { email: 'a@b.co', name: 'A' });
assert.equal(identityFromClaims({ ...claims, aud: 'other' }, 'cid'), null);
assert.equal(identityFromClaims({ ...claims, iss: 'https://evil.com' }, 'cid'), null);
assert.equal(identityFromClaims({ ...claims, exp: now - 3600 }, 'cid'), null);
assert.equal(identityFromClaims({ ...claims, email_verified: false }, 'cid'), null);
ok('id_token claims: aud, iss, exp, email_verified');

// --- Paddle with a fake fetch ---
const calls: { url: string; method: string; auth: string | null; body?: string }[] = [];
const fake = (routes: Record<string, unknown>, status = 200): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', auth: new Headers(init?.headers).get('authorization'), body: init?.body as string | undefined });
    const key = Object.keys(routes).find((k) => url.includes(k));
    return new Response(JSON.stringify(key ? routes[key] : { data: [] }), { status });
  }) as typeof fetch;

const paddle = createPaddleBilling({
  apiKey: 'pdl_test',
  env: 'sandbox',
  fetchImpl: fake({
    '/customers?email=': { data: [{ id: 'ctm_01', email: 'a@b.co' }] },
    '/subscriptions?': {
      data: [
        { id: 'sub_pd', status: 'past_due', customer_id: 'ctm_01', current_billing_period: { starts_at: new Date().toISOString() } },
        { id: 'sub_act', status: 'active', customer_id: 'ctm_01', next_billed_at: '2026-12-09T00:00:00Z', scheduled_change: null },
      ],
    },
    '/portal-sessions': { data: { urls: { general: { overview: 'https://customer-portal.paddle.com/cpl_1' } } } },
  }),
});
const sub = await paddle.findActiveSubscription('A@B.co');
assert.equal(sub?.id, 'sub_act');
assert.equal(sub?.renewsAt, '2026-12-09T00:00:00Z');
assert.equal(calls[0].url, 'https://sandbox-api.paddle.com/customers?email=a%40b.co');
assert.equal(calls[0].auth, 'Bearer pdl_test');
assert.equal(calls[1].url, 'https://sandbox-api.paddle.com/subscriptions?customer_id=ctm_01&status=active,trialing,past_due');
ok('Paddle lookup: customer by email, then best subscription');

const url = await paddle.createPortalUrl('ctm_01', ['sub_act']);
assert.equal(url, 'https://customer-portal.paddle.com/cpl_1');
assert.equal(calls[2].method, 'POST');
assert.equal(calls[2].url, 'https://sandbox-api.paddle.com/customers/ctm_01/portal-sessions');
assert.deepEqual(JSON.parse(calls[2].body!), { subscription_ids: ['sub_act'] });
ok('Paddle portal session');
await assert.rejects(paddle.createPortalUrl('../admin', []));
ok('portal rejects a malformed customer id');

const none = createPaddleBilling({ apiKey: 'k', env: 'production', fetchImpl: fake({ '/customers?email=': { data: [] } }) });
assert.equal(await none.findActiveSubscription('x@y.co'), null);
const pastDue = createPaddleBilling({
  apiKey: 'k',
  env: 'production',
  fetchImpl: fake({
    '/customers?email=': { data: [{ id: 'ctm_2' }] },
    '/subscriptions?': { data: [{ id: 'sub_2', status: 'past_due', customer_id: 'ctm_2', current_billing_period: { starts_at: '2026-11-01T00:00:00Z' } }] },
  }),
  pastDueGraceDays: 14,
});
const pd = await pastDue.findActiveSubscription('x@y.co');
assert.equal(pd?.graceUntil, Date.parse('2026-11-15T00:00:00Z'));
ok('no customer → null; past_due gets a grace deadline');
const down = createPaddleBilling({ apiKey: 'k', env: 'sandbox', fetchImpl: fake({}, 500) });
await assert.rejects(down.findActiveSubscription('x@y.co'));
ok('Paddle errors throw (callers fail closed)');

// --- rate limit ---
resetRateLimit();
const t0 = 1_000_000;
for (let i = 0; i < 3; i++) assert.equal(takeToken('a@b.co', 3, t0 + i).ok, true);
const blocked = takeToken('a@b.co', 3, t0 + 10);
assert.equal(blocked.ok, false);
assert.ok(blocked.retryAfter > 3500);
assert.equal(takeToken('c@d.co', 3, t0 + 10).ok, true);
assert.equal(takeToken('a@b.co', 3, t0 + 60 * 60 * 1000 + 1).ok, true);
ok('sliding-window rate limit per email');

console.log(`\nall ${n} checks passed`);
