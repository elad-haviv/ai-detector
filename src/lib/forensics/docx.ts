import JSZip from 'jszip';
import { aiLinkFindings, dateFindings, figureFindings, fileScore, finding, type Figure } from './score';
import type { FileFinding, FileForensics, FileMeta } from './types';

/** Libraries that write .docx files from code. Chat assistants build their Word downloads with these. */
const GENERATORS: [RegExp, string][] = [
  [/python-docx/i, 'python-docx'],
  [/^Un-named$/, 'docx (JavaScript)'],
  [/docx4j/i, 'docx4j'],
  [/Apache POI/i, 'Apache POI'],
  [/PHPWord/i, 'PHPWord'],
  [/Aspose/i, 'Aspose'],
  [/docxtemplater/i, 'docxtemplater'],
  [/Open ?XML SDK/i, 'Open XML SDK'],
  [/pandoc/i, 'Pandoc'],
  [/html-to-docx|html-docx/i, 'html-to-docx'],
];
/** python-docx ships a template whose dates were never updated; files it writes keep them. */
const PYTHON_DOCX_DATE = '2013-12-23T23:15:00Z';
/** Faster than anyone composes: above this, the words were not typed during the recorded editing time. */
const MAX_WPM = 60;
const MIN_WORDS = 250;

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
/** Text of the first <prefix:name> element (properties files are flat, so a regex is enough). */
function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${name}>`).exec(xml);
  const v = m && unescape(m[1]).trim();
  return v || undefined;
}
const date = (s?: string) => {
  const d = s ? new Date(s) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

/** Share of the body text that each editing session (rsid) put into the file. */
function sessionsOf(doc: string): { chars: number; words: number; shares: number[] } {
  const by = new Map<string, number>();
  let chars = 0;
  let text = '';
  for (const p of doc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const pRsid = /^<w:p [^>]*?w:rsidR="([^"]+)"/.exec(p)?.[1];
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) || []) {
      const rsid = /^<w:r [^>]*?w:rsidR="([^"]+)"/.exec(r)?.[1] ?? pRsid;
      let len = 0;
      for (const t of r.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)) {
        len += t[1].length;
        text += t[1];
      }
      chars += len;
      if (rsid && len) by.set(rsid, (by.get(rsid) || 0) + len);
    }
    text += ' ';
  }
  const tracked = [...by.values()].reduce((a, b) => a + b, 0);
  const shares = tracked ? [...by.values()].map((v) => v / tracked).sort((a, b) => b - a) : [];
  return { chars, words: text.split(/\s+/).filter(Boolean).length, shares };
}

/** Inspect a .docx: properties, dates, editing history, links and embedded figures. */
export async function inspectDocx(bytes: ArrayBuffer | Uint8Array, fileName: string, now = new Date()): Promise<FileForensics> {
  const zip = await JSZip.loadAsync(bytes);
  const read = async (path: string) => (await zip.file(path)?.async('string')) || '';
  const [core, app, doc, rels] = await Promise.all([read('docProps/core.xml'), read('docProps/app.xml'), read('word/document.xml'), read('word/_rels/document.xml.rels')]);

  const created = date(tag(core, 'created'));
  const modified = date(tag(core, 'modified'));
  const totalTime = tag(app, 'TotalTime');
  const appWords = tag(app, 'Words');
  const revision = Number(tag(core, 'revision'));
  const s = sessionsOf(doc);
  const meta: FileMeta = {
    application: [tag(app, 'Application'), tag(app, 'AppVersion')].filter(Boolean).join(' ') || undefined,
    author: tag(core, 'creator'),
    lastModifiedBy: tag(core, 'lastModifiedBy'),
    title: tag(core, 'title'),
    created: created?.toISOString(),
    modified: modified?.toISOString(),
    editMinutes: totalTime !== undefined && Number.isFinite(+totalTime) ? +totalTime : undefined,
    revision: Number.isFinite(revision) && revision > 0 ? revision : undefined,
    sessions: s.shares.length || undefined,
    words: s.words,
  };

  const findings: FileFinding[] = [];
  const long = s.words >= MIN_WORDS;
  const signature = [meta.author, meta.lastModifiedBy, tag(core, 'description'), tag(app, 'Application'), tag(app, 'Company')].filter(Boolean) as string[];
  const generator =
    GENERATORS.find(([re]) => signature.some((v) => re.test(v)))?.[1] || (tag(core, 'created') === PYTHON_DOCX_DATE ? 'python-docx' : undefined);
  const fromWord = /Microsoft/i.test(meta.application || '');

  if (generator) {
    findings.push(finding('generatorLibrary', { tool: generator }));
  } else if (!fromWord) {
    // Google Docs, Pages, LibreOffice…: ordinary editors that keep no editing history in the file.
    findings.push(finding('exported'));
  } else {
    const minutes = meta.editMinutes;
    if (long && appWords !== undefined && +appWords < s.words * 0.25) {
      findings.push(finding('statsMismatch', { recorded: +appWords, words: s.words }));
    } else if (long && minutes !== undefined && s.words / Math.max(1, minutes) > MAX_WPM) {
      findings.push(finding('fastTyping', { words: s.words, minutes }));
    } else if (long && minutes === undefined && created && modified && Math.abs(modified.getTime() - created.getTime()) <= 2 * 60000) {
      findings.push(finding('createdEqualsModified'));
    } else if (long && minutes !== undefined && minutes >= 30 && s.words / minutes <= 40) {
      findings.push(finding('longEditing', { words: s.words, minutes }));
    }
    if (long && s.shares.length) {
      if (s.shares[0] >= 0.9) findings.push(finding('singleSession', { percent: Math.round(s.shares[0] * 100) }));
      else if (s.shares[0] < 0.6 && s.shares.filter((x) => x >= 0.02).length >= 5) findings.push(finding('manySessions', { count: s.shares.length }));
    }
  }
  if (/<w:(ins|del) /.test(doc) || zip.file('word/comments.xml')) findings.push(finding('trackedChanges'));
  // python-docx's template date is a signature, not a clock error
  if (generator !== 'python-docx') findings.push(...dateFindings(created, modified, now));
  findings.push(...aiLinkFindings([...rels.matchAll(/Target="([^"]+)"/g)].map((m) => unescape(m[1]))));

  // Figures: every file under word/media, with the names Word kept next to the pictures.
  const names = [...doc.matchAll(/<(?:pic:cNvPr|wp:docPr) [^>]*>/g)].flatMap((m) => [...m[0].matchAll(/(?:name|descr|title)="([^"]*)"/g)].map((a) => unescape(a[1])));
  const media = Object.keys(zip.files).filter((p) => /^word\/media\/[^/]+\.(png|jpe?g|gif)$/i.test(p)).slice(0, 200);
  const figures: Figure[] = await Promise.all(media.map(async (p) => ({ bytes: await zip.file(p)!.async('uint8array') })));
  const fig = figureFindings(figures, names);
  findings.push(...fig.findings);

  return { kind: 'docx', fileName, score: fileScore(findings), findings, meta, figures: fig.count };
}
