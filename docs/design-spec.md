# Design Spec: AI Writing Detector + Writing Coach

Tone: calm, scholarly, trustworthy. It should feel like a careful reader's margin notes, not a security scanner. Use paper-like surfaces, ink-blue accents and warm highlights. No neon, no glow, no red alarm states for normal findings.

UI language: Hebrew, `<html lang="he" dir="rtl">`. Analyzed text: every paragraph/sentence container gets `dir="auto"`. Use logical CSS properties throughout (`ps-*`, `me-*`, `start-*`, `border-s`), never left/right.

---

## 1. Information Architecture

```
/              ניתוח (Analyze): input → progress → results/editor (one workspace)
/history       היסטוריה: past analyses (localStorage + IndexedDB for .docx files)
/settings      הגדרות: sections גישה (#access) · ניתוח (#analysis) · תצוגה (#display)
/pricing       Free (BYOK) vs Pro cards, monthly/yearly toggle, Paddle overlay checkout, FAQ
/account       Google sign-in / plan status, renew date, manage billing (Paddle portal), refresh, sign out
/privacy /terms   Hebrew legal pages (LegalPage, anchored sections, cookie table; stacked cards <640px)
/accessibility  stub until M4
```

**AppShell** (`src/components/AppShell.tsx`): skip link "דילוג לתוכן הראשי" → `<main id="main">`; `<header>` with logo, desktop `<nav aria-label="ניווט ראשי">` (`aria-current="page"` on the active link), and the **header status slot** (`data-slot="header-status"`): the access chip (`AccessChip`: "המפתח שלך · <provider>" when the chosen provider has a key in the browser key store, "Pro" for a subscriber, else "כללים מקומיים בלבד"; links to `/settings#access`) and the account button (`AccountButton`: avatar initial → /account, or "התחברות"). The chip follows `llmMode()`: BYOK key wins, then Pro, then local. `<footer>` with privacy · terms · accessibility statement links and a "הגדרות עוגיות" button that dispatches `kulmus:open-cookie-settings` (`CookieConsent` calls `preventDefault()` and opens its Dialog; the first-visit banner is a non-modal bottom `role=region` above the mobile tab bar, and the page gets matching bottom padding). Mobile (<768px): bottom tab bar with the same three entries; the footer pads for it. The workspace has three states: **Input → Analyzing → Results (editable)**.

## 2. Layouts

### Desktop (≥1024px), three columns, RTL order
| Start (right) | Center | End (left) |
|---|---|---|
| **Summary rail** 280px: score card, category filters, threshold slider, top patterns, stats | **Document** max 720px (~68ch), serif, editable | **Inspector** 360px: details of the selected sentence; when nothing is selected, a "choose a sentence" hint |

- Sticky header (56px): logo, doc title (editable), "נתח מחדש" button, provider/model chip, nav.
- 1024–1279px: the summary rail collapses into a drawer opened by a toggle button. The inspector stays.
- Input state: a centered 720px card with a textarea and a drop zone. Drag a file anywhere on the window → full-window overlay "שחררו כאן את הקובץ".

### Mobile (<768px)
- **Sticky score bar** (top, 52px): score ring (32px) + "73% · ביטחון בינוני" + filter icon button + re-analyze icon.
- Document fills the width with a 16px gutter and 17px serif text.
- **Bottom sheet** for sentence details: peek at 40% height (percentage, patterns, rewrite preview), drag up to 90% for the full content, swipe down to close. In the sheet header, "הקודם/הבא" arrows step through suspicious sentences.
- Filters + summary live in a full-height sheet opened from the score bar.
- Bottom tab bar (56px + safe-area inset). It hides while the user types in edit mode.
- Input: a large "העלאת קובץ" button (native picker, `accept=".txt,.md,.docx,.pdf"`) above the textarea. There is no drag-and-drop on mobile.

Tablet (768–1023px): document + inspector as a right-side sheet. Summary appears in the score bar dropdown.

## 3. Highlight Scale (accessible, colour-blind safe)

Use a single-hue sequential **amber → burnt-sienna** scale. Luminance carries the meaning, so it stays readable under deuteranopia, protanopia and tritanopia. Avoid red/green. Every band is encoded **three ways**: background tint + underline style + % badge.

| Band | Range | Label | Background | Underline | Badge |
|---|---|---|---|---|---|
| 0 | < threshold | — | none | none | none |
| 1 | thr–59% | אפשרי | `--hl-1-bg` | 1.5px **dotted** `--hl-1-line` | outline pill |
| 2 | 60–79% | סביר | `--hl-2-bg` | 2px **dashed** | tinted pill |
| 3 | 80–100% | סביר מאוד | `--hl-3-bg` | 2.5px **solid** (thick-ish, wavy optional) | solid pill, white text |

- Badge: a small superscript pill after the sentence end (`73%`, 11px, tabular numerals). With dense highlights, show badges only for band ≥2 and on hover/focus (setting: "הצג אחוזים תמיד").
- Text on every background ≥ 4.5:1 (verify in both themes). Highlights tint the background only and never change text colour.
- Selected sentence: 2px `--focus` outline ring with 2px offset + `aria-current="true"`.
- Rewritten (applied) sentence: green-free marker. Use a thin `--accent` start-border + "✎ נערך" chip until re-analysis.
- Each sentence span: `role="button" tabindex="-1" aria-label="משפט חשוד, 73%, סביר"`.
- Legend under the score card shows all three bands with their underline samples.

## 4. Typography

Google Fonts: **Assistant** (UI, 400/600/700), **Frank Ruhl Libre** (document Hebrew, 400/500/700), **Source Serif 4** (document Latin, falls back within the stack), **JetBrains Mono** (only for API keys/model IDs).

```css
--font-ui: "Assistant", system-ui, sans-serif;
--font-doc: "Frank Ruhl Libre", "Source Serif 4", "Noto Serif Hebrew", Georgia, serif;
```
| Role | Size / line-height | Weight |
|---|---|---|
| Doc body | 18/1.75 desktop, 17/1.7 mobile | 400 |
| Doc headings | 24/1.3, 20/1.35 | 700 |
| UI body | 15/1.5 | 400 |
| UI label / caption | 13/1.4 | 600 / 400 |
| Score numeral | 40/1, `tabular-nums` | 700 |
| Page title | 22/1.3 | 700 |

Hebrew needs slightly more line-height than English. Keep 1.75 for mixed text. Never use italics for Hebrew. Use weight or tint for emphasis instead.

## 5. Spacing, Shape, Elevation

4px base scale: 4, 8, 12, 16, 24, 32, 48, 64 (Tailwind defaults). Radii: 6px inputs/pills, 10px cards, 16px sheets (top corners). Shadows: one soft level (`0 1px 2px rgb(0 0 0/.06), 0 4px 16px rgb(0 0 0/.06)`). In dark mode, use borders instead of shadows. Touch targets ≥ 44px.

## 6. Design Tokens

All tokens live in `src/app/globals.css` (`:root` light, `.dark` dark) and are exposed to Tailwind via `@theme inline` (`bg-surface`, `text-muted`, `border-border-strong`, `bg-accent-soft`, …). Values from the original palette, with these M1 additions and changes:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--border` | #E3DDD1 | #30353D | decorative card edges only |
| `--border-strong` | #8A8478 (3.5:1 on bg) | #737A86 (4.2:1) | every control edge (inputs, secondary buttons, segmented, radio cards) |
| `--accent-soft` | accent @10% | accent @14% | selected nav item / chosen option tint |
| `--warning` | **#8A5700** (was #9A6200; now ≥5.3:1 on surface-2) | #E2B45C | warning text |
| `--danger-fg` | #FFF | #14161A | text on danger buttons |
| `--shadow-lg` | soft | deep | dialogs, toasts |
| `--radius-control/card/sheet` | 6 / 10 / 16px | | |

Checked contrast: all text tokens ≥4.5:1 on `--bg`, `--surface`, `--surface-2` in both themes; `--focus` (#3B6FD8 / #8FB0E6) and `--border-strong` ≥3:1.

**Type scale** is rem-based so the text-size setting scales everything: `text-micro` 11, `text-xs` 12, `text-caption` 13, `text-sm` 14, `text-ui` 15 (body), `text-base` 16, `text-h2` 17, `text-lg` 18, `text-title` 22. Never use `text-[Npx]`.

**Text size** (Settings → תצוגה): `normal | large | larger` → root class `text-size-large` (112.5%) / `text-size-larger` (125%), applied before paint by the inline script in `layout.tsx` and kept in sync by `useApplyTextSize`.

**Focus**: `:focus-visible` = 2px `--focus` outline, 2px offset (inset on the tab bar). **Motion**: `prefers-reduced-motion` disables animations/transitions and JS smooth scrolling.

## 7. Components

Reusable primitives in `src/components/ui/` (import from `@/components/ui`):

| Component | Key props | Notes |
|---|---|---|
| `Button` | `variant` primary·secondary·ghost·danger·link, `size` sm·md·lg, `icon`, `iconOnly` (+`aria-label`) | ≥44px at md. A `text-<colour>` in `className` replaces the variant colour. `buttonClass()` and `ButtonLink` (next/link) share the look. |
| `Field` | `label`, `hint`, `error`, `id?`, `labelAside`, `children(props)` | Render-prop: spread `props` (`id`, `aria-describedby` = hint+error, `aria-invalid`) on the control. |
| `Input` / `Textarea` / `Select` | native props | `.control` style: `--border-strong`, 44px min height, red border when `aria-invalid`. |
| `Checkbox` | `label`, `hint`, `checked`, `onChange(bool)` | |
| `Card` / `Section` | `padding`; `Section`: `id`, `title`, `intro` | `Section` = `<section aria-labelledby>` + h2, `id` is the anchor. |
| `SegmentedControl` | `legend`, `hint`, `value`, `options[{value,label,description}]`, `onChange`, `variant` segmented·cards, `columns` | Native radios in a `<fieldset>`: arrow keys and RTL for free. |
| `Dialog` | `open`, `onClose`, `title`, `description`, `footer`, `variant` center·sheet·full, `initialFocus` | Native `<dialog>.showModal()`: inert page, Esc, backdrop click, focus returns to the opener. |
| `ConfirmDialog` | `open`, `title`, `body`, `confirmLabel`, `danger`, `onConfirm`, `onCancel` | Cancel has initial focus. |
| `ToastProvider` / `useToast()` | `toast(message, {tone, action, duration})` | Mounted in AppShell; region is `role="status"` (polite), never steals focus. |

Screen components: **InputPanel** (3-step guide, local-only notice, drop zone + file button, title/text `Field`s with word·char counter, sample link, context disclosure, primary "לנתח את הטקסט" with "חסרות עוד N מילים" hint), **ProgressList** (`role=status` text + `progressbar`), **ResultsView** (sticky toolbar with always-visible band legend and "החשוד הקודם/הבא" buttons + "N מתוך M"; a polite live region announces the selected sentence; the document has one roving tab stop, Enter/Space selects; mobile summary is a full-screen `Dialog`, paragraph rewrite a sheet `Dialog`), **Inspector**, **SummaryPanel**, **DocxView**, **History** (labelled search, count, per-item delete and clear-all through `ConfirmDialog`, toast after deleting, empty state with CTA), **Settings** (three `Section`s with a sticky in-page nav; sensitivity/language/theme/text-size segmented controls). **AccessSection** (`src/components/settings/AccessSection.tsx`, M2): subscription status in `data-slot="subscription"` (active: "המנוי פעיל — אין צורך במפתח"; otherwise a compact upsell to /pricing), provider radio cards (OpenRouter, OpenAI, Anthropic, Google AI Studio, xAI), one panel for the chosen provider ("get a key" new-tab link, masked key field with show/hide, "remember on this device" checkbox, test button announced through the toast region, model Select with suggestions + custom id, disabled ChatGPT sign-in on OpenAI behind `NEXT_PUBLIC_CHATGPT_SIGNIN`), privacy note, "forget all keys" with `ConfirmDialog`, and the local-rules-only explanation. Keys live in `src/lib/keyStore.ts` (sessionStorage by default, localStorage when remembered), never in settings.

## 8. States

- **Empty (first run, no key, not Pro)**: a calm card titled "הדביקו טקסט או העלו קובץ". Above it the **onboarding chooser** (`OnboardingChooser`): מנוי Pro → /pricing · יש לי מפתח API → /settings#access · לנסות עם כללים מקומיים (sets `kulmus:onboarded:v1`). Once dismissed it collapses into the one-line local-only notice; never two banners. Heuristic-only analysis still works and is labelled "ניתוח מקומי בלבד".
- **Loading**: per-chunk progress; skeleton lines on the document; the score shows "—" until ≥1 chunk finishes, then updates provisionally ("זמני").
- **Partial failure**: failed chunks get a neutral grey hatched background + "נכשל · נסה שוב". The score is computed from the done chunks, with a notice.
- **Errors**: invalid key (401) → link to Settings; rate limit → auto-retry countdown; network → retry; unsupported/oversized/scanned PDF with no text → explain + suggest pasting. Errors appear inline near the source, not as modal walls. Messages are in Hebrew, with the provider's message collapsible.
- **No findings**: "לא נמצאו משפטים מעל הסף" + a suggestion to lower the threshold.
- **History empty**: icon + "עוד לא ניתחת טקסטים…" + "לניתוח הראשון" button. Search with no match: "לא נמצאו ניתוחים…".

## 9. Micro-interactions

- Highlights fade in per chunk (150ms opacity). No bouncing.
- Selecting a sentence: smooth-scroll it into the vertical center, inspector content cross-fades (120ms).
- **Apply rewrite**: the sentence text morphs (old fades out, new fades in, 200ms) and gets the "נערך" marker. An "בטל" toast offers undo for 6s. The score card shows "נדרש ניתוח מחדש" (dirty state).
- Re-analyze runs only changed paragraphs (show which ones are re-running).
- Copy → button label becomes "הועתק ✓" for 1.5s.
- Threshold slider updates highlights live (debounced 50ms) and shows a count "23 משפטים".
- Respect `prefers-reduced-motion` by disabling morphs and smooth scroll.

## 10. Keyboard

| Key | Action |
|---|---|
| `j` / `k` | next / previous suspicious sentence (document order, regardless of RTL) |
| `Enter` | open/focus inspector for the current sentence |
| `a` | apply rewrite · `c` copy rewrite |
| `Esc` | close inspector/sheet, return focus to the sentence |
| `1`–`7` | toggle category filters |
| `[` / `]` | threshold −5 / +5 |
| `e` | toggle edit mode · `Ctrl/⌘+Enter` re-analyze |
| `?` | shortcuts dialog |

Shortcuts are disabled while focus is in an input or contenteditable (except Esc and Ctrl+Enter). The document is a roving-tabindex region. All actions are reachable by Tab. Use visible focus rings everywhere. Announce sentence changes via an `aria-live="polite"` region.

## 11. Trust & Copy Guidelines

- Always phrase results as probability, never as a verdict: "סבירות לכתיבת AI", never "נכתב ע״י AI".
- Show a persistent footnote: detection is probabilistic, and results should not serve as sole evidence.
- Show which provider/model + heuristics version produced each result (stored in history).

## 12. Paid Version (later, not designed here)

- **Account**: auth (email/Google), sync history to the cloud, migrate local history on first sign-in.
- **Server-side keys**: a "use our models" option replaces the local API key for paid tiers. BYO-key stays as an advanced option.
- **Usage meter**: words/analyses this month, shown in the header avatar menu + settings, with a soft warning at 80%.
- **Pricing page** (`/pricing`): 3 tiers, Hebrew + English, ILS/USD.
- Add: billing settings, team/shared docs, export report (PDF/DOCX with highlights), onboarding tour. Keep the token system unchanged so these slot in.
