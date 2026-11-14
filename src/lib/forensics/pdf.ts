import { aiLinkFindings, dateFindings, figureFindings, fileScore, finding, type Figure } from './score';
import type { FileFinding, FileForensics, FileMeta } from './types';

/** The document information dictionary, as pdf.js returns it. */
export interface PdfInfo {
  Title?: string;
  Author?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
}

/** Libraries that build PDFs from code. Chat assistants create their PDF downloads with these. */
const GENERATORS: [RegExp, string][] = [
  [/ReportLab/i, 'ReportLab'],
  [/PyFPDF|fpdf/i, 'FPDF'],
  [/WeasyPrint/i, 'WeasyPrint'],
  [/wkhtmltopdf/i, 'wkhtmltopdf'],
  [/xhtml2pdf/i, 'xhtml2pdf'],
  [/jsPDF/i, 'jsPDF'],
  [/pdfmake/i, 'pdfmake'],
  [/PDFKit/i, 'PDFKit'],
  [/pdf-lib/i, 'pdf-lib'],
  [/HeadlessChrome|Puppeteer|Playwright/i, 'headless Chrome'],
  [/Matplotlib/i, 'Matplotlib'],
  [/PyMuPDF|pypdf|PyPDF2/i, 'a Python PDF library'],
];
const LATEX = /pdfTeX|XeTeX|LuaTeX|LaTeX|xdvipdfmx|dvips/i;
/** Producers of "Print → Save as PDF" in a browser. */
const BROWSER_PRINT = /Skia\/PDF|Quartz PDFContext|Chromium|Chrome|Mozilla|Firefox|cairo|Edge/i;
/** Page titles of chat assistants ("ChatGPT", "… - Claude", "Gemini - …"). */
const CHAT_TITLE = /^(ChatGPT|Claude|Gemini|Google Gemini|Microsoft Copilot|Copilot|Perplexity|DeepSeek|Grok)\b|[-|–] (ChatGPT|Claude|Gemini|Copilot|Perplexity|DeepSeek|Grok)$/;

/** "D:20240131120000+02'00'" → Date. */
export function pdfDate(s?: string): Date | undefined {
  const m = /^(?:D:)?(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?\s*([Zz+-])?(\d\d)?'?(\d\d)?/.exec((s || '').trim());
  if (!m) return undefined;
  const utc = Date.UTC(+m[1], +(m[2] || 1) - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const offset = m[7] === '+' || m[7] === '-' ? (m[7] === '+' ? 1 : -1) * (+(m[8] || 0) * 60 + +(m[9] || 0)) * 60000 : 0;
  const d = new Date(utc - offset);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Image XObjects of a PDF, read straight from the file bytes. An image is always its own stream
 * object, so its dictionary is plain text even in compressed PDFs. JPEGs (DCTDecode) are stored
 * as-is, metadata included; other images are re-encoded pixels, of which only the size is known.
 */
export function pdfFigures(bytes: Uint8Array): Figure[] {
  const raw = new TextDecoder('latin1').decode(bytes);
  const out: Figure[] = [];
  const re = /\/Subtype\s*\/Image\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) && out.length < 200) {
    const open = raw.lastIndexOf(' obj', m.index);
    const stream = raw.indexOf('stream', m.index);
    if (open < 0 || stream < 0 || stream - open > 4000) continue;
    const dict = raw.slice(open, stream);
    if (/\/ImageMask\s+true/.test(dict)) continue;
    const width = Number(/\/Width\s+(\d+)/.exec(dict)?.[1]);
    const height = Number(/\/Height\s+(\d+)/.exec(dict)?.[1]);
    if (!width || !height) continue;
    const fig: Figure = { width, height };
    if (/\/Filter\s*(?:\[\s*)?\/DCTDecode/.test(dict)) {
      const start = stream + 6 + (raw[stream + 6] === '\r' ? 2 : 1);
      const end = raw.indexOf('endstream', start);
      if (end > start) fig.bytes = bytes.subarray(start, end);
    }
    out.push(fig);
    re.lastIndex = stream;
  }
  return out;
}

/** Inspect a PDF: producer, dates, links (from pdf.js) and embedded figures (from the bytes). */
export function inspectPdf(bytes: Uint8Array, fileName: string, info: PdfInfo, links: string[], words: number, now = new Date()): FileForensics {
  const clean = (s?: string) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 200) : undefined);
  const created = pdfDate(info.CreationDate);
  const modified = pdfDate(info.ModDate);
  const meta: FileMeta = {
    application: clean(info.Producer),
    creator: clean(info.Creator),
    author: clean(info.Author),
    title: clean(info.Title),
    created: created?.toISOString(),
    modified: modified?.toISOString(),
    words,
  };

  const findings: FileFinding[] = [];
  const made = `${meta.creator || ''} ${meta.application || ''}`;
  const generator = GENERATORS.find(([re]) => re.test(made))?.[1];
  if (meta.title && CHAT_TITLE.test(meta.title) && BROWSER_PRINT.test(made)) findings.push(finding('pdfChatPrint', { title: meta.title.slice(0, 60) }));
  else if (generator) findings.push(finding('pdfGeneratorLibrary', { tool: generator }));
  else if (LATEX.test(made)) findings.push(finding('pdfLatex', { tool: LATEX.exec(made)![0] }));
  findings.push(...dateFindings(created, modified, now));
  findings.push(...aiLinkFindings(links));
  const fig = figureFindings(pdfFigures(bytes));
  findings.push(...fig.findings);

  return { kind: 'pdf', fileName, score: fileScore(findings), findings, meta, figures: fig.count };
}
