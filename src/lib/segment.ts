import type { Lang, Sentence } from './types';

const HEBREW = /[֐-׿]/g;
const LATIN = /[A-Za-z]/g;

export function detectLang(text: string): Lang {
  const he = (text.match(HEBREW) || []).length;
  const en = (text.match(LATIN) || []).length;
  return he >= en * 0.5 && he > 0 ? 'he' : 'en';
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’"״׳-]*/gu) || []).length;
}

/** Abbreviations that should not end a sentence. */
const ABBREV = /(?:\b(?:e\.g|i\.e|et al|etc|vs|cf|Dr|Mr|Mrs|Ms|Prof|Fig|No|pp?|vol|ed|eds)\.)$/i;

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  let pieces: string[];
  if (Seg) {
    const seg = new Seg(undefined, { granularity: 'sentence' });
    pieces = Array.from(seg.segment(paragraph), (s) => s.segment);
  } else {
    pieces = paragraph.match(/[^.!?。]+(?:[.!?]+["'”’)\]]*\s*|$)/g) || [paragraph];
  }
  // Merge pieces split after abbreviations or numbering like "1." / "(Smith, 2020, p."
  for (const p of pieces) {
    const prev = out[out.length - 1];
    if (prev && (ABBREV.test(prev.trimEnd()) || /(?:^|\s)\d{1,2}\.\s*$/.test(prev) && prev.trim().length < 5)) {
      out[out.length - 1] = prev + p;
    } else {
      out.push(p);
    }
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Split a document into paragraphs and sentences with stable ids. */
export function segment(text: string): Sentence[] {
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n(?=\s*(?:[-*•]|\d+[.)])\s)/)
    .flatMap((p) => p.split(/\n/))
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences: Sentence[] = [];
  let id = 0;
  paragraphs.forEach((p, pi) => {
    for (const s of splitSentences(p)) {
      sentences.push({ id: id++, paragraph: pi, text: s, lang: detectLang(s), words: countWords(s) });
    }
  });
  return sentences;
}

export function groupParagraphs(sentences: Sentence[]): Sentence[][] {
  const groups: Sentence[][] = [];
  for (const s of sentences) {
    (groups[s.paragraph] ||= []).push(s);
  }
  return groups.filter(Boolean);
}

/** Chunk sentences for LLM calls, keeping paragraphs together where possible. */
export function chunkSentences(sentences: Sentence[], maxSentences = 24, maxWords = 700): Sentence[][] {
  const chunks: Sentence[][] = [];
  let cur: Sentence[] = [];
  let words = 0;
  for (const para of groupParagraphs(sentences)) {
    for (const s of para) {
      if (cur.length && (cur.length >= maxSentences || words + s.words > maxWords)) {
        chunks.push(cur);
        cur = [];
        words = 0;
      }
      cur.push(s);
      words += s.words;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}
