/**
 * What an embedded image says about where it came from. Only the image's metadata is read (PNG
 * text chunks, JPEG APPn segments, EXIF), never the pixels: there is no reliable way to tell an AI
 * picture from its pixels alone, and we do not pretend to.
 */

export type ImageMark =
  /** Content Credentials (C2PA) manifest that declares AI generation. */
  | 'c2pa-ai'
  /** Metadata written by an image generator (IPTC "trainedAlgorithmicMedia", Stable Diffusion parameters, a generator's name). */
  | 'ai-metadata'
  /** Drawn by a plotting library. */
  | 'plot-lib'
  /** EXIF camera make/model. */
  | 'camera'
  /** Pixel size that image generators output by default. */
  | 'gen-size';

export interface ImageInfo {
  format: 'png' | 'jpeg' | 'gif' | 'other';
  width?: number;
  height?: number;
  marks: ImageMark[];
  /** Name of the tool the mark points to (generator, plotting library or camera), when known. */
  tool?: string;
}

const AI_TOOLS: [RegExp, string][] = [
  [/DALL[·\-_. ]?E/i, 'DALL·E'],
  [/ChatGPT|OpenAI|gpt-image/i, 'OpenAI'],
  [/Midjourney/i, 'Midjourney'],
  [/Stable ?Diffusion|stability\.ai|Automatic1111|ComfyUI|InvokeAI|NovelAI/i, 'Stable Diffusion'],
  [/Adobe Firefly/i, 'Adobe Firefly'],
  [/Made with Google AI|\bImagen[ -]?\d|Gemini/i, 'Google AI'],
  [/Bing Image Creator|Microsoft Designer|Copilot/i, 'Microsoft'],
  [/\bGrok\b|\bxAI\b/, 'Grok'],
  [/Ideogram/i, 'Ideogram'],
  [/black-forest-labs|\bFLUX\b/, 'FLUX'],
];
const PLOT_TOOLS: [RegExp, string][] = [
  [/Matplotlib/i, 'Matplotlib'],
  [/plotly/i, 'Plotly'],
  [/ggplot|R Graphics/i, 'R'],
  [/gnuplot/i, 'gnuplot'],
];
/** IPTC digital source types that mean "made by a generative model". */
const AI_SOURCE_TYPE = /trainedAlgorithmicMedia/i;
/** PNG text keys written by Stable Diffusion front ends. */
const SD_KEYS = /^(parameters|prompt|workflow|sd-metadata|invokeai_metadata|Dream)$/;

/** Default output sizes of common image generators. */
export const GEN_SIZES = new Set([
  '1024x1024', '1792x1024', '1024x1792', '1536x1024', '1024x1536', '512x512', '768x768', '2048x2048',
  '1344x768', '768x1344', '1152x896', '896x1152', '1216x832', '832x1216', '1408x768', '768x1408',
]);

const latin1 = new TextDecoder('latin1');
const str = (b: Uint8Array, from: number, to: number) => latin1.decode(b.subarray(Math.max(0, from), Math.min(b.length, to)));
const u16 = (b: Uint8Array, o: number, le = false) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const u32 = (b: Uint8Array, o: number, le = false) =>
  (le ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24) : (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function toolIn(text: string, list: [RegExp, string][]): string | undefined {
  return list.find(([re]) => re.test(text))?.[1];
}

/** EXIF IFD0 strings (Make, Model, Software) from a TIFF block starting at `o`. */
function exif(b: Uint8Array, o: number): { make?: string; model?: string; software?: string } {
  const out: { make?: string; model?: string; software?: string } = {};
  if (o + 8 > b.length) return out;
  const le = b[o] === 0x49;
  if (!le && b[o] !== 0x4d) return out;
  const ifd = o + u32(b, o + 4, le);
  if (ifd + 2 > b.length) return out;
  const n = Math.min(u16(b, ifd, le), 64);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > b.length) break;
    const tag = u16(b, e, le);
    if (tag !== 0x010f && tag !== 0x0110 && tag !== 0x0131) continue;
    const count = u32(b, e + 4, le);
    const at = count <= 4 ? e + 8 : o + u32(b, e + 8, le);
    const v = str(b, at, at + Math.min(count, 80)).replace(/\0.*$/, '').trim();
    if (!v) continue;
    if (tag === 0x010f) out.make = v;
    else if (tag === 0x0110) out.model = v;
    else out.software = v;
  }
  return out;
}

/** Inspect one image file (as embedded in a .docx, or a JPEG stream cut out of a PDF). */
export function inspectImage(b: Uint8Array): ImageInfo {
  const info: ImageInfo = { format: 'other', marks: [] };
  /** Metadata text collected from the file, and whether a C2PA manifest is present. */
  let text = '';
  let c2pa = '';
  let sdKey = false;
  let cam: ReturnType<typeof exif> = {};

  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    info.format = 'png';
    let o = 8;
    while (o + 12 <= b.length) {
      const len = u32(b, o);
      const type = str(b, o + 4, o + 8);
      const data = o + 8;
      if (type === 'IHDR') {
        info.width = u32(b, data);
        info.height = u32(b, data + 4);
      } else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
        const chunk = str(b, data, data + Math.min(len, 20000));
        const key = chunk.split('\0')[0];
        if (SD_KEYS.test(key)) sdKey = true;
        // zTXt bodies are compressed: only the key is readable
        text += (type === 'zTXt' ? key : chunk) + '\n';
      } else if (type === 'caBX') {
        c2pa += str(b, data, data + Math.min(len, 400000));
      } else if (type === 'eXIf') {
        cam = exif(b, data);
      } else if (type === 'IEND') break;
      o = data + len + 4;
    }
  } else if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    info.format = 'jpeg';
    let o = 2;
    while (o + 4 <= b.length && b[o] === 0xff) {
      const marker = b[o + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        o += 2;
        continue;
      }
      const len = u16(b, o + 2);
      const data = o + 4;
      const end = o + 2 + len;
      if ((marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) && data + 5 <= b.length) {
        info.height = u16(b, data + 1);
        info.width = u16(b, data + 3);
      } else if (marker === 0xe1 && str(b, data, data + 6) === 'Exif\0\0') {
        cam = exif(b, data + 6);
      } else if (marker === 0xeb) {
        // APP11 carries JUMBF boxes: the C2PA manifest store
        c2pa += str(b, data, end);
      } else if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
        text += str(b, data, Math.min(end, data + 20000)) + '\n';
      }
      if (marker === 0xda) break; // start of scan: pixel data follows
      o = end;
    }
  } else if (b.length > 10 && str(b, 0, 4) === 'GIF8') {
    info.format = 'gif';
    info.width = u16(b, 6, true);
    info.height = u16(b, 8, true);
  }

  if (cam.software) text += cam.software + '\n';
  const hasC2pa = /c2pa|jumb/i.test(c2pa);
  if (hasC2pa && (AI_SOURCE_TYPE.test(c2pa) || toolIn(c2pa, AI_TOOLS))) {
    info.marks.push('c2pa-ai');
    info.tool = toolIn(c2pa, AI_TOOLS);
  } else if (AI_SOURCE_TYPE.test(text) || sdKey || toolIn(text, AI_TOOLS)) {
    info.marks.push('ai-metadata');
    info.tool = toolIn(text, AI_TOOLS) || (sdKey ? 'Stable Diffusion' : undefined);
  } else if (toolIn(text, PLOT_TOOLS)) {
    info.marks.push('plot-lib');
    info.tool = toolIn(text, PLOT_TOOLS);
  } else if (cam.make || cam.model) {
    info.marks.push('camera');
    info.tool = [cam.make, cam.model].filter(Boolean).join(' ');
  } else if (info.width && info.height && GEN_SIZES.has(`${info.width}x${info.height}`)) {
    info.marks.push('gen-size');
  }
  return info;
}

/** File names that AI image tools give their downloads. */
const AI_FILENAMES: [RegExp, string][] = [
  [/ChatGPT[ _]Image/i, 'ChatGPT'],
  [/DALL[·\-_. ]?E[ _-]\d|DALL·E/i, 'DALL·E'],
  [/Gemini_Generated_Image/i, 'Gemini'],
  [/midjourney/i, 'Midjourney'],
  [/image_fx/i, 'ImageFX'],
  [/Firefly[ _]/i, 'Adobe Firefly'],
  [/grok[-_ ]image/i, 'Grok'],
  [/stable[-_ ]?diffusion/i, 'Stable Diffusion'],
  [/ideogram/i, 'Ideogram'],
];
export function aiFilename(name: string): string | undefined {
  return toolIn(name, AI_FILENAMES);
}
