---
name: penprint-docx
description: Analyze a Word (.docx) document the way the Penprint website does. Finds sentences that read like AI-written text (Hebrew or English academic prose), rewrites the flagged ones in the author's own voice directly inside the .docx with the original formatting kept, and produces a Word report. Use when the user gives a .docx and asks to check it for AI-style writing, humanize or fix it, or get a Penprint report.
---

# penprint-docx

Does for a `.docx` what the Penprint site does: per-sentence AI-likelihood, an explanation, a rewrite, an edited
Word file, and a report. **You (Claude) are the language model**, so no API key is needed. Scripts handle the
deterministic parts and reuse the site's own code (`src/lib/heuristics.ts`, `segment.ts`, `prompts.ts`,
`patterns/catalog.ts`), so scores and wording stay in sync with the site.

Requirements: Node ≥ 22.15 (no `npm install`), Python with `python-docx` and `lxml`. Run from anywhere; `S` below is
this skill's `scripts/` directory. Use a scratch working directory `W` for intermediate files.

## Integrity rules (from the site's prompts, keep them)

- The result is an **estimate, never a verdict**. Never say "this was written by AI".
- The goal is better writing in the author's voice, not evading detection. Do not add facts, sources, numbers or
  claims. Keep citations, numbers, names and terminology exactly. If a sentence is empty filler, shorten it and use a
  bracketed placeholder such as `[לציין איזה ממצא]` / `[specify which finding]`.
- Tell the user to read every change before submitting; they are responsible for their institution's rules on AI
  use and disclosure.
- Never overwrite the user's original file. Write the fixed copy and the report next to it.

## Reading the user's request

- **File:** the `.docx` the user attached or named. If it was uploaded to the chat, locate it on disk (check the
  upload/working directory) before step 1. If it is not a `.docx`, say so and stop.
- **Threshold:** if the user states a percentage ("תקן מ-70% ומעלה", "fix anything above 40%"), use exactly that as
  `--threshold N` (0-100). Only when they give none, use the default 55 and tell them. A lower number fixes more
  sentences, a higher one fewer.
- Answer in the user's language (Hebrew or English).

## Steps

1. **Extract and run the local pass**
   ```bash
   python3 $S/docx_io.py extract "<in.docx>" $W/blocks.json
   $S/run.sh analyze $W/blocks.json $W/analysis.json $W/rubric.md
   ```
   `analysis.json` holds sentences (`id`, `paragraph`, `text`), local pattern hits, style metrics and `chunks`
   (sentence ids in groups of ≤30). `rubric.md` is the site's prompts with the pattern list filled in.
   The command prints counts; if the document has no text (scanned/empty) tell the user and stop.

2. **Read `$W/rubric.md` fully, then judge in two passes** (same order as the site):
   - **Pass 1, document:** follow "Pass 1" using the style metrics and `analysis.paragraphs`. Produce
     `ai_probability`, a per-paragraph `paragraphs` score for every `i`, `ai_evidence`, `human_evidence`, `summary`.
   - **Pass 2, sentences:** follow "Pass 2" for each chunk in `analysis.chunks`, using the pass-1 result as the
     prior (paragraph score first, then document score). Score every sentence once. Give `patterns` (ids from the
     pattern list only), a short `explanation` quoting the offending words, and a `rewrite` only when
     `ai_probability ≥ 40`, otherwise `null`. For long documents (more than ~4 chunks) you may hand chunks to
     subagents, giving each the rubric's Pass 2 text, its sentences, and the pass-1 result; keep pass 1 yourself.

   Write `$W/judgments.json`:
   ```json
   {"document": {"ai_probability": 0, "paragraphs": [{"i": 0, "ai_probability": 0}],
                 "ai_evidence": [], "human_evidence": [], "summary": ""},
    "sentences": [{"id": 0, "ai_probability": 0, "patterns": [], "explanation": "", "rewrite": null}]}
   ```
   Write explanations and summary in the document's language (the rubric says which); `rewrite` stays in the
   sentence's own language. Paragraph numbers in `paragraphs[].i` are `analysis.sentences[].paragraph`.

3. **Score and pick fixes**
   ```bash
   $S/run.sh score $W/analysis.json $W/judgments.json $W/scored.json [--threshold 55] [--lang he|en] [--keep-placeholders]
   ```
   Blends your judgments with the local signals exactly as the site does. `--threshold` is the user's percentage if given; otherwise
   the site's "medium" 55 (site presets: low 70, high 40). A flagged sentence is rewritten when it has a usable rewrite;
   rewrites that contain a `[placeholder]` for the author are **not** applied by default (they go to the report's
   "needs your input" list) unless `--keep-placeholders`. Use `-` instead of `judgments.json` for local rules
   only (no rewrites; the score is then only an indication; say so).

4. **Write the fixed document and the report**
   ```bash
   python3 $S/docx_io.py apply "<in.docx>" $W/scored.json "<name> (fixed).docx"
   python3 $S/docx_io.py report $W/scored.json "<name> (report).docx"
   ```
   `apply` edits only the runs a changed sentence spans, so all other formatting is untouched, then re-reads the
   output and verifies every rewrite landed (non-zero exit if a sentence could not be located; it then leaves that
   paragraph unchanged). The report is a Word file in Hebrew (RTL) or English per the document: overall score and
   band, confidence, summary and evidence, stats, paragraph scores, patterns with fixes, a before/after table, and
   the sentences left for the author.

5. **Tell the user**, briefly: the overall likelihood and confidence (and that it is an estimate), how many
   sentences were flagged / rewritten / left for them, the paths of the two files, and the top 2-3 patterns to watch.
   Offer to re-run with a different `--threshold`, or to apply the placeholder rewrites after they fill them in.

## Notes

- Headers, footers, footnotes and text boxes are not analyzed (same as the site: body paragraphs and tables).
- Sentence splitting uses `Intl.Segmenter`, with the site's abbreviation handling.
- Rewrites are not re-scored by a model after applying; the report's numbers describe the original text.
