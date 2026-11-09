#!/usr/bin/env node
/**
 * Accessibility audit (SI 5568 / WCAG 2.1 AA) with axe-core in Playwright.
 *
 * Starts nothing itself: run the app first (`npm run build && npm start`), then
 *   A11Y_BASE_URL=http://localhost:3000 npm run a11y
 *
 * Every route and the interactive states below are audited in both UI languages (Hebrew RTL and
 * English LTR, chosen with the penprint_lang cookie), in light and dark, at 1280px and 320px, with
 * the tags wcag2a, wcag2aa, wcag21a, wcag21aa. It also checks that <html lang dir> match the
 * language, and at 320px reflow (no horizontal page scroll, WCAG 1.4.10). Exit code 1 on any violation.
 *
 * Optional: A11Y_SESSION_TOKEN=<signed penprint_session value> also audits the signed-in /account.
 * A11Y_ONLY=<substring> limits the run to matching state names. A11Y_LOCALES=he|en|he,en (default
 * both). A11Y_JSON=<path> writes the raw report.
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = (process.env.A11Y_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES = ['light', 'dark'];
const WIDTHS = [1280, 320];
const ONLY = process.env.A11Y_ONLY || '';
const SESSION = process.env.A11Y_SESSION_TOKEN || '';
const CONSENT = { name: 'penprint_consent', value: encodeURIComponent('all.2026-11-09') };
const LOCALES = (process.env.A11Y_LOCALES || 'he,en').split(',').map((l) => l.trim()).filter((l) => l === 'he' || l === 'en');

/** UI labels the script clicks, per language (keep in step with src/lib/i18n/he.ts and en.ts). */
const L = {
  he: { sample: 'לנסות עם טקסט לדוגמה', analyze: 'לנתח את הטקסט', cookieSettings: 'הגדרות עוגיות', nextSuspicious: 'החשוד הבא', summary: 'סיכום וסינון', deleteItem: /^מחיקת "/, test: /בדיקת חיבור/ },
  en: { sample: 'Try a sample text', analyze: 'Analyze the text', cookieSettings: 'Cookie settings', nextSuspicious: 'Next suspicious', summary: 'Summary and filters', deleteItem: /^Delete "/, test: /Test connection/ },
};

/** Wait for client components to mount (most screens render after a mount effect). */
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

/** Choose a visually hidden radio (radio cards) with the keyboard, like a user would. */
async function pickRadio(page, name) {
  const radio = page.getByRole('radio', { name });
  await radio.focus();
  await page.keyboard.press('Space');
  if (!(await radio.isChecked())) throw new Error(`radio ${name} did not get checked`);
}

async function analyzeSample(page, l) {
  await page.goto(BASE + '/');
  await settle(page);
  await page.getByRole('button', { name: l.sample }).click();
  await page.getByRole('button', { name: l.analyze }).click();
  await page.locator('.sent').first().waitFor();
  await settle(page);
}

/** name → { consent?: boolean (default true = consent cookie already set), session?, run(page) } */
const STATES = [
  ...['/', '/history', '/settings', '/pricing', '/account', '/privacy', '/terms', '/accessibility'].map((path) => ({
    name: `route ${path}`,
    run: async (page) => {
      await page.goto(BASE + path);
      await settle(page);
    },
  })),
  {
    name: 'consent banner open',
    consent: false,
    run: async (page) => {
      await page.goto(BASE + '/');
      await page.locator('[data-consent-banner]').waitFor();
      await settle(page);
    },
  },
  {
    name: 'cookie settings dialog open',
    run: async (page, l) => {
      await page.goto(BASE + '/privacy');
      await settle(page);
      await page.getByRole('button', { name: l.cookieSettings }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'results with a selected sentence',
    run: async (page, l) => {
      await analyzeSample(page, l);
      await page.getByRole('button', { name: l.nextSuspicious }).first().click();
      await page.locator('.sent[aria-current="true"]').waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'results summary dialog (mobile)',
    widths: [320],
    run: async (page, l) => {
      await analyzeSample(page, l);
      await page.getByRole('button', { name: l.summary }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'history with items',
    run: async (page, l) => {
      await analyzeSample(page, l);
      await page.goto(BASE + '/history');
      await settle(page);
    },
  },
  {
    name: 'history delete confirm dialog',
    run: async (page, l) => {
      await analyzeSample(page, l);
      await page.goto(BASE + '/history');
      await settle(page);
      await page.getByRole('button', { name: l.deleteItem }).first().click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'settings with a provider selected',
    run: async (page) => {
      await page.goto(BASE + '/settings');
      await settle(page);
      await pickRadio(page, /Anthropic/);
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'settings key error',
    run: async (page, l) => {
      await page.goto(BASE + '/settings');
      await settle(page);
      await pickRadio(page, /OpenAI/);
      await page.getByRole('button', { name: l.test }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'account signed-out',
    run: async (page) => {
      await page.goto(BASE + '/account');
      await settle(page);
    },
  },
  ...(SESSION
    ? [
        {
          name: 'account signed-in',
          session: SESSION,
          run: async (page) => {
            await page.goto(BASE + '/account');
            await settle(page);
          },
        },
      ]
    : []),
];

const browser = await chromium.launch();
const byRule = new Map();
const report = [];
let failures = 0;

for (const locale of LOCALES)
for (const state of STATES.filter((s) => !ONLY || s.name.includes(ONLY))) {
  for (const theme of THEMES) {
    for (const width of state.widths || WIDTHS) {
      const label = `${state.name} [${locale}, ${theme}, ${width}px]`;
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: theme, locale: locale === 'he' ? 'he-IL' : 'en-US' });
      const cookies = [{ name: 'penprint_lang', value: locale }];
      if (state.consent !== false) cookies.push(CONSENT);
      if (state.session) cookies.push({ name: 'penprint_session', value: state.session });
      await ctx.addCookies(cookies.map((c) => ({ ...c, url: BASE })));
      const page = await ctx.newPage();
      try {
        await state.run(page, L[locale]);
        const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const problems = res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: n.failureSummary })) }));
        const html = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
        const dir = locale === 'he' ? 'rtl' : 'ltr';
        if (html.lang !== locale || html.dir !== dir) problems.push({ id: 'html-lang-dir', impact: 'serious', help: `<html lang="${html.lang}" dir="${html.dir}">, expected lang="${locale}" dir="${dir}"`, nodes: [] });
        if (width <= 320) {
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 0) problems.push({ id: 'reflow-320', impact: 'serious', help: `Horizontal scroll of ${overflow}px at 320px (WCAG 1.4.10)`, nodes: [] });
        }
        report.push({ state: label, violations: problems });
        if (problems.length) {
          failures += problems.length;
          console.log(`✗ ${label}`);
          for (const p of problems) {
            byRule.set(p.id, (byRule.get(p.id) || 0) + Math.max(1, p.nodes.length));
            console.log(`   - ${p.id} (${p.impact}): ${p.help}`);
            for (const n of p.nodes.slice(0, 5)) console.log(`       ${n.target}\n         ${(n.summary || '').split('\n').slice(1, 3).join(' | ')}`);
          }
        } else console.log(`✓ ${label}`);
      } catch (e) {
        failures++;
        byRule.set('script-error', (byRule.get('script-error') || 0) + 1);
        console.log(`✗ ${label}: could not reach the state: ${e.message.split('\n')[0]}`);
      } finally {
        await ctx.close();
      }
    }
  }
}
await browser.close();

if (process.env.A11Y_JSON) writeFileSync(process.env.A11Y_JSON, JSON.stringify(report, null, 2));
console.log('\nViolations by rule (affected nodes):');
if (!byRule.size) console.log('  none');
for (const [id, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${id}: ${n}`);
console.log(failures ? `\n${failures} problem(s) found.` : '\nNo accessibility violations.');
process.exit(failures ? 1 : 0);
