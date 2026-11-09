# Penprint (טביעת עט): spot and fix AI-style writing

Penprint analyzes academic text in Hebrew and English, sentence by sentence. It highlights sentences that read like language-model output, shows a likelihood (never a verdict), explains what led to it, and suggests a rewrite in the author's own voice. The main README is in Hebrew (`README.md`); this is a short English overview.

## How detection works

Each sentence gets a weighted score from a language model (OpenRouter, OpenAI, Anthropic, Google AI Studio or xAI), an optional decision model (e.g. TypeSafe's Jev via OpenRouter Decisions) and local rules (`src/lib/patterns/catalog.ts`, built from Wikipedia's "Signs of AI writing", stop-slop and humanizer, with Hebrew equivalents). Without a key the site runs on local rules only.

## Three ways to use it

1. **Your own API key (free, BYOK).** Keys stay in the browser: this tab only (`sessionStorage`) by default, or "Remember on this device" (`localStorage`). The server passes a key to the provider for one request and forgets it.
2. **Pro subscription.** Sign in with Google, pay through Paddle (Merchant of Record); requests then use the operator's server-side keys. There is no database: identity lives in a signed `penprint_session` cookie, and the subscription is looked up in Paddle by email.
3. **Local rules only**, with no key and no account.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
```

Configuration is in `.env.example` (Google OAuth, Paddle, managed-mode keys). Docker: `Dockerfile` (Next.js standalone).

## Languages

The UI is Hebrew (RTL) and English (LTR). Strings live in `src/lib/i18n/` (`he.ts`, `en.ts`, `legal.he.ts`, `legal.en.ts`); the dictionary type is derived from the Hebrew file, so a missing English key fails the build. The language comes from the `penprint_lang` cookie; without it, from `Accept-Language` (the first of he/iw/en in preference order), falling back to Hebrew. Switch with the header button or Settings → Display. See `docs/design-spec.md` §14.

## Cookies

Essential only: `penprint_session` (sign-in, 30 days), `penprint_oauth` (Google sign-in, 10 minutes), `penprint_lang` (interface language, 12 months, set only when you switch), `penprint_consent` (cookie-notice choice, 12 months).

## Checks

- `npm run lint`, `npm run build`
- `npm run check:m3`: unit checks (session signing, PKCE, Google claims, Paddle with a fake fetch, rate limit, locale resolution, he/en dictionary parity, English pattern text).
- `A11Y_BASE_URL=http://localhost:3000 npm run a11y`: axe-core audit (SI 5568 / WCAG 2.1 AA) of every route and main state, in Hebrew and English, light and dark, at 1280px and 320px.

The accessibility statement is at `/accessibility` (Israeli Standard SI 5568, level AA).
