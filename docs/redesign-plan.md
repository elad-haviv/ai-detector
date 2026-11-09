# Redesign plan: easier UX, subscription or BYOK, privacy, accessibility

This plan is shared by the milestone agents. Each milestone builds on the previous one and ends with a green `npm run lint` and `npm run build` and a commit.

## Product decisions (fixed)

1. **Two ways to use Kulmus**
   - **Free, bring your own key (BYOK).** Providers: OpenRouter, OpenAI, Anthropic, Google AI Studio, and **xAI (Grok)** as the extra provider (OpenAI-compatible API at `https://api.x.ai/v1`). The key lives only in the user's browser. Default: **this tab only** (`sessionStorage`); opt-in checkbox "remember on this device" (`localStorage`). It is sent per request to our API route, used once to call the provider, and never logged, stored, cached or written to any database or file.
   - **Paid subscription.** The user signs in and pays; requests then use the operator's server-side keys (env vars). Without a valid subscription session, the server **must not** fall back to env keys (today `resolveKey` does that for everyone; this must be closed).
2. **"Sign in with ChatGPT" (use a ChatGPT plan instead of an API key).** OpenAI launched it on 29 Sep 2026 as a limited preview for ~16 approved partners (help.openai.com/en/articles/20001542). Third parties cannot integrate it yet, and reusing the Codex CLI login would break OpenAI's terms. Show it as a disabled "coming soon" option in the OpenAI provider card, behind a feature flag (`NEXT_PUBLIC_CHATGPT_SIGNIN=0`), with a short explanation. No hacks.
3. **No database.** Nothing about users or keys is persisted by us.
   - Identity: **Sign in with Google** (OAuth 2 code flow, done by hand with `fetch`, no auth library needed). The verified email goes into a signed, HttpOnly, Secure, SameSite=Lax session cookie (HMAC-SHA256 with `SESSION_SECRET`, 30 days).
   - Billing: **Paddle Billing** (merchant of record, handles VAT, works for sellers in Israel; Stripe does not onboard Israeli merchants). Paddle is the source of truth: checkout via Paddle.js overlay, the subscription is looked up by customer email through the Paddle API (cached in the signed cookie for ~10 minutes), manage/cancel via the Paddle customer portal. Wrap it behind a small `billing` interface so another provider could be swapped in.
   - Fair use for subscribers: best-effort in-memory per-email rate limit (documented as such).
4. **Cookies and consent.** Essential: session cookie (only after sign-in), consent-choice cookie. Optional: none today. Show a standard bottom consent banner (Hebrew, accessible dialog semantics, "Accept" / "Essential only" / "Details" link to the privacy page) the first time; record the choice; a "cookie settings" link in the footer reopens it. Sign-in buttons explain that signing in sets a cookie. Complies with the spirit of Israel's Privacy Protection Law (Amendment 13) and GDPR-style consent.
5. **Accessibility: Israeli law.** Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations 2013, reg. 35, require Israeli Standard **SI 5568** at level **AA** (based on WCAG 2.0 AA; we target WCAG 2.1 AA). Required: an **accessibility statement** page (הצהרת נגישות) linked from every page, with the accessibility coordinator's name/email/phone placeholders, date of last review, what was done, known limitations, and how to request an accommodation. No overlay widgets. Skip link, landmarks, visible focus, keyboard everything, 4.5:1 contrast, 200% zoom / 320px reflow, reduced motion, form labels and error messages tied to fields, `lang` on mixed-language content, live regions for analysis progress.

## Screens (target IA)

| Route | Purpose |
|---|---|
| `/` | Workspace. First visit with no access configured: a short "choose how to start" panel (Subscribe · Use my own key · Try local rules only) above the input. Otherwise input → analyzing → results. |
| `/pricing` | Free (BYOK) vs Pro (subscription) comparison, FAQ (privacy, keys, cancel anytime), Paddle checkout button. |
| `/account` | Sign in with Google / signed-in state, plan status, manage billing (Paddle portal), sign out. |
| `/settings` | Split into sections: Access (subscription or BYOK provider cards with key field, storage choice, test button, model picker), Analysis (sensitivity, decision model, explanation language), Display (theme, text size, always-show percent). |
| `/history` | Past analyses (local only), search, delete, clear all, empty state. |
| `/privacy` | Privacy policy and cookie policy (Hebrew). |
| `/terms` | Terms of use (Hebrew). |
| `/accessibility` | Accessibility statement (Hebrew). |

Global: header with logo, nav (ניתוח · היסטוריה · הגדרות), access status chip (e.g. "Pro" / "המפתח שלך: Anthropic" / "כללים מקומיים בלבד") that links to the right place, account button. Footer with privacy, terms, accessibility statement, cookie settings. Mobile bottom tab bar as in `docs/design-spec.md`.

## Milestones (run in series)

1. **M1 Design system and screen redesign.** Tokens, typography, components (Button, Field, Card, Dialog, Tabs, Toast) with accessible defaults; redesigned AppShell (skip link, landmarks, header, footer, mobile tabs); redesigned workspace input, results, history, settings layout. Update `docs/design-spec.md`.
2. **M2 Providers and BYOK.** Add xAI; session-only vs remembered key storage with migration from the old `localStorage` settings; never-log guarantees; provider cards with "get a key" links and test; ChatGPT sign-in placeholder; close the env-key fallback (server keys only for a valid subscription, wired up in M3 via a single `getEntitlement(req)` hook).
3. **M3 Accounts, subscription, consent, legal pages.** Google sign-in, signed cookie session, Paddle checkout/lookup/portal, `/pricing`, `/account`, onboarding chooser, rate limit, cookie banner, `/privacy`, `/terms`. `.env.example` and README updated.
4. **M4 Accessibility compliance.** Audit every route with axe-core in Playwright (light and dark, desktop and 320px), fix everything, write `/accessibility`, add `npm run a11y` script.
