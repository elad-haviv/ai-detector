// Generates eval/RESULTS.md from the saved runs in eval/results/*.json.
// Every number in that file is computed here; nothing is typed by hand.
// Usage: node eval/make-report.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';

const dir = 'eval/results';
const runs = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ id: f.slice(0, 19), file: f, ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) }));
if (!runs.length) throw new Error('no runs in eval/results');
const first = runs[0];
const last = runs[runs.length - 1];

const isAiSentence = (r, i) => r.label === 'ai' || (r.label === 'mixed' && r.sentenceTruth?.[i] === 'A');
const range = (xs) => (xs.length ? `${Math.min(...xs)}–${Math.max(...xs)}` : '—');
const val = (x) => (x === undefined || x === null ? '—' : x);
const auroc = (pos, neg) => {
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return pos.length && neg.length ? s / (pos.length * neg.length) : NaN;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const flagged = (r) => r.sentenceFinal.filter((p) => p >= 55).length;

const L = [];
L.push('# תוצאות הערכה (נוצר אוטומטית)', '');
L.push(`הקובץ נוצר על ידי \`eval/make-report.mjs\` מתוך ${runs.length} הרצות ב-\`eval/results/\`. אין בו מספרים שהוקלדו ידנית.`, '');
L.push(`- הרצה ראשונה (לפני השינויים): \`${first.id}\``);
L.push(`- הרצה אחרונה (המנוע הנוכחי): \`${last.id}\`, מודל ניתוח \`${last.config.model}\`, מודל החלטה \`${last.config.decisionModel || '—'}\``, '');

L.push('## לפי טקסט', '', 'ציון כולל · משפטים שסומנו (≥55%).', '');
L.push('| קובץ | הרצה ראשונה | הרצה אחרונה | שיפוט מסמך | מדד סגנון | JEV (גולמי) | ציוני פסקאות |', '|---|---|---|---|---|---|---|');
const byFile = Object.fromEntries(first.results.map((r) => [r.file, r]));
for (const r of last.results) {
  const o = byFile[r.file];
  const paras = r.paragraphScores ? Object.values(r.paragraphScores).join(', ') : '—';
  L.push(
    `| ${r.file.replace('.txt', '')} | ${o ? `${o.overall}% · ${o.flagged55}/${o.sentences}` : '—'} | **${r.overall}%** · ${flagged(r)}/${r.sentences} | ${val(r.docLLM)} | ${r.style} | ${val(r.docDecision)} | ${paras} |`,
  );
}

L.push('', '## משפטים (הרצה אחרונה)', '');
const rows = last.results.flatMap((r) =>
  r.sentenceFinal.map((p, i) => ({ ai: isAiSentence(r, i), final: p, llm: r.sentenceLLM[i], dec: r.sentenceDecision[i], rules: r.sentenceHeuristic?.[i] })),
);
const A = rows.filter((x) => x.ai);
const H = rows.filter((x) => !x.ai);
L.push(`- משפטי AI שסומנו: **${A.filter((x) => x.final >= 55).length} מתוך ${A.length}**`);
L.push(`- משפטים אנושיים שסומנו: **${H.filter((x) => x.final >= 55).length} מתוך ${H.length}**`, '');
L.push('| אות | AUROC | ממוצע AI | ממוצע אנושי |', '|---|---|---|---|');
for (const [name, k] of [['מודל שפה (עם הקשר)', 'llm'], ['JEV ברמת משפט', 'dec'], ['כללים מקומיים', 'rules']]) {
  const pos = A.map((x) => x[k]).filter((v) => v !== undefined && v !== null);
  const neg = H.map((x) => x[k]).filter((v) => v !== undefined && v !== null);
  L.push(`| ${name} | ${auroc(pos, neg).toFixed(3)} | ${mean(pos).toFixed(1)} | ${mean(neg).toFixed(1)} |`);
}

const mixed = last.results.filter((r) => r.label === 'mixed');
if (mixed.length) {
  L.push('', '## מסמכים מעורבים (הרצה אחרונה)', '');
  for (const r of mixed) {
    const tp = r.sentenceFinal.filter((p, i) => p >= 55 && r.sentenceTruth[i] === 'A').length;
    const fp = r.sentenceFinal.filter((p, i) => p >= 55 && r.sentenceTruth[i] === 'H').length;
    const nA = r.sentenceTruth.filter((t) => t === 'A').length;
    L.push(
      `- \`${r.file}\`: ציון כולל ${r.overall}%. משפטי AI שסומנו ${tp}/${nA}, אנושיים ${fp}/${r.sentenceTruth.length - nA}. ציוני פסקאות: ${r.paragraphScores ? JSON.stringify(r.paragraphScores) : '—'}`,
    );
  }
}

L.push('', '## כל ההרצות', '', '| הרצה | ציון כולל AI | ציון כולל אנושי | שיפוט מסמך AI | שיפוט מסמך אנושי | שיפוט מסמך נכשל |', '|---|---|---|---|---|---|');
for (const run of runs) {
  const pick = (lab, k) => run.results.filter((r) => r.label === lab && r[k] !== undefined && r[k] !== null).map((r) => r[k]);
  const failed = run.results.filter((r) => r.docLLM === undefined || r.docLLM === null).map((r) => r.file.replace('.txt', ''));
  L.push(`| \`${run.id}\` | ${range(pick('ai', 'overall'))} | ${range(pick('human', 'overall'))} | ${range(pick('ai', 'docLLM'))} | ${range(pick('human', 'docLLM'))} | ${failed.join(', ') || '—'} |`);
}

writeFileSync('eval/RESULTS.md', L.join('\n') + '\n');
console.log('wrote eval/RESULTS.md from', runs.length, 'runs');
