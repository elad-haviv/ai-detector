import { GEN_SIZES, aiFilename, inspectImage, type ImageInfo } from './image';
import type { FileFinding, FindingId } from './types';

/**
 * Weights are log-odds-like points (positive = points to AI). Rough scale: 0.5 a weak hint,
 * 1-1.5 a real sign that still has innocent explanations, 2.5-3 something that is hard to explain
 * without an AI tool. They are judgment calls, not fitted values: there is no labeled corpus of
 * files with trustworthy metadata to fit them on.
 */
export const WEIGHTS: Record<FindingId, number> = {
  generatorLibrary: 2.5,
  statsMismatch: 1.5,
  fastTyping: 1.5,
  singleSession: 1,
  createdEqualsModified: 0.5,
  longEditing: -1.5,
  manySessions: -1,
  trackedChanges: -0.75,
  exported: 0,
  pdfGeneratorLibrary: 2.5,
  pdfChatPrint: 3,
  pdfLatex: -0.5,
  dateInconsistent: 0,
  aiLink: 3,
  figureAiCredentials: 1.5,
  figureAiMetadata: 1.5,
  figureAiFilename: 1.5,
  figureGenSize: 0.5,
  figurePlotLib: 0,
  figureCamera: -0.5,
};

export function finding(id: FindingId, vars?: Record<string, string | number>): FileFinding {
  return { id, weight: WEIGHTS[id], vars };
}

/** 0-100 from the findings; exactly 50 when nothing counted. */
export function fileScore(findings: FileFinding[]): number {
  // An AI-made figure says an AI tool was used for the picture, not for the text: cap what figures add.
  let figures = 0;
  let rest = 0;
  for (const f of findings) {
    if (f.id.startsWith('figure') && f.weight > 0) figures += f.weight;
    else rest += f.weight;
  }
  const sum = Math.max(-4, Math.min(5, rest + Math.min(2, figures)));
  if (!sum) return 50;
  const s = Math.round(100 / (1 + Math.exp(-0.7 * sum)));
  return s === 50 ? (sum > 0 ? 51 : 49) : s;
}

/** Links that a chat assistant hands out carry its name as a tracking tag. */
const AI_LINK = /utm_source=(chatgpt\.com|openai|copilot\.com|perplexity)|referrer=(grok\.com)/i;
export function aiLinkFindings(urls: Iterable<string>): FileFinding[] {
  const bySource = new Map<string, number>();
  for (const u of urls) {
    const m = AI_LINK.exec(u);
    if (m) bySource.set((m[1] || m[2]).toLowerCase(), (bySource.get((m[1] || m[2]).toLowerCase()) || 0) + 1);
  }
  if (!bySource.size) return [];
  const [source] = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  return [finding('aiLink', { count: [...bySource.values()].reduce((a, b) => a + b, 0), source })];
}

/** Created after it was last saved, or dated in the future: the metadata was changed or the clock was wrong. */
export function dateFindings(created: Date | undefined, modified: Date | undefined, now: Date): FileFinding[] {
  const DAY = 86400000;
  const future = [created, modified].some((d) => d && d.getTime() > now.getTime() + 2 * DAY);
  const reversed = created && modified && modified.getTime() < created.getTime() - DAY;
  return future || reversed ? [finding('dateInconsistent')] : [];
}

export interface Figure {
  bytes?: Uint8Array;
  width?: number;
  height?: number;
}

/**
 * Findings for the figures of a document. `names` are the file names / alt texts the document keeps
 * next to its pictures. Returns the number of real figures (≥100px a side).
 */
export function figureFindings(figures: Figure[], names: string[] = []): { findings: FileFinding[]; count: number } {
  const groups = new Map<FindingId, { count: number; detail?: string }>();
  const add = (id: FindingId, detail?: string) => {
    const g = groups.get(id) || { count: 0 };
    g.count++;
    g.detail ||= detail;
    groups.set(id, g);
  };
  let count = 0;
  for (const f of figures) {
    const info: ImageInfo = f.bytes ? inspectImage(f.bytes) : { format: 'other', marks: [] };
    const w = info.width ?? f.width;
    const h = info.height ?? f.height;
    if (w !== undefined && h !== undefined && (w < 100 || h < 100)) continue; // icons, bullets, rules
    count++;
    if (info.marks.includes('c2pa-ai')) add('figureAiCredentials', info.tool);
    else if (info.marks.includes('ai-metadata')) add('figureAiMetadata', info.tool);
    else if (info.marks.includes('plot-lib')) add('figurePlotLib', info.tool);
    else if (info.marks.includes('camera')) add('figureCamera', info.tool);
    else if (GEN_SIZES.has(`${w}x${h}`)) add('figureGenSize', `${w}×${h}`);
  }
  for (const n of new Set(names)) {
    const tool = aiFilename(n);
    if (tool) add('figureAiFilename', tool);
  }
  const findings = [...groups.entries()].map(([id, g]) => finding(id, { count: g.count, detail: g.detail || '?' }));
  return { findings, count };
}
