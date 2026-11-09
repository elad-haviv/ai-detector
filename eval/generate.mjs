// Generate AI-written Hebrew texts on the same topics as the Wikipedia controls.
// The prompt contains only the topic: no Wikipedia text is given to the models.
// Usage: NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=... node eval/generate.mjs
import { existsSync, readFileSync, writeFileSync } from 'fs';

const KEY = process.env.OPENROUTER_API_KEY || 'proxy-injected';
const PLAN = [
  ['anthropic/claude-opus-5.5', 'photosynthesis', 'פוטוסינתזה'],
  ['anthropic/claude-opus-5.5', 'industrial-revolution', 'המהפכה התעשייתית'],
  ['openai/gpt-6-astra', 'immune-system', 'מערכת החיסון'],
  ['openai/gpt-6-astra', 'renewable-energy', 'אנרגיה מתחדשת'],
  ['google/gemini-4-argon', 'behaviorism', 'ביהביוריזם'],
  ['google/gemini-4-argon', 'democracy', 'דמוקרטיה'],
];
const prompt = (topic) =>
  `כתוב טקסט אינפורמטיבי בעברית בנושא "${topic}", באורך של כ-380 מילים, ב-3 עד 4 פסקאות. משלב כתיבה אנציקלופדי-אקדמי. פרוזה רציפה בלבד: בלי כותרות, בלי רשימות ובלי הדגשות. החזר רק את הטקסט.`;

const meta = existsSync('eval/texts/generated.json') ? JSON.parse(readFileSync('eval/texts/generated.json', 'utf8')) : {};
await Promise.all(
  PLAN.map(async ([model, slug, topic]) => {
    const short = model.split('/')[1];
    const file = `eval/texts/ai-${short}-${slug}.txt`;
    if (existsSync(file)) return;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, 'X-Title': 'Penprint eval' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt(topic) }], max_tokens: 8000 }),
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`${model} ${slug}: ${JSON.stringify(data).slice(0, 300)}`);
    writeFileSync(file, text);
    meta[`${short}-${slug}`] = { model, topic, prompt: prompt(topic), generation_id: data.id, usage: data.usage, words: text.split(/\s+/).length };
    console.log('ok', model, slug, meta[`${short}-${slug}`].words, 'words');
  }),
);
writeFileSync('eval/texts/generated.json', JSON.stringify(meta, null, 2));
