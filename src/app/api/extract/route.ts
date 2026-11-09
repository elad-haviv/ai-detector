import { json } from '@/lib/server/http';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/** Extract plain text (paragraphs separated by blank lines) from .docx / .pdf / .txt / .md uploads. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'invalid_file' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'invalid_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return json({ error: 'too_large' }, { status: 413 });
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    let text = '';
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = buf.toString('utf8');
    } else if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const r = await mammoth.extractRawText({ buffer: buf });
      text = r.value;
    } else if (name.endsWith('.pdf')) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let line = '';
        const lines: string[] = [];
        let lastY: number | null = null;
        for (const item of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 14) {
            lines.push(line);
            line = '';
            // large vertical jump → paragraph break
            if (Math.abs(y - lastY) > 22) lines.push('');
          }
          line += item.str;
          if (item.hasEOL) {
            lines.push(line);
            line = '';
          }
          lastY = y;
        }
        if (line) lines.push(line);
        pages.push(lines.join('\n'));
      }
      // Re-join hard-wrapped lines inside a paragraph
      text = pages
        .join('\n\n')
        .split(/\n\s*\n/)
        .map((p) => p.replace(/-\n(?=\p{L})/gu, '').replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean)
        .join('\n\n');
      if (text.replace(/\s/g, '').length < 20) return json({ error: 'scanned_pdf' }, { status: 422 });
    } else {
      return json({ error: 'invalid_file' }, { status: 415 });
    }
    return json({ text: text.trim(), title: file.name.replace(/\.[^.]+$/, '') });
  } catch (e) {
    return json({ error: 'invalid_file', message: e instanceof Error ? e.message : String(e) }, { status: 422 });
  }
}
