# Design Spec: AI Writing Detector + Writing Coach

Tone: calm, scholarly, trustworthy. It should feel like a careful reader's margin notes, not a security scanner. Use paper-like surfaces, ink-blue accents and warm highlights. No neon, no glow, no red alarm states for normal findings.

UI language: Hebrew, `<html lang="he" dir="rtl">`. Analyzed text: every paragraph/sentence container gets `dir="auto"`. Use logical CSS properties throughout (`ps-*`, `me-*`, `start-*`, `border-s`), never left/right.

---

## 1. Information Architecture

```
/            ניתוח (Analyze): input → progress → results/editor (one workspace)
/history     היסטוריה: list of past analyses (localStorage/IndexedDB)
/settings    הגדרות: provider, API key, model, sensitivity, explanation language
(later) /account, /pricing
```

Top bar (desktop) or bottom tab bar (mobile) has three entries: ניתוח · היסטוריה · הגדרות. The workspace has three states: **Empty/Input → Analyzing → Results (editable)**.

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

```css
:root {
  --bg:#FAF8F4; --surface:#FFFFFF; --surface-2:#F3EFE7; --border:#E3DDD1;
  --text:#1F2328; --text-muted:#5C6370; --accent:#2B4C7E; --accent-fg:#FFFFFF;
  --focus:#3B6FD8; --success:#2F6F5E; --warning:#9A6200; --danger:#A33A3A;
  --hl-1-bg:#FDF1D6; --hl-1-line:#C99A2E;
  --hl-2-bg:#F9DDB0; --hl-2-line:#B5701C;
  --hl-3-bg:#F2C08F; --hl-3-line:#8A4510; --hl-3-badge:#8A4510;
}
.dark {
  --bg:#14161A; --surface:#1C1F24; --surface-2:#23272E; --border:#30353D;
  --text:#E8E6E1; --text-muted:#A0A6B0; --accent:#8FB0E6; --accent-fg:#0F1726;
  --focus:#8FB0E6; --success:#7CC3AE; --warning:#E2B45C; --danger:#E08A8A;
  --hl-1-bg:rgb(214 160 60/.16); --hl-1-line:#C9A35A;
  --hl-2-bg:rgb(214 140 50/.26); --hl-2-line:#D9944A;
  --hl-3-bg:rgb(214 120 40/.38); --hl-3-line:#F0A866; --hl-3-badge:#F0A866;
}
```
Tailwind: `darkMode: 'class'` (default to `prefers-color-scheme`, overridable in Settings). Map the tokens in `theme.extend.colors` (`bg: 'var(--bg)'`, `hl1: { bg: 'var(--hl-1-bg)', line: 'var(--hl-1-line)' }`, …). In dark mode, the band-3 badge uses dark text (`--bg`).

## 7. Components

- **AppShell**: header / tab bar, theme toggle.
- **InputPanel**: Textarea (autosize, `dir="auto"`), FileDropZone, FilePickerButton, word/char counter, "נתח" primary button (disabled < 50 words, with a hint).
- **ProgressPanel**: per-chunk list. Each row has its chunk index, a status icon (pending / running / done / failed + retry), and a mini bar. Includes an overall bar and a cancel button. Heuristic results render immediately. LLM results stream in per chunk.
- **ScoreCard**: ring/meter 0–100, confidence label (נמוך/בינוני/גבוה), one-line plain summary, band legend.
- **DocumentView**: paragraphs → SentenceSpan (band, badge, selected, edited states). Contenteditable in edit mode.
- **Inspector / SentenceSheet** (same content component): probability + band, PatternList (PatternChip: category icon + name + one-line "why"), Explanation, RewriteCard (diff-style suggestion with **העתק** / **החל** / "הצע אחר"), prev/next.
- **FilterBar**: 7 category toggle chips (אוצר מילים, מבנה, טון, עיצוב, רטוריקה, ציטוט, מילוי) with counts. ThresholdSlider (0–100, default from sensitivity, live re-render).
- **SummaryPanel**: Top patterns (name × count, clickable → filters the doc), StatTiles: burstiness (sentence-length variance, with a short "human texts vary more" hint), lexical diversity (MTLD/TTR), avg sentence length, sentence count.
- **HistoryList**: cards with title, date, score pill, language, word count. Actions: open, duplicate, delete. Has a search box.
- **SettingsForm**: ProviderSelect (4 radio cards), ApiKeyField (masked, show/hide, "נשמר מקומית בדפדפן בלבד" notice, test-connection button), ModelSelect (fetched list + free text), Sensitivity (שמרני/מאוזן/רגיש → threshold 70/55/40), ExplanationLanguage (עברית/English/כשפת הטקסט), theme.
- Primitives: Button (primary/secondary/ghost), IconButton, Chip, Pill, Toast, Dialog, BottomSheet, Drawer, Tooltip, Skeleton, Kbd.

## 8. States

- **Empty (first run, no key)**: a calm illustration-free card titled "הדביקו טקסט או העלו קובץ" with supported formats listed. If no API key is set, show an inline banner "חברו ספק AI כדי לקבל ניתוח מלא" → Settings. Heuristic-only analysis still works and is labelled "ניתוח מקומי בלבד".
- **Loading**: per-chunk progress; skeleton lines on the document; the score shows "—" until ≥1 chunk finishes, then updates provisionally ("זמני").
- **Partial failure**: failed chunks get a neutral grey hatched background + "נכשל · נסה שוב". The score is computed from the done chunks, with a notice.
- **Errors**: invalid key (401) → link to Settings; rate limit → auto-retry countdown; network → retry; unsupported/oversized/scanned PDF with no text → explain + suggest pasting. Errors appear inline near the source, not as modal walls. Messages are in Hebrew, with the provider's message collapsible.
- **No findings**: "לא נמצאו משפטים מעל הסף" + a suggestion to lower the threshold.
- **History empty**: "עדיין אין ניתוחים שמורים".

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
