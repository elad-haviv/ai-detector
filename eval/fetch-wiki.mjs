// Fetch Hebrew Wikipedia articles as of a pre-LLM date (human-written controls).
// Usage: node eval/fetch-wiki.mjs   (writes eval/texts/human-*.txt + eval/texts/sources.json)
import { writeFileSync, existsSync, readFileSync } from 'fs';

const DATE = '2021-06-01T00:00:00Z';
const TOPICS = [
  ['photosynthesis', 'פוטוסינתזה'],
  ['industrial-revolution', 'המהפכה התעשייתית'],
  ['immune-system', 'מערכת החיסון'],
  ['renewable-energy', 'אנרגיה מתחדשת'],
  ['behaviorism', 'ביהביוריזם'],
  ['democracy', 'דמוקרטיה'],
];
const UA = 'penprint-eval/0.1 (personal research; detector evaluation)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 8; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    const wait = 5000 * 2 ** Math.min(i, 4);
    console.error(`  ${res.status}, retry in ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error('gave up: ' + url);
}

function clean(t) {
  t = t.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (let i = 0; i < 4; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\{\|[\s\S]*?\|\}/g, '');
  t = t.replace(/\[\[(?:קובץ|File|תמונה|Image):[^\]]*(?:\[\[[^\]]*\]\][^\]]*)*\]\]/g, '');
  t = t.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '');
  t = t.replace(/\[https?:\/\/\S+ ([^\]]*)\]/g, '$1').replace(/<math>[\s\S]*?<\/math>/g, 'x').replace(/<[^>]+>/g, '');
  const paras = t.split('\n').map((p) => p.trim()).filter((p) => p.length > 120 && !/^[=*#{|!:;]/.test(p));
  const out = [];
  let n = 0;
  for (const p of paras) {
    out.push(p);
    n += p.split(/\s+/).length;
    if (n >= 350) break;
  }
  return out.join('\n\n');
}

const sources = existsSync('eval/texts/sources.json') ? JSON.parse(readFileSync('eval/texts/sources.json', 'utf8')) : {};
for (const [slug, title] of TOPICS) {
  if (existsSync(`eval/texts/human-${slug}.txt`)) continue;
  const url = `https://he.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvstart=${DATE}&rvdir=older&rvlimit=1&rvprop=content|timestamp|ids&rvslots=main&format=json&formatversion=2&redirects=1`;
  console.log('fetching', title);
  const d = await get(url);
  const rev = d.query.pages[0].revisions[0];
  const text = clean(rev.slots.main.content);
  writeFileSync(`eval/texts/human-${slug}.txt`, text);
  sources[slug] = { title, revid: rev.revid, timestamp: rev.timestamp, words: text.split(/\s+/).length, url: `https://he.wikipedia.org/w/index.php?oldid=${rev.revid}` };
  writeFileSync('eval/texts/sources.json', JSON.stringify(sources, null, 2));
  console.log('  ok', rev.timestamp, sources[slug].words, 'words');
  await sleep(4000);
}
