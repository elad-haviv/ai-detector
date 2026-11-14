/**
 * Checks for the file-forensics layer (src/lib/forensics): no network, fixtures built in memory.
 *   npx tsx scripts/check-forensics.mts        (also `npm run check:forensics`)
 * Pass file paths to print the report for real files instead:
 *   npx tsx scripts/check-forensics.mts thesis.docx
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';
import { inspectDocx } from '../src/lib/forensics/docx';
import { inspectImage } from '../src/lib/forensics/image';
import { inspectPdf, pdfDate, pdfFigures } from '../src/lib/forensics/pdf';
import { fileScore, finding } from '../src/lib/forensics/score';
import { overallScore } from '../src/lib/heuristics';
import type { FileForensics, FindingId } from '../src/lib/forensics/types';
import { he } from '../src/lib/i18n/he';
import { en } from '../src/lib/i18n/en';

if (process.argv.length > 2) {
  for (const path of process.argv.slice(2)) {
    if (!/\.docx$/i.test(path)) throw new Error('only .docx here; PDFs are inspected by /api/extract');
    console.log(JSON.stringify(await inspectDocx(readFileSync(path), path), null, 2));
  }
  process.exit(0);
}

let n = 0;
const ok = (name: string) => console.log(`ok ${++n} - ${name}`);
const ids = (f: FileForensics) => f.findings.map((x) => x.id).sort();
const NOW = new Date('2026-11-14T00:00:00Z');

// ---------- image fixtures ----------
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  let c = 0xffffffff;
  for (const b of body) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}
function png(w: number, h: number, extra: Buffer[] = []): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  // one all-zero row repeated is not valid for h rows, but only metadata is read
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...extra, chunk('IDAT', deflateSync(Buffer.alloc(w + 1))), chunk('IEND', Buffer.alloc(0))]);
}
const text = (key: string, value: string) => chunk('tEXt', Buffer.from(`${key}\0${value}`, 'latin1'));
function jpeg(w: number, h: number, segments: [number, Buffer][] = []): Buffer {
  const seg = (marker: number, data: Buffer) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(data.length + 2, 2);
    return Buffer.concat([head, data]);
  };
  const sof = Buffer.from([8, 0, 0, 0, 0, 1, 1, 0x11, 0]);
  sof.writeUInt16BE(h, 1);
  sof.writeUInt16BE(w, 3);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments.map(([m, d]) => seg(m, d)), seg(0xc0, sof), seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0, 0xff, 0xd9])]);
}
function exifSegment(make: string, model: string): Buffer {
  const strings = Buffer.from(`${make}\0${model}\0`, 'latin1');
  const tiff = Buffer.alloc(8 + 2 + 24 + 4);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  const entry = (i: number, tag: number, len: number, offset: number) => {
    const o = 10 + i * 12;
    tiff.writeUInt16LE(tag, o);
    tiff.writeUInt16LE(2, o + 2);
    tiff.writeUInt32LE(len, o + 4);
    tiff.writeUInt32LE(offset, o + 8);
  };
  entry(0, 0x010f, make.length + 1, tiff.length);
  entry(1, 0x0110, model.length + 1, tiff.length + make.length + 1);
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, strings]);
}

// ---------- images ----------
assert.deepEqual(inspectImage(png(640, 480)), { format: 'png', width: 640, height: 480, marks: [] });
ok('plain PNG: size read, no marks');
assert.deepEqual(inspectImage(png(1024, 1024)).marks, ['gen-size']);
ok('1024×1024 PNG: generator size (weak)');
let im = inspectImage(png(800, 600, [text('parameters', 'a cat, Steps: 20, Sampler: Euler a')]));
assert.deepEqual([im.marks, im.tool], [['ai-metadata'], 'Stable Diffusion']);
ok('PNG with Stable Diffusion parameters');
im = inspectImage(png(640, 480, [text('Software', 'Matplotlib version3.9.0, https://matplotlib.org/')]));
assert.deepEqual([im.marks, im.tool], [['plot-lib'], 'Matplotlib']);
ok('Matplotlib chart is a note, not an AI mark');
im = inspectImage(png(1024, 1024, [chunk('caBX', Buffer.from('jumb....c2pa....c2pa.actions..digitalSourceType..http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia..OpenAI', 'latin1'))]));
assert.deepEqual([im.marks, im.tool], [['c2pa-ai'], 'OpenAI']);
ok('PNG with C2PA manifest declaring AI generation');
assert.deepEqual(inspectImage(png(900, 700, [chunk('caBX', Buffer.from('jumb....c2pa....Adobe Photoshop', 'latin1'))])).marks, []);
ok('C2PA manifest without an AI declaration is not flagged');
im = inspectImage(jpeg(1024, 1024, [[0xe1, exifSegment('Canon', 'EOS R6')]]));
assert.deepEqual([im.format, im.width, im.height, im.marks, im.tool], ['jpeg', 1024, 1024, ['camera'], 'Canon EOS R6']);
ok('JPEG with camera EXIF: camera wins over generator size');
im = inspectImage(jpeg(1200, 800, [[0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>', 'latin1')]]));
assert.deepEqual(im.marks, ['ai-metadata']);
ok('JPEG with IPTC trainedAlgorithmicMedia in XMP');
assert.deepEqual(inspectImage(jpeg(1200, 800, [[0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<dc:description>Imagen de un gato</dc:description>', 'latin1')]])).marks, []);
ok('Spanish "Imagen" in a description is not a generator name');
assert.deepEqual(inspectImage(new Uint8Array([1, 2, 3])).marks, []);
assert.deepEqual(inspectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1])).marks, []);
ok('truncated / unknown bytes do not throw');

// ---------- docx fixtures ----------
const WORDS = 'word '.repeat(60).trim(); // 60 words per paragraph
interface DocxOpts {
  core?: Record<string, string>;
  app?: Record<string, string> | null;
  /** rsid of each paragraph */
  paragraphs?: (string | null)[];
  rels?: string[];
  media?: Record<string, Buffer>;
  bodyExtra?: string;
  comments?: boolean;
}
async function docx(o: DocxOpts): Promise<Uint8Array> {
  const zip = new JSZip();
  const core = { creator: 'Dana Levi', lastModifiedBy: 'Dana Levi', revision: '12', created: '2026-10-01T10:00:00Z', modified: '2026-10-05T18:00:00Z', ...o.core };
  zip.file(
    'docProps/core.xml',
    `<cp:coreProperties><dc:creator>${core.creator}</dc:creator><dc:description>${core.description || ''}</dc:description><cp:lastModifiedBy>${core.lastModifiedBy}</cp:lastModifiedBy><cp:revision>${core.revision}</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">${core.created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${core.modified}</dcterms:modified></cp:coreProperties>`,
  );
  if (o.app !== null) {
    const app = { Application: 'Microsoft Office Word', TotalTime: '240', Words: '480', ...o.app };
    zip.file('docProps/app.xml', `<Properties>${Object.entries(app).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</Properties>`);
  }
  const paras = (o.paragraphs ?? ['00A10001', '00A10002', '00A10003', '00A10004', '00A10005', '00A10006', '00A10007', '00A10008'])
    .map((r) => `<w:p${r ? ` w:rsidR="${r}" w:rsidRDefault="${r}"` : ''}><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${WORDS} </w:t></w:r></w:p>`)
    .join('');
  zip.file('word/document.xml', `<w:document><w:body>${paras}${o.bodyExtra || ''}</w:body></w:document>`);
  zip.file('word/_rels/document.xml.rels', `<Relationships>${(o.rels || []).map((t, i) => `<Relationship Id="rId${i}" Target="${t}" TargetMode="External"/>`).join('')}</Relationships>`);
  for (const [name, bytes] of Object.entries(o.media || {})) zip.file(`word/media/${name}`, bytes);
  if (o.comments) zip.file('word/comments.xml', '<w:comments/>');
  return zip.generateAsync({ type: 'uint8array' });
}

// ---------- docx ----------
let f = await inspectDocx(await docx({}), 'essay.docx', NOW);
assert.deepEqual(ids(f), ['longEditing', 'manySessions']);
assert.ok(f.score < 20, `human-made file scores low (${f.score})`);
assert.deepEqual([f.meta.editMinutes, f.meta.revision, f.meta.sessions, f.meta.words, f.meta.author], [240, 12, 8, 480, 'Dana Levi']);
ok(`Word file written over 8 sessions and 4 hours: points to human work (${f.score})`);

f = await inspectDocx(await docx({ app: { TotalTime: '3', Words: '480' }, paragraphs: Array(8).fill('00B10001') }), 'pasted.docx', NOW);
assert.deepEqual(ids(f), ['fastTyping', 'singleSession']);
assert.deepEqual(f.findings.find((x) => x.id === 'fastTyping')?.vars, { words: 480, minutes: 3 });
assert.ok(f.score > 80);
ok(`480 words in 3 minutes, one session: pasted (${f.score})`);

f = await inspectDocx(await docx({ core: { creator: 'python-docx', description: 'generated by python-docx', lastModifiedBy: '', revision: '1', created: '2013-12-23T23:15:00Z', modified: '2013-12-23T23:15:00Z' }, app: { Application: 'Microsoft Macintosh Word', TotalTime: '0', Words: '0' }, paragraphs: Array(8).fill(null) }), 'report.docx', NOW);
assert.deepEqual(ids(f), ['generatorLibrary']);
assert.equal(f.findings[0].vars?.tool, 'python-docx');
ok('python-docx file: built by code, and its 2013 template date is not reported as a date error');

f = await inspectDocx(await docx({ core: { creator: 'A Student', lastModifiedBy: 'A Student', created: '2013-12-23T23:15:00Z' }, app: { Application: 'Microsoft Macintosh Word', TotalTime: '0', Words: '0' }, paragraphs: Array(8).fill(null) }), 'renamed.docx', NOW);
assert.equal(f.findings[0].vars?.tool, 'python-docx');
ok('python-docx with the author overwritten is still recognized by its template date');

f = await inspectDocx(await docx({ core: { creator: 'Un-named', lastModifiedBy: 'Un-named', revision: '1' }, app: {}, paragraphs: Array(8).fill(null) }), 'claude.docx', NOW);
assert.equal(f.findings[0].vars?.tool, 'docx (JavaScript)');
ok('docx (JavaScript library) default author');

f = await inspectDocx(await docx({ core: { creator: 'Dana' }, app: { TotalTime: '45', Words: '0' }, paragraphs: Array(8).fill(null) }), 'tool.docx', NOW);
assert.deepEqual(ids(f), ['statsMismatch']);
ok('Word counter says 0 words for a 480-word file: written by another program');

f = await inspectDocx(await docx({ app: null, paragraphs: Array(8).fill(null) }), 'gdocs.docx', NOW);
assert.deepEqual([ids(f), f.score], [['exported'], 50]);
ok('export from another editor (no app.xml): a note, score stays neutral');

f = await inspectDocx(await docx({ paragraphs: ['00A10001', '00A10002'] }), 'short.docx', NOW);
assert.deepEqual([ids(f), f.score], [[], 50]);
ok('short file (120 words): no editing-history findings');

f = await inspectDocx(await docx({ rels: ['https://example.org/a?utm_source=chatgpt.com', 'https://example.org/b?x=1&amp;utm_source=chatgpt.com', 'https://example.org/c'], comments: true }), 'links.docx', NOW);
assert.deepEqual(f.findings.find((x) => x.id === 'aiLink')?.vars, { count: 2, source: 'chatgpt.com' });
assert.ok(ids(f).includes('trackedChanges'));
ok('links tagged utm_source=chatgpt.com are counted; comments count as human process');

f = await inspectDocx(await docx({ core: { created: '2026-10-05T10:00:00Z', modified: '2026-09-01T10:00:00Z' } }), 'dates.docx', NOW);
assert.ok(ids(f).includes('dateInconsistent'));
f = await inspectDocx(await docx({ core: { created: '2031-01-01T10:00:00Z', modified: '2031-01-02T10:00:00Z' } }), 'future.docx', NOW);
assert.ok(ids(f).includes('dateInconsistent'));
ok('saved before created / dated in the future: flagged as a note');

f = await inspectDocx(
  await docx({
    media: {
      'image1.png': png(1024, 1024, [chunk('caBX', Buffer.from('jumb c2pa trainedAlgorithmicMedia OpenAI', 'latin1'))]),
      'image2.png': png(640, 480, [text('Software', 'Matplotlib version3.9.0')]),
      'image3.jpeg': jpeg(3000, 2000, [[0xe1, exifSegment('Apple', 'iPhone 15')]]),
      'image4.png': png(16, 16),
      'image5.png': png(1536, 1024),
    },
    bodyExtra: '<w:p><w:r><w:drawing><wp:docPr id="1" name="Picture 1" descr="ChatGPT Image Apr 5, 2026, 10_00_00 AM.png"/><pic:cNvPr id="0" name="A chart. AI-generated content may be incorrect."/></w:drawing></w:r></w:p>',
  }),
  'figures.docx',
  NOW,
);
assert.equal(f.figures, 4, 'the 16px icon is not a figure');
assert.deepEqual(
  Object.fromEntries(f.findings.filter((x) => x.id.startsWith('figure')).map((x) => [x.id, [x.vars?.count, x.vars?.detail]])),
  { figureAiCredentials: [1, 'OpenAI'], figurePlotLib: [1, 'Matplotlib'], figureCamera: [1, 'Apple iPhone 15'], figureGenSize: [1, '1536×1024'], figureAiFilename: [1, 'ChatGPT'] },
);
ok('figures: C2PA, chart library, camera, generator size, generator file name; Word\'s own "AI-generated" alt text is ignored');

// ---------- pdf ----------
assert.equal(pdfDate("D:20261114055846+02'00'")?.toISOString(), '2026-11-14T03:58:46.000Z');
assert.equal(pdfDate('D:20240131')?.toISOString(), '2024-01-31T00:00:00.000Z');
assert.equal(pdfDate('garbage'), undefined);
ok('PDF dates');

const pdfBytes = Buffer.concat([
  Buffer.from('%PDF-1.7\n5 0 obj\n<< /Type /XObject /Subtype /Image /Width 1024 /Height 1024 /Filter /DCTDecode /Length 99 >>\nstream\n', 'latin1'),
  jpeg(1024, 1024, [[0xeb, Buffer.from('JP jumb c2pa trainedAlgorithmicMedia', 'latin1')]]),
  Buffer.from('\nendstream\nendobj\n6 0 obj\n<< /Subtype /Image /Width 800 /Height 600 /Filter /FlateDecode >>\nstream\nxxxx\nendstream\nendobj\n7 0 obj\n<< /Subtype /Image /ImageMask true /Width 500 /Height 500 >>\nstream\nx\nendstream\n8 0 obj\n<< /Subtype /Image /Width 20 /Height 20 >>\nstream\nx\nendstream\n', 'latin1'),
]);
assert.deepEqual(pdfFigures(pdfBytes).map((x) => [x.width, x.height, !!x.bytes]), [[1024, 1024, true], [800, 600, false], [20, 20, false]]);
ok('PDF image objects found; masks skipped; JPEG bytes cut out');

f = inspectPdf(pdfBytes, 'a.pdf', { Producer: 'ReportLab PDF Library - (opensource)', Creator: '(unspecified)', Author: '(anonymous)', CreationDate: 'D:20261101120000Z' }, ['https://x.org/?utm_source=chatgpt.com'], 900, NOW);
assert.deepEqual(ids(f), ['aiLink', 'figureAiCredentials', 'pdfGeneratorLibrary']);
assert.equal(f.figures, 2);
assert.ok(f.score >= 95);
ok(`ReportLab PDF with a tagged link and an AI-credentialed figure (${f.score})`);

f = inspectPdf(new Uint8Array(), 'chat.pdf', { Title: 'ChatGPT - Essay help', Producer: 'Skia/PDF m130', Creator: 'Mozilla/5.0 Chrome/130' }, [], 500, NOW);
assert.deepEqual(ids(f), ['pdfChatPrint']);
f = inspectPdf(new Uint8Array(), 'paper.pdf', { Title: 'ChatGPT in the classroom: a survey', Producer: 'Microsoft® Word for Microsoft 365', Creator: 'Microsoft® Word for Microsoft 365' }, [], 500, NOW);
assert.deepEqual([ids(f), f.score], [[], 50]);
ok('browser print of a chat page is flagged; a Word-exported paper about ChatGPT is not');

f = inspectPdf(new Uint8Array(), 'tex.pdf', { Producer: 'pdfTeX-1.40.25', Creator: 'LaTeX with hyperref' }, [], 500, NOW);
assert.deepEqual(ids(f), ['pdfLatex']);
assert.ok(f.score < 50);
ok('LaTeX PDF: weak human sign');

// ---------- score ----------
assert.equal(fileScore([]), 50);
assert.equal(fileScore([finding('exported'), finding('figurePlotLib')]), 50);
assert.equal(fileScore([finding('figureAiCredentials'), finding('figureAiMetadata'), finding('figureAiFilename')]), fileScore([finding('figureAiCredentials'), finding('figureGenSize')]));
ok('notes do not move the score; figures are capped');

const sentences = Array.from({ length: 20 }, (_, i) => ({ id: i, paragraph: 0, text: 'x', lang: 'en' as const, words: 20 }));
const results = Object.fromEntries(sentences.map((s) => [s.id, { id: s.id, probability: 20, heuristic: 0, llm: 20, patterns: [], hits: [], status: 'done' as const }]));
const doc = { style: 30, features: { sentences: 20, hitRate: 0, triadRate: 0, connectorRate: 0, citationRate: 0, cv: 0.5, avgLen: 20 }, llm: 20, status: 'done' as const };
const file = (score: number): FileForensics => ({ kind: 'docx', fileName: 'x', score, findings: [], meta: {}, figures: 0 });
const base = overallScore(sentences, results, undefined, doc).probability;
assert.equal(overallScore(sentences, results, undefined, doc, file(50)).probability, base);
const up = overallScore(sentences, results, undefined, doc, file(92)).probability;
const down = overallScore(sentences, results, undefined, doc, file(15)).probability;
assert.ok(up > base && up < 50 && down < base, `${down} < ${base} < ${up} < 50`);
ok(`overall score: neutral file changes nothing; findings nudge it (${down} < ${base} < ${up}) without overruling the text`);

// ---------- dictionaries ----------
const FINDINGS: FindingId[] = ['generatorLibrary', 'statsMismatch', 'fastTyping', 'singleSession', 'createdEqualsModified', 'longEditing', 'manySessions', 'trackedChanges', 'exported', 'pdfGeneratorLibrary', 'pdfChatPrint', 'pdfLatex', 'dateInconsistent', 'aiLink', 'figureAiCredentials', 'figureAiMetadata', 'figureAiFilename', 'figureGenSize', 'figurePlotLib', 'figureCamera'];
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
for (const id of FINDINGS) {
  assert.ok(he.file.findings[id] && en.file.findings[id], `text for ${id}`);
  assert.equal(holes(he.file.findings[id]), holes(en.file.findings[id]), `same placeholders for ${id}`);
}
ok('every finding has Hebrew and English text with the same placeholders');

console.log(`\n${n} checks passed`);
