#!/usr/bin/env python3
"""Word (.docx) side of the penprint-docx skill. Only needs python-docx + lxml.

  docx_io.py extract <in.docx> <blocks.json>
  docx_io.py apply   <in.docx> <scored.json> <out.docx>
  docx_io.py report  <scored.json> <report.docx>

`apply` mirrors src/lib/docx/model.ts: the document XML stays the source of truth, sentences are located
inside each <w:p> by character offsets over its <w:t> runs, and only the runs a sentence spans are
rewritten, so every other run keeps its exact formatting.
"""
import json, re, sys, zipfile, datetime, os
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
XML = 'http://www.w3.org/XML/1998/namespace'
q = lambda t: '{%s}%s' % (W, t)
DOC = 'word/document.xml'
IGNORABLE = re.compile('[\\s​-‏‪-‮⁦-⁩﻿ ]')


def para_slots(p):
    """<w:t> elements that belong to this paragraph (not to a nested one, e.g. a text box)."""
    out = []
    for t in p.iter(q('t')):
        a = t.getparent()
        while a is not None and a.tag != q('p'):
            a = a.getparent()
        if a is p:
            out.append(t)
    return out


def paras(root):
    return list(root.iter(q('p')))


def load(path):
    with zipfile.ZipFile(path) as z:
        if DOC not in z.namelist():
            raise SystemExit('not a Word document (.docx): ' + path)
        return etree.fromstring(z.read(DOC))


def text_of(slots):
    return ''.join(t.text or '' for t in slots)


def norm_map(raw):
    norm, m = [], []
    for i, ch in enumerate(raw):
        if IGNORABLE.match(ch):
            continue
        norm.append(ch)
        m.append(i)
    return ''.join(norm), m


def find_loose(hay, needle, start=0):
    """Find needle in hay ignoring whitespace/bidi marks; returns raw (start, end) or None."""
    h, hm = norm_map(hay)
    n, _ = norm_map(needle)
    if not n:
        return None
    first = next((k for k, r in enumerate(hm) if r >= start), None)
    if first is None:
        return None
    i = h.find(n, first)
    if i < 0:
        return None
    return hm[i], hm[i + len(n) - 1] + 1


def replace_range(slots, start, end, text):
    pos, placed = 0, False
    for t in slots:
        v = t.text or ''
        a, b = pos, pos + len(v)
        pos = b
        if b <= start or a >= end:
            continue
        lo, hi = max(0, start - a), min(len(v), end - a)
        t.text = v[:lo] + ('' if placed else text) + v[hi:]
        t.set('{%s}space' % XML, 'preserve')
        placed = True


def blocks_of(root):
    out = []
    for i, p in enumerate(paras(root)):
        txt = text_of(para_slots(p))
        if txt.strip():
            b = {'pIndex': i, 'text': txt}
            # equations, images, embedded objects: not text runs, so a rewrite could misplace them
            if p.find('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath') is not None or any(
                    True for _ in p.iter(q('drawing'), q('object'), q('pict'))):
                b['obj'] = True
            out.append(b)
    return out


def cmd_extract(src, dst):
    root = load(src)
    blocks = blocks_of(root)
    json.dump({'source': {'fileName': os.path.basename(src)}, 'blocks': blocks}, open(dst, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({'blocks': len(blocks), 'chars': sum(len(b['text']) for b in blocks)}))


def cmd_apply(src, scored_path, dst):
    sc = json.load(open(scored_path))
    with zipfile.ZipFile(src) as z:
        root = etree.fromstring(z.read(DOC))
        names = z.namelist()
        ps = paras(root)
        blocks = blocks_of(root)
        by_block = {}
        for e in sc['edits']:
            by_block.setdefault(e['block'], []).append(e)
        sents_by_block = {}
        for s in sc['sentences']:
            sents_by_block.setdefault(s['paragraph'], []).append(s)
        done, failed = [], []
        for bi, edits in by_block.items():
            slots = para_slots(ps[blocks[bi]['pIndex']])
            full = text_of(slots)
            # locate every original sentence of the block in order (fails safe: block untouched)
            ranges, cursor, ok = {}, 0, True
            for s in sents_by_block[bi]:
                r = find_loose(full, s['text'], cursor)
                if not r:
                    ok = False
                    break
                ranges[s['id']] = r
                cursor = r[1]
            if not ok:
                failed += [e['id'] for e in edits]
                continue
            for e in sorted(edits, key=lambda e: -ranges[e['id']][0]):  # right to left keeps offsets valid
                replace_range(slots, ranges[e['id']][0], ranges[e['id']][1], e['new'])
                done.append(e['id'])
        data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as out:
            for item in z.infolist():
                out.writestr(item, data if item.filename == DOC else z.read(item.filename))
    # verify: every applied rewrite is now present, every original is gone
    after = ''.join(b['text'] + '\n' for b in blocks_of(load(dst)))
    missing = [e['id'] for e in sc['edits'] if e['id'] in done and not find_loose(after, e['new'])]
    print(json.dumps({'applied': len(done), 'could_not_locate': failed, 'verify_missing': missing}))
    if failed or missing:
        sys.exit(1)


# ---------------------------------------------------------------- report
T = {
    'en': dict(
        title='Penprint report', file='File', date='Date', score='Likelihood of AI-style writing', conf='Confidence',
        basis_model='Based on a language-model reading plus local pattern rules.',
        basis_local='Local pattern rules and style measures only (no language-model reading). This is only an indication.',
        estimate='This is an estimate, never a verdict. Formal academic writing can score high without any AI involved.',
        summary='Summary', ai_ev='What reads as AI-style', human_ev='What reads as human',
        glance='At a glance', sentences='Sentences', words='Words', flagged='Flagged (≥ {t}%)', applied='Rewrites applied',
        needs='Need your input', avg='Average sentence length (words)', burst='Sentence-length variation (higher is more human)',
        lex='Lexical diversity (MATTR)', paras='Paragraphs', para='Paragraph', start='Starts with', prob='Likelihood',
        patterns='Patterns found', pattern='Pattern', category='Category', count='Times', fix='How to fix',
        changes='Changes applied to the document', before='Before', after='After', why='Why',
        manual='Flagged, but not changed', manual_note='These sentences were flagged but not rewritten automatically: either a rewrite needs a detail only you can supply (shown in [brackets]), or no safe rewrite was available.',
        suggested='Suggested', none_changes='No sentence needed an automatic rewrite.', none_manual='Nothing is waiting for your input.',
        note_title='About this report',
        note=['Each sentence is scored by blending a reading of the sentence in its document context, the whole-document and paragraph assessment, and local rules for known AI-style phrasing and structure (the same method as the Penprint site).',
              'Rewrites keep the meaning, numbers, names and citations, and add no new claims. Read every change before you submit: the author is responsible for the final text and for following their institution\'s rules on AI use and disclosure.',
              'The formatting of the original document is preserved; only the text of changed sentences was edited.'],
        reasons={'hasObject': 'Paragraph contains an equation or image: edit by hand', 'needsInput': 'Needs a detail from you', 'noRewrite': 'No rewrite suggested', 'localOnly': 'Local rules only, no model reading'},
        cats={'vocabulary': 'Vocabulary', 'structure': 'Structure', 'tone': 'Tone', 'formatting': 'Formatting', 'rhetoric': 'Rhetoric', 'citation': 'Citation', 'filler': 'Filler'},
    ),
    'he': dict(
        title='דוח טביעת עט', file='קובץ', date='תאריך', score='סבירות לכתיבה בסגנון AI', conf='רמת ביטחון',
        basis_model='מבוסס על קריאה של מודל שפה ועל כללים מקומיים לזיהוי דפוסים.',
        basis_local='מבוסס על כללים מקומיים ומדדי סגנון בלבד (בלי קריאה של מודל שפה). זו רק אינדיקציה.',
        estimate='זו הערכה ולא קביעה. כתיבה אקדמית פורמלית יכולה לקבל ציון גבוה גם בלי שום מעורבות של AI.',
        summary='סיכום', ai_ev='מה נשמע כמו AI', human_ev='מה נשמע אנושי',
        glance='במבט אחד', sentences='משפטים', words='מילים', flagged='מסומנים (≥ {t}%)', applied='ניסוחים שהוחלפו',
        needs='ממתינים להשלמה שלך', avg='אורך משפט ממוצע (מילים)', burst='שונות באורך המשפטים (גבוה = אנושי יותר)',
        lex='גיוון לשוני (MATTR)', paras='פסקאות', para='פסקה', start='מתחילה ב', prob='סבירות',
        patterns='דפוסים שנמצאו', pattern='דפוס', category='קטגוריה', count='מופעים', fix='איך מתקנים',
        changes='שינויים שבוצעו במסמך', before='לפני', after='אחרי', why='למה',
        manual='סומנו אך לא שונו', manual_note='המשפטים האלה סומנו אך לא נכתבו מחדש אוטומטית: או שהניסוח החלופי דורש פרט שרק את/ה יכול/ה להשלים (מופיע בסוגריים מרובעים), או שלא נמצא ניסוח בטוח.',
        suggested='הצעה', none_changes='אף משפט לא דרש ניסוח מחדש אוטומטי.', none_manual='אין משפטים שממתינים להשלמה.',
        note_title='על הדוח',
        note=['כל משפט מקבל ציון משילוב של קריאה של המשפט בהקשר המסמך, הערכה של המסמך והפסקה כולה, וכללים מקומיים לביטויים ולמבנים מוכרים של כתיבת AI (אותה שיטה כמו באתר טביעת עט).',
              'הניסוחים החלופיים שומרים על המשמעות, המספרים, השמות וההפניות, ולא מוסיפים טענות חדשות. קראו כל שינוי לפני ההגשה: האחריות לטקסט הסופי, ולציות לכללי המוסד בנושא שימוש ב-AI וגילוי נאות, היא של המחבר/ת.',
              'עיצוב המסמך המקורי נשמר; רק הטקסט של המשפטים ששונו נערך.'],
        reasons={'hasObject': 'הפסקה כוללת משוואה או תמונה: לערוך ידנית', 'needsInput': 'דורש פרט ממך', 'noRewrite': 'לא הוצע ניסוח חלופי', 'localOnly': 'כללים מקומיים בלבד, בלי קריאת מודל'},
        cats={'vocabulary': 'אוצר מילים', 'structure': 'מבנה', 'tone': 'טון', 'formatting': 'עיצוב', 'rhetoric': 'רטוריקה', 'citation': 'הפניות', 'filler': 'מילוי'},
    ),
}


def band_key(p):
    return '0-20' if p < 20 else '20-40' if p < 40 else '40-60' if p < 60 else '60-80' if p < 80 else '80-100'


def cmd_report(scored_path, dst):
    from docx import Document
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    sc = json.load(open(scored_path))
    lang = sc['lang']
    t = T[lang]
    rtl = lang == 'he'
    ui = sc['ui'][lang]
    sents = {s['id']: s for s in sc['sentences']}
    res = {int(k): v for k, v in sc['results'].items()}
    dec = {int(k): v for k, v in sc['decisions'].items()}
    thr = sc['threshold']
    ov = sc['overall']

    d = Document()
    st = d.styles['Normal']
    st.font.name = 'Calibri'
    st.font.size = Pt(10.5)
    st.element.rPr.rFonts.set(qn('w:cs'), 'Arial')
    for s in d.sections:
        s.left_margin = s.right_margin = Pt(54)

    def fix_rtl(p):
        if not rtl:
            return
        ppr = p._p.get_or_add_pPr()
        ppr.append(OxmlElement('w:bidi'))
        for r in p.runs:
            r._r.get_or_add_rPr().append(OxmlElement('w:rtl'))

    def add(text='', bold=False, size=None, color=None, style=None, italic=False):
        p = d.add_paragraph(style=style)
        if text:
            r = p.add_run(text)
            r.bold, r.italic = bold, italic
            if size: r.font.size = Pt(size)
            if color: r.font.color.rgb = RGBColor.from_string(color)
        fix_rtl(p)
        return p

    def heading(text):
        h = d.add_heading(text, level=2)
        fix_rtl(h)

    def table(headers, rows, widths=None, header=True):
        tb = d.add_table(rows=1, cols=len(headers))
        tb.style = 'Light Grid Accent 1'
        tb.alignment = WD_TABLE_ALIGNMENT.CENTER
        if rtl:
            tb._tbl.tblPr.append(OxmlElement('w:bidiVisual'))
        for i, h in enumerate(headers):
            c = tb.rows[0].cells[i]
            c.text = ''
            c.paragraphs[0].add_run(h).bold = True
            fix_rtl(c.paragraphs[0])
        for row in rows:
            cells = tb.add_row().cells
            for i, v in enumerate(row):
                cells[i].text = ''
                cells[i].paragraphs[0].add_run(str(v))
                fix_rtl(cells[i].paragraphs[0])
        if widths:
            for row in tb.rows:
                for i, w in enumerate(widths):
                    row.cells[i].width = Pt(w)
        if not header:
            tb._tbl.remove(tb.rows[0]._tr)
        d.add_paragraph()
        return tb

    d.add_heading(t['title'], level=1).alignment = None
    fix_rtl(d.paragraphs[-1])
    add('%s: %s' % (t['file'], sc['source'].get('fileName', '')), size=9, color='666666')
    add('%s: %s' % (t['date'], datetime.date.today().isoformat()), size=9, color='666666')

    band = ui['bands'][band_key(ov['probability'])]
    local = ov.get('basis') == 'local' or not sc['judged']
    add('%d%%' % ov['probability'] + ('' if not local else ''), bold=True, size=30, color='B3261E' if ov['probability'] >= 60 else 'B26A00' if ov['probability'] >= 40 else '1B6E3C')
    add('%s · %s' % (t['score'], band['label']), bold=True, size=12)
    add('%s: %s' % (t['conf'], ui['confidence'][ov['confidence']]))
    add(band['description'])
    add(t['basis_local'] if local else t['basis_model'], size=9, color='666666')
    add(t['estimate'], italic=True, size=9, color='666666')

    docm = sc['document']
    if docm.get('summary'):
        heading(t['summary'])
        add(docm['summary'])
    for key, items in (('ai_ev', docm.get('aiEvidence')), ('human_ev', docm.get('humanEvidence'))):
        if items:
            add(t[key], bold=True)
            for it in items:
                p = d.add_paragraph(it, style='List Bullet')
                fix_rtl(p)

    flagged = [i for i in sents if res[i]['probability'] >= thr]
    applied = [e for e in sc['edits']]
    manual = [i for i in flagged if dec[i]['action'] != 'apply']
    heading(t['glance'])
    stt = sc['stats']
    table([' ', ' '], [
        (t['sentences'], stt['sentences']), (t['words'], stt['words']),
        (t['flagged'].format(t=thr), '%d (%d%%)' % (len(flagged), round(100 * len(flagged) / max(1, len(sents))))),
        (t['applied'], len(applied)), (t['needs'], len(manual)),
        (t['avg'], stt['avgSentenceLength']), (t['burst'], stt['burstiness']), (t['lex'], stt['lexicalDiversity']),
    ], [260, 120], header=False)

    # paragraphs
    by_para = {}
    for s in sc['sentences']:
        by_para.setdefault(s['paragraph'], []).append(s)
    pscores = {int(k): v for k, v in (docm.get('paragraphs') or {}).items()}
    rows = []
    for pi in sorted(by_para):
        ss = by_para[pi]
        words = sum(max(1, s['words']) for s in ss)
        p = pscores.get(pi, round(sum(res[s['id']]['probability'] * max(1, s['words']) for s in ss) / words))
        if p >= 40 or any(dec[s['id']]['action'] != 'keep' for s in ss):
            start = ' '.join(ss[0]['text'].split()[:7]) + '…'
            rows.append((pi + 1, start, '%d%%' % p, sum(1 for s in ss if res[s['id']]['probability'] >= thr)))
    if rows:
        heading(t['paras'])
        table([t['para'], t['start'], t['prob'], t['flagged'].format(t=thr)], rows, [40, 260, 60, 80])

    # patterns
    counts = {}
    for i, r in res.items():
        if r['probability'] >= thr or dec[i]['action'] != 'keep':
            for pid in r['patterns']:
                counts[pid] = counts.get(pid, 0) + 1
    if counts:
        heading(t['patterns'])
        rows = []
        for pid, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            p = sc['patterns'].get(pid)
            if p:
                rows.append((p['nameHe'] if rtl else p['nameEn'], t['cats'].get(p['category'], p['category']), n, p['fixHe'] if rtl else p['fixEn']))
        table([t['pattern'], t['category'], t['count'], t['fix']], rows, [110, 70, 40, 250])

    # changes
    heading(t['changes'])
    if applied:
        table([t['before'], t['after'], t['why'], t['prob']],
              [(e['old'], e['new'], res[e['id']].get('explanation') or '', '%d%%' % res[e['id']]['probability']) for e in applied],
              [150, 150, 130, 40])
    else:
        add(t['none_changes'])

    heading(t['manual'])
    if manual:
        add(t['manual_note'], size=9, color='666666')
        table([t['before'], t['suggested'], t['why'], t['prob']],
              [(sents[i]['text'], (res[i].get('rewrite') or '—') + '\n(%s)' % t['reasons'].get(dec[i]['reason'] or '', ''), res[i].get('explanation') or '', '%d%%' % res[i]['probability']) for i in manual],
              [150, 150, 130, 40])
    else:
        add(t['none_manual'])

    heading(t['note_title'])
    for n in t['note']:
        p = d.add_paragraph(n, style='List Bullet')
        fix_rtl(p)
    d.save(dst)
    print(json.dumps({'report': dst, 'changes': len(applied), 'manual': len(manual)}))


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) == 3 and a[0] == 'extract': cmd_extract(a[1], a[2])
    elif len(a) == 4 and a[0] == 'apply': cmd_apply(a[1], a[2], a[3])
    elif len(a) == 3 and a[0] == 'report': cmd_report(a[1], a[2])
    else:
        print(__doc__)
        sys.exit(2)
