import type { PatternCategory } from './patterns/catalog';

export type ProviderId = 'openrouter' | 'google' | 'openai' | 'anthropic';
export type Lang = 'he' | 'en';

export interface Sentence {
  id: number;
  paragraph: number;
  text: string;
  /** Leading whitespace/punctuation kept to rebuild the paragraph exactly. */
  lang: Lang;
  words: number;
}

export interface PatternHit {
  patternId: string;
  category: PatternCategory;
  match: string;
  start: number;
  end: number;
}

export interface SentenceResult {
  id: number;
  /** Final blended probability 0-100. */
  probability: number;
  heuristic: number; // 0-100
  llm?: number; // 0-100
  decision?: number; // 0-100
  patterns: string[]; // union of heuristic + LLM pattern ids
  hits: PatternHit[]; // lexical matches inside the sentence
  explanation?: string;
  rewrite?: string | null;
  status: 'pending' | 'done' | 'failed' | 'heuristic-only';
  edited?: boolean;
  ignored?: boolean;
}

export interface DocStats {
  sentences: number;
  words: number;
  avgSentenceLength: number;
  /** Coefficient of variation of sentence length (std/mean). Human prose ≈ 0.5+. */
  burstiness: number;
  /** Moving-average type-token ratio (window 50), 0-1. */
  lexicalDiversity: number;
}

export interface Analysis {
  id: string;
  title: string;
  createdAt: number;
  context: string;
  sentences: Sentence[];
  results: Record<number, SentenceResult>;
  overall: { probability: number; confidence: 'low' | 'medium' | 'high'; summary?: string };
  stats: DocStats;
  meta: { provider?: ProviderId; model?: string; decisionModel?: string; heuristicsVersion: string };
  /** Original file kept in IndexedDB (key = analysis id) so the formatted Word view can be rendered. */
  source?: { kind: 'docx'; fileName: string };
}

export interface Settings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Record<ProviderId, string>;
  useDecisionModel: boolean;
  decisionModel: string;
  sensitivity: 'low' | 'medium' | 'high';
  explanationLanguage: 'he' | 'en' | 'auto';
  theme: 'system' | 'light' | 'dark';
  alwaysShowPercent: boolean;
}

/** Shape the LLM must return (see prompts.ts). */
export interface LlmSentenceOut {
  id: number;
  ai_probability: number;
  patterns: string[];
  explanation: string;
  rewrite: string | null;
}
export interface LlmOut {
  sentences: LlmSentenceOut[];
  overall?: { ai_probability: number; summary: string };
}

export interface AnalyzeChunkRequest {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  sentences: { id: number; text: string }[];
  context: string;
  explanationLanguage: Lang;
  decisionModel?: string;
  openrouterKey?: string;
}

export interface AnalyzeChunkResponse {
  llm?: LlmOut;
  decisions?: Record<number, number>; // id -> 0-100
  errors?: { llm?: string; decision?: string };
}
