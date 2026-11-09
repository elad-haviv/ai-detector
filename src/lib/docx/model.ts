/**
 * Word (.docx) support that keeps the original formatting.
 *
 * The document XML is the single source of truth. Sentences are located inside each <w:p> by
 * character offsets over its <w:t> runs; edits rewrite only the runs a sentence spans, so every
 * other run keeps its exact formatting. The same offset helpers work on the rendered preview DOM.
 */
import JSZip from 'jszip';
import { countWords, detectLang, splitSentences } from '../segment';
import type { Sentence } from '../types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOC_PATH = 'word/document.xml';

/** A text-bearing node with a readable/writable string (DOM Text node or XML <w:t> element). */
export interface TextSlot {
  get(): string;
  set(v: string): void;
}

// ---------- whitespace-insensitive search (tabs, nbsp and bidi marks differ between XML and render) ----------
const IGNORABLE = /[\s ​-‏‪-‮⁦-⁩﻿]/;

function normalizeWithMap(raw: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (IGNORABLE.test(ch)) continue;
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

/** Find `needle` in `haystack` at or after raw index `from`, ignoring whitespace/bidi marks. Returns raw [start, end). */
export function findLoose(haystack: string, needle: string, from = 0): [number, number] | null {
  const h = normalizeWithMap(haystack);
  const n = normalizeWithMap(needle).norm;
  if (!n) return null;
  const startNorm = h.map.findIndex((r) => r >= from);
  if (startNorm < 0) return null;
  const idx = h.norm.indexOf(n, startNorm);
  if (idx < 0) return null;
  return [h.map[idx], h.map[idx + n.length - 1] + 1];
}

/** Replace raw range [start,end) across slots with `text`; the first touched slot receives the new text. */
export function replaceRange(slots: TextSlot[], start: number, end: number, text: string) {
  let pos = 0;
  let placed = false;
  for (const s of slots) {
    const v = s.get();
    const a = pos;
    const b = pos + v.length;
    pos = b;
    if (b <= start || a >= end) continue;
    const from = Math.max(0, start - a);
    const to = Math.min(v.length, end - a);
    s.set(v.slice(0, from) + (placed ? '' : text) + v.slice(to));
    placed = true;
  }
}

// ---------- XML side ----------
function ownedTextNodes(p: Element): Element[] {
  return Array.from(p.getElementsByTagNameNS(W_NS, 't')).filter((t) => {
    let el = t.parentElement;
    while (el && !(el.namespaceURI === W_NS && el.localName === 'p')) el = el.parentElement;
    return el === p;
  });
}

function xmlSlots(p: Element): TextSlot[] {
  return ownedTextNodes(p).map((t) => ({
    get: () => t.textContent || '',
    set: (v: string) => {
      t.textContent = v;
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    },
  }));
}

const slotText = (slots: TextSlot[]) => slots.map((s) => s.get()).join('');

export interface DocxBlock {
  /** Index among the document's <w:p> elements (body order, tables included). */
  pIndex: number;
  text: string;
}

async function loadXml(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file(DOC_PATH);
  if (!file) throw new Error('not a Word document');
  const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
  const paras = Array.from(xml.getElementsByTagNameNS(W_NS, 'p'));
  return { zip, xml, paras };
}

/** Text paragraphs of a .docx in document order. */
export async function readBlocks(bytes: ArrayBuffer): Promise<DocxBlock[]> {
  const { paras } = await loadXml(bytes);
  const blocks: DocxBlock[] = [];
  paras.forEach((p, i) => {
    const text = slotText(xmlSlots(p));
    if (text.trim()) blocks.push({ pIndex: i, text });
  });
  return blocks;
}

/** Sentences for a .docx; `paragraph` is the block index (position in readBlocks()). */
export function sentencesFromBlocks(blocks: DocxBlock[]): Sentence[] {
  const out: Sentence[] = [];
  let id = 0;
  blocks.forEach((b, bi) => {
    for (const s of splitSentences(b.text)) out.push({ id: id++, paragraph: bi, text: s, lang: detectLang(s), words: countWords(s) });
  });
  return out;
}

/**
 * Produce a new .docx from the ORIGINAL file and the current sentences. For each block whose sentences
 * changed, only the changed character ranges are rewritten; untouched runs keep their formatting.
 */
export async function buildEditedDocx(original: ArrayBuffer, current: Sentence[]): Promise<Blob> {
  const { zip, xml, paras } = await loadXml(original);
  const blocks: DocxBlock[] = [];
  paras.forEach((p, i) => {
    const text = slotText(xmlSlots(p));
    if (text.trim()) blocks.push({ pIndex: i, text });
  });
  const originalSents = sentencesFromBlocks(blocks);
  const byBlock = (list: Sentence[]) => {
    const m = new Map<number, Sentence[]>();
    for (const s of list) (m.get(s.paragraph) || m.set(s.paragraph, []).get(s.paragraph)!).push(s);
    return m;
  };
  const origBy = byBlock(originalSents);
  const curBy = byBlock(current);

  blocks.forEach((b, bi) => {
    const orig = origBy.get(bi) || [];
    const cur = curBy.get(bi) || [];
    const same = orig.length === cur.length && orig.every((o, i) => o.id === cur[i].id);
    if (same && orig.every((o, i) => o.text === cur[i].text)) return;
    const slots = xmlSlots(paras[b.pIndex]);
    const full = slotText(slots);
    // locate original sentences in order
    const ranges: [number, number][] = [];
    let cursor = 0;
    for (const o of orig) {
      const r = findLoose(full, o.text, cursor);
      if (!r) return; // cannot map safely: leave paragraph untouched
      ranges.push(r);
      cursor = r[1];
    }
    if (same) {
      // per-sentence replacement, right to left so offsets stay valid
      for (let i = orig.length - 1; i >= 0; i--) if (orig[i].text !== cur[i].text) replaceRange(slots, ranges[i][0], ranges[i][1], cur[i].text);
    } else if (ranges.length) {
      // paragraph rewritten: replace the span from first to last sentence
      replaceRange(slots, ranges[0][0], ranges[ranges.length - 1][1], cur.map((s) => s.text).join(' '));
    }
  });

  zip.file(DOC_PATH, new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- rendered preview (DOM) side ----------
function domSlots(p: Element): { slots: TextSlot[]; nodes: Text[] } {
  const nodes: Text[] = [];
  const walker = p.ownerDocument.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const owner = (n.parentElement as Element | null)?.closest('p');
    if (owner === p) nodes.push(n as Text);
  }
  return { nodes, slots: nodes.map((t) => ({ get: () => t.data, set: (v) => (t.data = v) })) };
}

/** Wrap raw range [start,end) of a paragraph's text nodes in <span data-s=id>; returns created spans. */
function wrapRange(nodes: Text[], start: number, end: number, id: number): HTMLElement[] {
  const spans: HTMLElement[] = [];
  let pos = 0;
  const plan: { node: Text; from: number; to: number }[] = [];
  for (const t of nodes) {
    const a = pos;
    const b = pos + t.data.length;
    pos = b;
    if (b <= start || a >= end) continue;
    plan.push({ node: t, from: Math.max(0, start - a), to: Math.min(t.data.length, end - a) });
  }
  for (const { node, from, to } of plan) {
    let mid = node;
    if (from > 0) mid = node.splitText(from);
    if (to - from < mid.data.length) mid.splitText(to - from);
    const span = node.ownerDocument.createElement('span');
    span.dataset.s = String(id);
    span.className = 'sent';
    mid.parentNode!.insertBefore(span, mid);
    span.appendChild(mid);
    spans.push(span);
  }
  return spans;
}

/**
 * Wrap every sentence of the rendered document in spans. Rendered paragraphs are matched to blocks
 * in order by content, so headers, footers and list numbering added by the renderer are skipped.
 */
export function annotateRendered(root: HTMLElement, sentences: Sentence[]): Map<number, HTMLElement[]> {
  const result = new Map<number, HTMLElement[]>();
  const rendered = Array.from(root.querySelectorAll('article p')) as HTMLElement[];
  const groups = new Map<number, Sentence[]>();
  for (const s of sentences) (groups.get(s.paragraph) || groups.set(s.paragraph, []).get(s.paragraph)!).push(s);
  let j = 0;
  for (const block of [...groups.keys()].sort((a, b) => a - b)) {
    const sents = groups.get(block)!;
    // find the next rendered paragraph containing this block's first sentence
    let found = -1;
    for (let k = j; k < Math.min(rendered.length, j + 40); k++) {
      if (findLoose(rendered[k].textContent || '', sents[0].text)) {
        found = k;
        break;
      }
    }
    if (found < 0) continue;
    j = found + 1;
    const { nodes } = domSlots(rendered[found]);
    const full = nodes.map((n) => n.data).join('');
    const ranges: [Sentence, number, number][] = [];
    let cursor = 0;
    for (const s of sents) {
      const r = findLoose(full, s.text, cursor);
      if (!r) continue;
      ranges.push([s, r[0], r[1]]);
      cursor = r[1];
    }
    // wrap right to left: splitting later nodes never shifts earlier offsets
    for (let i = ranges.length - 1; i >= 0; i--) {
      const [s, a, b] = ranges[i];
      const spans = wrapRange(nodes, a, b, s.id);
      if (spans.length) {
        spans[0].id = `s-${s.id}`;
        result.set(s.id, spans);
      }
    }
  }
  return result;
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
