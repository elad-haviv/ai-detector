/**
 * Catalog of AI-writing patterns ("tells") for sentence-level detection in
 * English and Hebrew academic prose.
 *
 * Sources:
 *  - wikipedia:  Wikipedia:Signs of AI writing (WikiProject AI Cleanup)
 *  - stop-slop:  github.com/hardikpandya/stop-slop (SKILL.md + references/*)
 *  - humanizer:  github.com/blader/humanizer (SKILL.md v3.1, 26 patterns)
 *
 * Regex conventions:
 *  - Every regex is a JS RegExp SOURCE string compiled with flags 'giu'.
 *    Because 'i' is always on, no pattern relies on letter case.
 *  - English uses \b (fine for ASCII words under 'u').
 *  - Hebrew never uses \b; it uses the HB / HE lookarounds below and an
 *    optional attached-prefix class (ו, ה, ב, ל, מ, ש, כ).
 *  - Patterns with no `regex` are structural/statistical and must be detected
 *    by other heuristics (sentence-length variance, triads, density) or an LLM.
 *
 * Weights are the contribution to a sentence's suspicion score when a pattern
 * fires once (0..1). Patterns marked "weak alone" in the sources get <= 0.2 and
 * should only matter when several tells co-occur.
 */

export type PatternCategory =
  | 'vocabulary'
  | 'structure'
  | 'tone'
  | 'formatting'
  | 'rhetoric'
  | 'citation'
  | 'filler';

export interface Pattern {
  id: string; // kebab-case
  category: PatternCategory;
  nameHe: string; // short Hebrew name for UI
  nameEn: string;
  descriptionHe: string; // 1-2 sentences in Hebrew: why this signals AI
  fixHe: string; // 1 sentence Hebrew: how to fix
  weight: number; // 0..1 contribution to suspicion when it fires
  source: ('wikipedia' | 'stop-slop' | 'humanizer')[];
  regex?: { en?: string[]; he?: string[] }; // JS regex SOURCE strings, flags 'giu'
}

/* ------------------------------------------------------------------ */
/* Hebrew regex helpers (sources only; nothing is compiled here)       */
/* ------------------------------------------------------------------ */

/** Hebrew word start: not preceded by a letter or combining mark (niqqud). */
const HB = String.raw`(?<![\p{L}\p{M}])`;
/** Hebrew word end: not followed by a letter or combining mark. */
const HE = String.raw`(?![\p{L}\p{M}])`;
/** Optional attached prefixes (ו, ה, ב, ל, מ, ש, כ), up to 3 (e.g. "וכשה"). */
const P = '[ובהלמשכ]{0,3}';
/** Whole Hebrew word/phrase with optional prefix. */
const he = (body: string) => `${HB}${P}(?:${body})${HE}`;
/** Hebrew phrase with start boundary + prefix, open end (for "בלב ה..." etc.). */
const heOpen = (body: string) => `${HB}${P}(?:${body})`;
/** Hebrew phrase with start boundary, NO prefix allowed. */
const heNoPrefix = (body: string) => `${HB}(?:${body})${HE}`;

/** English apostrophe (straight or curly). */
const AP = "(?:'|’)";

export const PATTERNS: Pattern[] = [
  /* ================================================================ */
  /* VOCABULARY                                                        */
  /* ================================================================ */
  {
    id: 'delve',
    category: 'vocabulary',
    nameHe: '"לצלול לעומק"',
    nameEn: 'Delve / deep dive',
    descriptionHe:
      'הפועל delve ומקבילו העברי "צוללים לעומק" הם מהסימנים המוכרים ביותר של טקסט ממודל שפה; כותבים אנושיים כמעט לא משתמשים בהם בכתיבה אקדמית.',
    fixHe: 'כתבו פשוט "נבחן", "ננתח" או פשוט הציגו את הניתוח בלי להכריז עליו.',
    weight: 0.6,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
    regex: {
      en: [String.raw`\bdelv(?:e|es|ed|ing)\b`, String.raw`\bdeep[\s-]+dives?\b`],
      he: [
        heOpen(String.raw`(?:צולל|צוללת|צוללים|צוללות|נצלול|לצלול|אצלול|צלילה)`) +
          String.raw`(?:\s+\p{L}+){0,3}?\s+${P}(?:עומק|לעומק|לעומקו|לעומקה|לעומקם|לעומקן|עמוקה?)${HE}`,
        he('צלילה עמוקה|צלילת עומק'),
      ],
    },
  },
  {
    id: 'tapestry',
    category: 'vocabulary',
    nameHe: '"שטיח" / "מארג עשיר"',
    nameEn: 'Tapestry / rich mosaic',
    descriptionHe:
      'מטאפורות טקסטיל ("שטיח עשיר", "מארג מגוון", "פסיפס צבעוני") חוזרות שוב ושוב בטקסט של מודלי שפה כדי לתאר כל דבר מורכב, ללא תוכן ממשי.',
    fixHe: 'החליפו במילה ישירה כמו "מגוון", "שילוב" או פרטו ממה מורכב הדבר.',
    weight: 0.55,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\btapestr(?:y|ies)\b`, String.raw`\brich\s+mosaic\b`],
      he: [
        he('שטיח|השטיח') + String.raw`\s+(?:עשיר|מגוון|צבעוני|של|מרהיב|ססגוני)`,
        he('מארג|פסיפס') + String.raw`\s+(?:עשיר|מגוון|צבעוני|מרהיב|ססגוני|עדין|מורכב)${HE}`,
      ],
    },
  },
  {
    id: 'testament',
    category: 'vocabulary',
    nameHe: '"עדות ל..." / "מעיד על"',
    nameEn: 'Testament / reminder',
    descriptionHe:
      'הביטויים "stands as a testament" ו-"serves as a reminder" ומקביליהם ("מהווה עדות ל", "עומד כעדות", "מהווה תזכורת") מנפחים עובדה רגילה לכדי הוכחה או לקח גדול; זהו מטבע לשון אופייני לבינה מלאכותית.',
    fixHe: 'ציינו את העובדה עצמה, ואם יש קשר סיבתי - הסבירו אותו במפורש עם מקור.',
    weight: 0.45,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\btestament\s+to\b`,
        String.raw`\b(?:enduring|lasting|living|powerful|stark)\s+testament\b`,
        String.raw`\b(?:is|was|serves\s+as|served\s+as|stands\s+as|remains)\s+a\s+(?:\w+\s+)?reminder\s+(?:of|that)\b`,
      ],
      he: [
        he('מהווה|מהווים|מהווות|מהוות|עומד|עומדת|עומדים|עומדות') + String.raw`\s+(?:כ)?עדות`,
        he('מהווה|מהווים|מהוות|משמש|משמשת|משמשים|משמשות') + String.raw`\s+(?:כ)?תזכורת\s+(?:\p{L}+\s+)?(?:ל|לכך|כי|ש)`,
        he('עדות') + String.raw`\s+(?:חיה|ברורה|נוספת|מובהקת|ניצחת|מרשימה)\s+ל`,
        he('מעיד|מעידה|מעידים|מעידות') + String.raw`\s+(?:\p{L}+\s+)?על${HE}`,
      ],
    },
  },
  {
    id: 'pivotal-crucial',
    category: 'vocabulary',
    nameHe: '"מכריע" / "קריטי" / "מרכזי"',
    nameEn: 'Pivotal / crucial / vital',
    descriptionHe:
      'מודלים מצמידים את התארים pivotal, crucial, vital, paramount לכל נושא כדי לשדר חשיבות; בעברית: "מכריע", "קריטי", "חיוני", "בעל חשיבות עליונה".',
    fixHe: 'מחקו את התואר או הסבירו במה בדיוק הדבר חשוב ובאיזו מידה.',
    weight: 0.35,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\b(?:pivotal|paramount|crucial(?:ly)?|indispensable)\b`],
      he: [
        he('מכריע|מכריעה|מכריעים|מכריעות|קריטי|קריטית|קריטיים|קריטיות|חיוני|חיונית|חיוניים|חיוניות'),
        he('בעל|בעלת|בעלי|בעלות') + String.raw`\s+חשיבות\s+(?:עליונה|מכרעת|קריטית|רבה\s+מאוד)${HE}`,
      ],
    },
  },
  {
    id: 'underscore-highlight',
    category: 'vocabulary',
    nameHe: '"מדגיש" / "ממחיש"',
    nameEn: 'Underscore / highlight / emphasizing',
    descriptionHe:
      'הפעלים underscore, highlight ו-emphasizing (בעברית "מדגיש את", "ממחיש את", "מבליט את", "מדגיש את חשיבותו") נמצאים ברשימות המילים שמודלי שפה משתמשים בהן ביתר בכל הדורות (GPT-4 עד GPT-5), ומשמשים לייחס משמעות לעובדה בלי לבסס אותה.',
    fixHe: 'כתבו מה העובדה מראה בפועל ומי הסיק זאת, או השמיטו את הפועל.',
    weight: 0.3,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\bunderscor(?:e|es|ed|ing)\b`,
        String.raw`\bhighlight(?:s|ed)?\s+(?:the|its|their|his|her|how|that|a|an)\b`,
        String.raw`\bhighlighting\b`,
        String.raw`\bemphasi[sz]ing\b`,
      ],
      he: [
        he('מדגיש|מדגישה|מדגישים|מדגישות|ממחיש|ממחישה|ממחישים|ממחישות|מבליט|מבליטה|מבליטים|מבליטות') +
          String.raw`\s+(?:את|כי|עד\s+כמה)${HE}`,
        he('מדגיש|מדגישה|מדגישים|מדגישות|הדגיש|הדגישה|הדגישו') + String.raw`\s+את\s+(?:חשיבותו|חשיבותה|חשיבותם|משמעותו|משמעותה|מעמדו|מעמדה)${HE}`,
      ],
    },
  },
  {
    id: 'showcase',
    category: 'vocabulary',
    nameHe: '"מציג לראווה"',
    nameEn: 'Showcase',
    descriptionHe:
      'showcase/showcasing ו"מציג לראווה" הם מילות שיווק שמודלים מכניסים גם לטקסט עיוני, במקום "מראה" או "כולל".',
    fixHe: 'השתמשו ב"מראה", "מציג" או "כולל", או תארו את הדבר עצמו.',
    weight: 0.45,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\bshowcas(?:e|es|ed|ing)\b`],
      he: [he('מציג|מציגה|מציגים|מציגות|הציג|הציגה|הציגו|להציג') + String.raw`\s+(?:\p{L}+\s+){0,2}לראווה${HE}`, he('תצוגת\s+תכלית')],
    },
  },
  {
    id: 'intricate-meticulous',
    category: 'vocabulary',
    nameHe: '"מורכבויות" / "קפדני"',
    nameEn: 'Intricate / meticulous / nuanced',
    descriptionHe:
      'intricate, intricacies, meticulous ו-nuanced (בעברית "מורכבויות", "דקויות", "קפדני", "מוקפד") מופיעים בטקסט של מודלים בתדירות גבוהה בהרבה מאשר אצל אנשים.',
    fixHe: 'במקום לומר שמשהו מורכב או קפדני, הראו את הפרט שהופך אותו לכזה.',
    weight: 0.35,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\bintrica(?:te|tely|cies|cy)\b`, String.raw`\bmeticulous(?:ly)?\b`, String.raw`\bnuanced\b`],
      he: [he('מורכבויות|המורכבויות|דקויות|ניואנסים|קפדני|קפדנית|קפדניים|קפדניות|בקפדנות|מוקפד|מוקפדת')],
    },
  },
  {
    id: 'landscape-realm',
    category: 'vocabulary',
    nameHe: '"נוף" / "זירה" (מופשט)',
    nameEn: 'Landscape / realm (abstract)',
    descriptionHe:
      'שימוש ב-landscape או realm במובן מופשט ("הנוף הטכנולוגי", "בזירת החינוך") הוא ז\'רגון אופייני למודלי שפה במקום לנקוב בתחום עצמו.',
    fixHe: 'כתבו "התחום", "המצב" או שם התחום הספציפי.',
    weight: 0.4,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\b(?:the\s+)?(?:\w+\s+)?landscape\s+of\b`,
        String.raw`\b(?:digital|academic|educational|political|cultural|technological|economic|social|media|research|regulatory|competitive|evolving|ever-changing|changing)\s+landscape\b`,
        String.raw`\b(?:in|within)\s+the\s+realm\s+of\b`,
      ],
      he: [
        he('נוף|הנוף|בנוף') +
          String.raw`\s+ה?(?:טכנולוגי|חינוכי|אקדמי|פוליטי|תרבותי|כלכלי|חברתי|תקשורתי|דיגיטלי|מחקרי|רגולטורי|עסקי|משתנה|המשתנה)${HE}`,
        he('נוף|הנוף|בנוף') + String.raw`\s+(?:ה)?(?:מחקר|חינוך|תקשורת|טכנולוגיה|כלכלה|אקדמיה)${HE}`,
        heOpen('בתחומי|בתחום|בממלכת|במרחב') + String.raw`\s+(?:ה)?(?:אפשרויות|הדמיון)${HE}`,
      ],
    },
  },
  {
    id: 'ai-buzz-verbs',
    category: 'vocabulary',
    nameHe: 'פעלי באזז',
    nameEn: 'AI buzz verbs (foster, enhance, leverage...)',
    descriptionHe:
      'פעלים כמו foster, enhance, bolster, garner, leverage, harness, empower, elevate, navigate (בעברית "לרתום", "להעצים", "למנף", "לנווט במורכבויות") חוזרים בטקסט מודלים כתחליף לפעלים פשוטים.',
    fixHe: 'החליפו בפועל פשוט ומדויק: "משפר", "מגדיל", "משתמש ב", "מתמודד עם".',
    weight: 0.3,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\b(?:foster(?:s|ed|ing)?|bolster(?:s|ed|ing)?|garner(?:s|ed|ing)?|leverag(?:e|es|ed|ing)|harness(?:es|ed|ing)?|empower(?:s|ed|ing)?|elevat(?:e|es|ed|ing)|streamlin(?:e|es|ed|ing)|unlock(?:s|ed|ing)?\s+(?:the|new|its|their)|enhanc(?:e|es|ed|ing)|cultivat(?:e|es|ed|ing)|resonat(?:e|es|ed|ing)\s+with|align(?:s|ed)?\s+with)\b`,
        String.raw`\bnavigat(?:e|es|ed|ing)\s+(?:the\s+)?(?:complexities|challenges|intricacies|landscape|nuances|waters)\b`,
      ],
      he: [
        he('לרתום|רותם|רותמת|רותמים|ריתום|רתימת|להעצים|מעצים|מעצימה|מעצימים|העצמת|למנף|ממנף|ממנפת|ממנפים|מינוף'),
        he('לנווט|מנווט|מנווטת|מנווטים|ניווט') + String.raw`\s+(?:\p{L}+\s+)?(?:ב|בין\s+)?(?:מורכבויות|המורכבויות|אתגרים|האתגרים|מים|נבכי)`,
        he('מהדהד|מהדהדת|מהדהדים|מהדהדות') + String.raw`\s+(?:עם|אצל|בקרב)${HE}`,
      ],
    },
  },
  {
    id: 'ai-buzz-adjectives',
    category: 'vocabulary',
    nameHe: 'תארי באזז',
    nameEn: 'AI buzz adjectives (robust, vibrant, multifaceted...)',
    descriptionHe:
      'תארים כמו robust, vibrant, enduring, seamless, multifaceted, holistic, transformative, ever-evolving (בעברית "רב-ממדי", "הוליסטי", "טרנספורמטיבי", "תוסס", "מתפתח ללא הרף") מעידים על כתיבה גנרית של מודל.',
    fixHe: 'מחקו את התואר או החליפו בתיאור מדיד וספציפי.',
    weight: 0.3,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:vibrant|enduring|seamless(?:ly)?|multifaceted|multi-faceted|holistic|transformative|ever-(?:evolving|changing|growing|shifting)|cutting-edge|game-changing|unparalleled|invaluable|robust\s+(?:framework|understanding|foundation|approach|discussion|ecosystem))\b`,
        String.raw`\b(?:the\s+)?interplay\s+(?:of|between)\b`,
        String.raw`\bvaluable\s+(?:insights?|contributions?|perspectives?|resource)\b`,
      ],
      he: [
        he(
          String.raw`רב[\s-]?(?:ממדי|ממדית|ממדיים|ממדיות|גוני|גונית|גוניים|גוניות|פנים|פנים)|הוליסטי|הוליסטית|הוליסטיים|טרנספורמטיבי|טרנספורמטיבית|תוסס|תוססת|תוססים|תוססות|חסר\s+תקדים|חסרת\s+תקדים|פורץ\s+דרך|פורצת\s+דרך|פורצי\s+דרך|מהפכני|מהפכנית`,
        ),
        he('מתפתח|מתפתחת|מתפתחים|מתפתחות|משתנה|משתנים|משתנות') + String.raw`\s+(?:ללא\s+הרף|תדיר|בקצב\s+מסחרר|בהתמדה)${HE}`,
        he(String.raw`תובנות\s+(?:חשובות|יקרות\s+ערך|מעמיקות|ייחודיות)|תרומה\s+יקרת\s+ערך`),
      ],
    },
  },
  {
    id: 'ai-vocabulary-2026',
    category: 'vocabulary',
    nameHe: 'אוצר מילים של מודלים חדשים',
    nameEn: 'Newer-model vocabulary (dependable, quietly, prioritize...)',
    descriptionHe:
      'לפי ויקיפדיה, מודלים מאמצע 2026 (GPT-6) עברו לאוצר מילים אחר: dependable, quietly, universally, prioritize, echoed, לצד משפטים קצרים ושימוש רב בנקודה ובפסיק. כל מילה לבדה נפוצה גם אצל אנשים, ולכן המשקל נמוך מאוד.',
    fixHe: 'בדקו אם המילה מוסיפה מידע; אם לא, החליפו בתיאור ספציפי או מחקו.',
    weight: 0.08,
    source: ['wikipedia'],
    regex: {
      en: [String.raw`\b(?:dependabl[ey]|quietly|universally|prioriti[sz](?:e|es|ed|ing)|echoed)\b`],
    },
  },
  {
    id: 'journey-metaphor',
    category: 'vocabulary',
    nameHe: 'מטאפורת "מסע"',
    nameEn: 'Journey / embark metaphors',
    descriptionHe:
      'מודלים מתארים כל תהליך כ"מסע" ("embark on a journey", "יוצאים למסע", "המסע אל") - מטאפורה רגשית שאינה מתאימה לכתיבה אקדמית.',
    fixHe: 'תארו את התהליך עצמו ואת שלביו במקום להשתמש במטאפורת מסע.',
    weight: 0.4,
    source: ['wikipedia', 'stop-slop'],
    regex: {
      en: [
        String.raw`\bembark(?:s|ed|ing)?\s+(?:on|upon)\b`,
        String.raw`\b(?:a|the|this|our|their|his|her)\s+(?:\w+\s+)?journey\s+(?:of|to|toward|towards|into|through)\b`,
      ],
      he: [
        he('יוצא|יוצאת|יוצאים|יוצאות|נצא|לצאת|יצאנו|יצא|יצאה') + String.raw`\s+(?:\p{L}+\s+)?ל?מסע${HE}`,
        he('המסע|מסע') + String.raw`\s+(?:אל|לעבר|אחר|של\s+גילוי|מרתק|מרגש)${HE}`,
      ],
    },
  },
  {
    id: 'ever-changing-world',
    category: 'filler',
    nameHe: '"בעולם המשתנה של ימינו"',
    nameEn: "In today's ever-changing world",
    descriptionHe:
      'פתיחה גנרית כמו "In today\'s fast-paced world" או "בעולם המשתנה של ימינו" / "בעידן הדיגיטלי" היא אחד הסימנים השחוקים ביותר של טקסט מכונה.',
    fixHe: 'מחקו את הפתיח והתחילו ישר בטענה או בנתון הספציפי.',
    weight: 0.6,
    source: ['wikipedia', 'stop-slop'],
    regex: {
      en: [
        String.raw`\bin\s+today${AP}s\s+(?:\w+[\s-]+){0,3}(?:world|age|era|society|landscape|environment|climate)\b`,
        String.raw`\bin\s+(?:an|the|this)\s+(?:increasingly\s+)?(?:ever-|fast-|rapidly\s+)?(?:changing|evolving|paced|digital|interconnected|globalized)\s+(?:world|age|era|landscape)\b`,
        String.raw`\bin\s+a\s+world\s+where\b`,
      ],
      he: [
        heOpen('בעולם|עולם') + String.raw`\s+(?:ה)?(?:משתנה|דינמי|מהיר|גלובלי|מודרני|דיגיטלי|מתפתח)(?:\s+\p{L}+)?\s+(?:של\s+)?(?:ימינו|כיום|היום)${HE}`,
        he(String.raw`בעידן\s+(?:ה)?(?:דיגיטלי|מודרני|הנוכחי|של\s+ימינו|המידע|הטכנולוגי)`),
        he(String.raw`בימינו\s+אנו|בעולם\s+של\s+ימינו|בעולם\s+שבו`),
        he(String.raw`בעולם\s+(?:ה)?(?:משתנה|דינמי|מתפתח|מהיר)(?:\s+(?:ללא\s+הרף|במהירות|תדיר))?`),
      ],
    },
  },
  {
    id: 'cliche-metaphors',
    category: 'vocabulary',
    nameHe: 'מטאפורות שחוקות',
    nameEn: 'Stock metaphors (sheds light, paves the way...)',
    descriptionHe:
      'מטבעות לשון כמו "שופך אור על", "סולל את הדרך", "פותח צוהר", "חרב פיפיות", "בחזית ה..." מופיעים אצל מודלים בצפיפות חריגה ומחליפים טענה מדויקת.',
    fixHe: 'כתבו במילים פשוטות מה בדיוק המחקר מראה או מאפשר.',
    weight: 0.35,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\bshed(?:s|ding)?\s+(?:new\s+|some\s+|much\s+)?light\s+on\b`,
        String.raw`\bpav(?:e|es|ed|ing)\s+the\s+way\b`,
        String.raw`\bdouble-edged\s+sword\b`,
        String.raw`\b(?:at|to)\s+the\s+forefront\s+of\b`,
        String.raw`\b(?:set|sets|setting)\s+the\s+stage\s+for\b`,
        String.raw`\bstrik(?:e|es|ing)\s+a\s+(?:delicate\s+)?balance\b`,
      ],
      he: [
        he('שופך|שופכת|שופכים|שופכות|לשפוך|שפך|שפכה') + String.raw`\s+(?:\p{L}+\s+)?אור${HE}`,
        he('סולל|סוללת|סוללים|סוללות|לסלול|סלל|סללה') + String.raw`\s+(?:את\s+)?(?:ה)?דרך${HE}`,
        he('פותח|פותחת|פותחים|פותחות|לפתוח') + String.raw`\s+(?:\p{L}+\s+)?צוהר${HE}`,
        he(String.raw`חרב\s+פיפיות|בחזית\s+(?:ה)?(?:מחקר|חדשנות|הידע|העשייה)|מניח(?:ה|ים|ות)?\s+את\s+(?:ה)?יסודות`),
      ],
    },
  },
  {
    id: 'business-jargon',
    category: 'vocabulary',
    nameHe: "ז'רגון עסקי",
    nameEn: 'Business jargon',
    descriptionHe:
      'ביטויים כמו lean into, double down, circle back, game-changer, moving forward ("משנה את כללי המשחק", "שינוי פרדיגמה", "קפיצת מדרגה") הם קלישאות שמודלים שואבים מכתיבה שיווקית.',
    fixHe: 'החליפו בפועל או בשם עצם פשוטים: "משנה מהותית", "מעתה", "נבחן שוב".',
    weight: 0.35,
    source: ['stop-slop'],
    regex: {
      en: [
        String.raw`\b(?:lean(?:s|ing)?\s+into|doubl(?:e|es|ed|ing)\s+down|circl(?:e|es|ed|ing)\s+back|game[\s-]?changer|moving\s+forward|take\s+a\s+step\s+back|on\s+the\s+same\s+page|paradigm\s+shift|low-hanging\s+fruit|synerg(?:y|ies))\b`,
        String.raw`\bunpack(?:s|ed|ing)?\s+(?:the|this|these|what|how)\b`,
      ],
      he: [
        he('משנה|משנים|משנות|שינה|שינתה|לשנות') + String.raw`\s+את\s+כללי\s+המשחק${HE}`,
        he(String.raw`שינוי\s+פרדיגמה|שינוי\s+פרדיגמטי|גיים\s*צ['׳]יינג['׳]ר|קפיצת\s+מדרגה|סינרגיה|סינרגטי|סינרגטית|win[\s-]win`),
      ],
    },
  },
  {
    id: 'intensifier-adverbs',
    category: 'filler',
    nameHe: 'תוארי הפועל מעצימים',
    nameEn: 'Empty intensifier adverbs',
    descriptionHe:
      'מילים כמו really, truly, genuinely, fundamentally, inherently, crucially (בעברית "באמת", "באופן מהותי", "באופן עמוק", "ביסודו של דבר") מוסיפות הדגשה ריקה בלי מידע. חלש כשמופיע לבד.',
    fixHe: 'מחקו את התואר; אם המשפט נחלש - חזקו אותו בעובדה, לא במילה מעצימה.',
    weight: 0.12,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:really|truly|genuinely|deeply|fundamentally|inherently|inevitably|interestingly|importantly|crucially|literally|undeniably|undoubtedly|profoundly|incredibly)\b`,
      ],
      he: [
        he(String.raw`באמת|באופן\s+(?:מהותי|עמוק|יסודי|בלתי\s+נמנע|מעורר\s+השראה|מרתק|מדהים)|ביסודו\s+של\s+דבר|ללא\s+ספק|אין\s+ספק|בלי\s+ספק`),
      ],
    },
  },
  {
    id: 'lazy-extremes',
    category: 'rhetoric',
    nameHe: 'הכללות גורפות',
    nameEn: 'Lazy extremes (always, never, everyone)',
    descriptionHe:
      'הכללות כמו "תמיד", "אף פעם", "כולם", "אף אחד" נותנות סמכות מדומה במקום נתון מדויק. סימן חלש לבדו.',
    fixHe: 'החליפו בכמות או בהיקף מדויקים ("ברוב המקרים שנבדקו", "61% מהמשיבים").',
    weight: 0.08,
    source: ['stop-slop'],
    regex: {
      en: [String.raw`\b(?:always|never|everyone|everybody|nobody|no\s+one|every\s+single)\b`],
      he: [he(String.raw`תמיד|אף\s+פעם|לעולם\s+לא|כולם|אף\s+אחד|אין\s+איש|כל\s+אחד\s+ואחד`)],
    },
  },

  /* ================================================================ */
  /* STRUCTURE                                                         */
  /* ================================================================ */
  {
    id: 'not-only-but-also',
    category: 'structure',
    nameHe: '"לא רק... אלא גם"',
    nameEn: 'Not only X but also Y',
    descriptionHe:
      'המבנה "לא רק X אלא גם Y" מנפח טענה בעזרת ניגוד מלאכותי; מודלי שפה משתמשים בו בתדירות גבוהה במיוחד.',
    fixHe: 'כתבו את שתי הטענות כמשפט חיובי פשוט ("X ו-Y") או השאירו רק את החשובה.',
    weight: 0.45,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\bnot\s+only\b[^.!?;]{1,140}?\bbut\b`,
        String.raw`\bnot\s+(?:just|merely|simply)\b[^.!?;]{1,140}?\bbut\b`,
      ],
      he: [
        he(String.raw`לא\s+(?:רק|זו\s+בלבד)`) + String.raw`[^.!?;]{1,140}?${HB}(?:אלא|אלה)(?:\s+(?:גם|אף|שגם))?${HE}`,
      ],
    },
  },
  {
    id: 'negative-parallelism',
    category: 'structure',
    nameHe: '"זה לא X, זה Y"',
    nameEn: "Negative parallelism (It's not X, it's Y)",
    descriptionHe:
      'התבנית "It\'s not X, it\'s Y" או "אין מדובר ב-X אלא ב-Y" שוללת טענה שאיש לא העלה כדי שהחלק השני ייראה גדול יותר; זהו הסימן החזק ביותר לפי humanizer.',
    fixHe: 'מחקו את החצי השולל וכתבו את Y ישירות.',
    weight: 0.6,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\b(?:it|this|that)(?:${AP}s|\s+is|\s+was)\s+not\s+(?:just\s+|merely\s+|only\s+|simply\s+)?[^.!?;]{1,80}?[,;:—–.]\s*(?:it|this|that)(?:${AP}s|\s+is|\s+was)\b`,
        String.raw`\b(?:it|this|that)\s+(?:isn${AP}t|wasn${AP}t)\s+[^.!?;]{1,80}?[,;:—–.]\s*(?:it|this|that)(?:${AP}s|\s+is|\s+was)\b`,
        String.raw`\b(?:this|it)\s+(?:isn${AP}t|is\s+not|wasn${AP}t|was\s+not)\s+(?:really\s+|mainly\s+|just\s+)?about\b`,
        String.raw`\b(?:doesn${AP}t|does\s+not)\s+mean\b[^.!?]{1,80}[.;]\s*(?:it|this)\s+means\b`,
        String.raw`\b(?:doesn${AP}t|does\s+not|don${AP}t|do\s+not)\s+(?:just|merely|simply|only)\s+[^.!?;]{1,80}?[;:—–]\s*(?:it|they|this)\b`,
        String.raw`\b(?:it|this|that)(?:${AP}s|\s+is)\s+not\s+(?:just\s+)?an?\s+[^.!?;,]{1,40}?\s+but\s+an?\s+`,
      ],
      he: [
        heNoPrefix('זה|זו|זהו|זוהי') + String.raw`\s+(?:לא|אינו|אינה)\s+[^.!?;]{1,80}?[,;:—–.-]\s*(?:זה|זו|זהו|זוהי)${HE}`,
        he(String.raw`(?:אין|לא)\s+מדובר\s+(?:רק|רק\s+ב|בסך\s+הכל|סתם)?`) + String.raw`[^.!?;]{1,80}?${HB}אלא${HE}`,
        heOpen(String.raw`(?:אין|לא)\s+(?:זה|זו|הדבר)\s+(?:אומר|אומרת)\s+ש`) + String.raw`[^.!?]{1,80}[.;]\s*(?:זה|זו|הדבר)\s+(?:אומר|אומרת)`,
      ],
    },
  },
  {
    id: 'false-reframe',
    category: 'structure',
    nameHe: '"השאלה אינה X. היא Y"',
    nameEn: "Reframe: The question isn't X / Not because X, because Y",
    descriptionHe:
      'פתיחות כמו "The real question isn\'t..." או "לא בגלל X - בגלל Y" יוצרות היפוך דרמטי צפוי במקום להציג את הטענה.',
    fixHe: 'הציגו ישירות את השאלה או הסיבה האמיתית, בלי החלק השלילי.',
    weight: 0.5,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`\bthe\s+(?:real\s+|key\s+|true\s+)?(?:question|answer|problem|issue|point|challenge)\s+(?:isn${AP}t|is\s+not|wasn${AP}t|was\s+not)\b`,
        String.raw`\bnot\s+because\b[^.!?]{1,100}?[.,;—–]\s*(?:but\s+)?because\b`,
        String.raw`\bstops?\s+being\b[^.!?]{1,60}\band\s+starts?\s+being\b`,
      ],
      he: [
        heNoPrefix(String.raw`ה(?:שאלה|תשובה|בעיה|נקודה|סוגיה)(?:\s+ה(?:אמיתית|מרכזית))?`) + String.raw`\s+(?:היא\s+)?(?:אינה|איננה|לא)${HE}`,
        heOpen(String.raw`לא\s+בגלל\s+(?:ש)?`) + String.raw`[^.!?]{1,100}?[.,;—–-]\s*(?:אלא\s+)?בגלל${HE}`,
      ],
    },
  },
  {
    id: 'negative-listing',
    category: 'structure',
    nameHe: 'רשימת שלילות',
    nameEn: 'Negative listing (Not X. Not Y. Z. / no X, no Y, just Z)',
    descriptionHe:
      'רצף שלילות שמונה מה הדבר אינו ("לא X. לא Y. אלא Z.", "בלי X, בלי Y, רק Z") הוא "חשפנות רטורית" שמאפיינת טקסט מכונה.',
    fixHe: 'כתבו מה הדבר הוא, במשפט אחד.',
    weight: 0.5,
    source: ['wikipedia', 'stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`(?:^|[.!?]\s+)(?:it\s+(?:wasn${AP}t|isn${AP}t)\s+|not\s+)[^.!?]{1,40}\.\s+(?:it\s+(?:wasn${AP}t|isn${AP}t)\s+|not\s+)[^.!?]{1,40}\.`,
        String.raw`\b(?:no|not\s+an?|not)\s+[^.!?,;—–]{1,30},\s+(?:no|not\s+an?|not)\s+[^.!?,;—–]{1,30}(?:,\s+(?:no|not\s+an?|not)\s+[^.!?,;—–]{1,30})?\s*[,;—–]\s*(?:just|only|simply)\b`,
      ],
      he: [
        String.raw`(?:^|[.!?]\s+)(?:זה\s+)?(?:לא|אין|אינו|אינה)\s+[^.!?]{1,40}\.\s+(?:זה\s+)?(?:לא|אין|אינו|אינה)\s+[^.!?]{1,40}\.`,
        heNoPrefix('לא|בלי|אין') + String.raw`\s+[^.!?,;—–]{1,30},\s*(?:לא|בלי|אין)\s+[^.!?,;—–]{1,30}(?:,\s*(?:לא|בלי|אין)\s+[^.!?,;—–]{1,30})?\s*[,;—–-]\s*(?:רק|פשוט)${HE}`,
      ],
    },
  },
  {
    id: 'rule-of-three',
    category: 'structure',
    nameHe: 'כלל השלוש',
    nameEn: 'Rule of three (forced triads)',
    descriptionHe:
      'מודלים מסדרים רעיונות בשלשות ("חדשנות, השראה ותובנות") כדי להישמע שלמים, גם כשלתוכן אין שלושה חלקים. מזוהה סטטיסטית (צפיפות שלשות), לא בביטוי בודד.',
    fixHe: 'השאירו רק את הפריטים שמוסיפים רעיון נפרד - שניים או אחד מספיקים לרוב.',
    weight: 0.25,
    source: ['wikipedia', 'humanizer', 'stop-slop'],
  },
  {
    id: 'dramatic-fragments',
    category: 'structure',
    nameHe: 'פסקאות-מחץ ומשפטים קטועים',
    nameEn: 'One-line closers & dramatic fragments',
    descriptionHe:
      'משפט סיום קצר שחוזר על הנקודה ("זה העניין. זה כל הסיפור.") או רצף שברי משפט דרמטיים הם הדגשה מבוימת שאינה מוסיפה מידע.',
    fixHe: 'מחקו את משפט המחץ או מזגו את השברים למשפט מלא עם טענה ספציפית.',
    weight: 0.45,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`\bthat${AP}s\s+it\.\s+that${AP}s\s+the\b`,
        String.raw`\b(?:that|this)\s+is\s+the\s+real\s+(?:win|story|lesson|point)\b`,
        String.raw`\bthat\s+distinction\s+matters\b`,
        String.raw`\bevery\.\s+single\.\s+\w+`,
      ],
      he: [
        heNoPrefix(String.raw`זהו|זה\s+הכל`) + String.raw`\.\s+(?:זה|זהו)\s+ה`,
        he(String.raw`(?:וזה|זה|זהו)\s+(?:בדיוק\s+)?(?:הניצחון|השיעור|הסיפור|העניין)\s+(?:האמיתי|כולו)`),
        he(String.raw`וזה\s+משנה\s+(?:את\s+)?הכ(?:ו)?ל|וזה\s+כל\s+ההבדל`),
      ],
    },
  },
  {
    id: 'uniform-rhythm',
    category: 'structure',
    nameHe: 'קצב אחיד',
    nameEn: 'Metronomic sentence rhythm',
    descriptionHe:
      'משפטים רצופים באורך כמעט זהה ובמבנה זהה יוצרים קצב מכני; כתיבה אנושית מחליפה בין משפטים קצרים וארוכים. לפי ויקיפדיה, מודלים מאמצע 2026 כותבים משפטים קצרים של 8–20 מילים כמעט בלבד, עם נקודות ופסיקים בלבד. מזוהה סטטיסטית.',
    fixHe: 'גוונו: חברו שני משפטים קצרים או פצלו משפט ארוך.',
    weight: 0.2,
    source: ['wikipedia', 'stop-slop', 'humanizer'],
  },
  {
    id: 'repeated-openings',
    category: 'structure',
    nameHe: 'פתיחות חוזרות',
    nameEn: 'Repeated sentence openings',
    descriptionHe:
      'כמה משפטים ברצף שנפתחים באותה מילה או נושא ("המחקר... המחקר... המחקר...") מעידים על חזרה מכנית. מזוהה בהשוואה בין משפטים סמוכים.',
    fixHe: 'מזגו משפטים או פתחו בפעולה במקום בנושא.',
    weight: 0.2,
    source: ['humanizer'],
  },
  {
    id: 'false-range',
    category: 'structure',
    nameHe: 'טווח מדומה "מ-X ועד Y"',
    nameEn: 'False range (from X to Y)',
    descriptionHe:
      'מודלים כותבים "from X to Y" / "מ-X ועד Y" בין שני דברים שאינם קצוות של סקאלה אחת, רק כדי להישמע מקיפים.',
    fixHe: 'מנו את הפריטים הרלוונטיים במפורש, או השאירו רק את הדוגמה החשובה.',
    weight: 0.2,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\bfrom\s+(?!\d|time\s+to\s+time|one\s+\w+\s+to\s+another|start\s+to\s+finish|top\s+to\s+bottom)(?:the\s+)?\p{L}[\p{L}'’-]*(?:\s+\p{L}[\p{L}'’-]*){0,3}\s+to\s+(?!\d)(?:the\s+)?\p{L}[\p{L}'’-]*(?:\s+\p{L}[\p{L}'’-]*){0,3},?\s+(?:and\s+)?from\s+`,
        String.raw`\bfrom\s+(?:ancient|traditional|classical|humble)\s+\p{L}+(?:\s+\p{L}+){0,2}\s+to\s+(?:modern|contemporary|cutting-edge|digital)\b`,
      ],
      he: [
        heNoPrefix(String.raw`החל`) + String.raw`\s+מ(?!\d)[^.!?\d]{1,50}?\s+ו?עד\s+(?:ל|ה)?\p{L}`,
        String.raw`${HB}מ(?:ה)?(?!\d)\p{L}[\p{L}"״'׳-]*(?:\s+\p{L}[\p{L}"״'׳-]*){0,3}\s+ועד\s+(?:ל|ה)?\p{L}[^.!?]{0,60}?,\s*ומ`,
      ],
    },
  },
  {
    id: 'elegant-variation',
    category: 'structure',
    nameHe: 'גיוון מלאכותי',
    nameEn: 'Elegant variation',
    descriptionHe:
      'מודלים מחליפים שם עצם בכינויים חלופיים בכל משפט ("החוקר", "המלומד הנודע", "ההוגה הישראלי") כדי להימנע מחזרה, וזה מבלבל את הקורא. מזוהה רק בניתוח הקשרי.',
    fixHe: 'בחרו מונח אחד והשתמשו בו בעקביות.',
    weight: 0.2,
    source: ['wikipedia'],
  },
  {
    id: 'rather-than-contrast',
    category: 'structure',
    nameHe: '"Y ולא X" / "במקום פשוט..."',
    nameEn: 'Reversed parallelism (Y rather than X)',
    descriptionHe:
      'גרסה הפוכה של ההקבלה השלילית ("Rather than simply retelling..., the film...", "a bridge rather than a replacement") נפוצה במיוחד בפלט של מודלים מ-2026. "rather than" עצמו נפוץ מאוד בכתיבה אנושית, ולכן נתפס רק בפתיחת משפט או עם "simply/merely", ובמשקל נמוך.',
    fixHe: 'כתבו מה הדבר עושה, בלי להעמיד מולו חלופה שאיש לא הציע.',
    weight: 0.15,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`(?:^|[.!?]\s+)rather\s+than\b`,
        String.raw`\brather\s+than\s+(?:simply|merely|just|only)\b`,
      ],
      he: [
        heOpen(String.raw`במקום\s+(?:פשוט|רק|סתם|אך\s+ורק)\s+ל`),
      ],
    },
  },
  {
    id: 'title-as-entity-lead',
    category: 'structure',
    nameHe: 'הגדרת הכותרת כישות',
    nameEn: 'Lead treating a list/title as an entity',
    descriptionHe:
      'מודלים פותחים טקסט בהגדרה של כותרת הרשימה או המושג כאילו הייתה ישות בעולם ("The List of X is a curated compilation of...", "X refers to..."), במקום לדבר ישר על הנושא.',
    fixHe: 'פתחו בנושא עצמו ("שירים רבים על מקסיקו..."), לא בהגדרה של הכותרת.',
    weight: 0.3,
    source: ['wikipedia'],
    regex: {
      en: [String.raw`\b(?:is|are)\s+(?:a|an|the)\s+(?:curated|comprehensive|chronological|carefully\s+curated)\s+(?:list|compilation|collection|catalog(?:ue)?|overview)\s+of\b`],
      he: [he(String.raw`(?:הוא|היא|הינו|הינה)\s+(?:אוסף|ליקוט|רשימה)\s+(?:אצור|אצורה|כרונולוגית\s+ומקיפה)`)],
    },
  },

  /* ================================================================ */
  /* RHETORIC                                                          */
  /* ================================================================ */
  {
    id: 'throat-clearing',
    category: 'rhetoric',
    nameHe: 'כחכוח לפני הנקודה',
    nameEn: "Throat-clearing openers (Here's the thing)",
    descriptionHe:
      'פתיחים כמו "Here\'s the thing", "The truth is", "האמת היא ש...", "בואו נהיה כנים" מכריזים על נקודה במקום להציג אותה.',
    fixHe: 'מחקו את הפתיח והתחילו בטענה עצמה.',
    weight: 0.5,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`\bhere${AP}s\s+(?:the\s+thing|what|why|how|the\s+problem|the\s+kicker|the\s+catch|the\s+deal)\b`,
        String.raw`\bthe\s+(?:uncomfortable\s+|simple\s+|hard\s+|honest\s+)?truth\s+is\b`,
        String.raw`\bthe\s+(?:reality|thing)\s+is\b`,
        String.raw`\b(?:let\s+me\s+be\s+clear|let${AP}s\s+be\s+honest|i${AP}m\s+going\s+to\s+be\s+honest|real\s+talk|can\s+we\s+talk\s+about|it\s+turns\s+out)\b`,
        String.raw`(?:^|[.!?]\s+)(?:honestly|look)\s*[?,]`,
      ],
      he: [
        he(String.raw`הנה\s+(?:העניין|הדבר|הבעיה|הסיבה|למה)`),
        heOpen(String.raw`הנה\s+מה\s+ש`),
        heOpen(String.raw`האמת\s+(?:(?:ה)?(?:פשוטה|לא\s+נוחה|קשה)\s+)?היא\s+(?:ש|כי)`),
        heOpen(String.raw`המציאות\s+היא\s+(?:ש|כי)`),
        he(String.raw`בואו\s+נהיה\s+כנים|אהיה\s+כן|אהיה\s+כנה|בכנות\s*\?|אגיד\s+זאת\s+שוב`),
      ],
    },
  },
  {
    id: 'lets-dive-in',
    category: 'rhetoric',
    nameHe: '"בואו נצלול"',
    nameEn: "Staged run-up (Let's dive in / explore)",
    descriptionHe:
      'הזמנות כמו "Let\'s dive in", "Let\'s break it down", "בואו נבחן", "בואו נפרק" הן שאריות של סגנון צ\'אטבוט ואינן שייכות לעבודה אקדמית.',
    fixHe: 'מחקו את ההזמנה והציגו את התוכן מיד.',
    weight: 0.65,
    source: ['humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\blet${AP}s\s+(?:dive|delve|explore|break\s+(?:it|this|that)\s+down|take\s+a\s+(?:closer\s+)?look|unpack|examine|get\s+started)\b`,
        String.raw`\b(?:without\s+further\s+ado|here${AP}s\s+what\s+you\s+need\s+to\s+know|let\s+me\s+walk\s+you\s+through|buckle\s+up)\b`,
      ],
      he: [
        he(String.raw`בואו\s+נ\p{L}+|בוא\s+נ\p{L}+|בואי\s+נ\p{L}+`),
        he(String.raw`הנה\s+כל\s+מה\s+ש(?:צריך|צריכים|חשוב)\s+לדעת|ללא\s+הקדמות\s+מיותרות|בלי\s+הקדמות\s+מיותרות|נצא\s+לדרך`),
      ],
    },
  },
  {
    id: 'emphasis-crutch',
    category: 'rhetoric',
    nameHe: 'קביים של הדגשה',
    nameEn: 'Emphasis crutches (Let that sink in)',
    descriptionHe:
      'ביטויים כמו "Let that sink in", "Full stop.", "Make no mistake", "תנו לזה לחלחל", "אל תטעו" אינם מוסיפים משמעות ומבצעים רגש מלאכותי.',
    fixHe: 'מחקו את הביטוי; אם הטענה חשובה - חזקו אותה בנתון.',
    weight: 0.6,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:let\s+that\s+sink\s+in|make\s+no\s+mistake|read\s+that\s+again|this\s+matters\s+because|here${AP}s\s+why\s+that\s+matters|full\s+stop\.|i\s+promise)\b`,
        String.raw`[.!]\s*period\.\s*$`,
      ],
      he: [
        he(String.raw`תנו\s+לזה\s+(?:לחלחל|לשקוע)|אל\s+תטעו|אל\s+תטעי|קראו\s+שוב|קראו\s+את\s+זה\s+שוב|וזה\s+חשוב\s+כי|הנה\s+למה\s+זה\s+חשוב|אני\s+מבטיח(?:ה)?\s+לכם`),
        String.raw`[.!]\s*נקודה\.\s*$`,
      ],
    },
  },
  {
    id: 'rhetorical-question-setup',
    category: 'rhetoric',
    nameHe: 'שאלה רטורית מבוימת',
    nameEn: 'Rhetorical question setup (The result? What if...?)',
    descriptionHe:
      'שאלה קצרה שנענית מיד ("התוצאה? ...", "והחלק הטוב ביותר?", "What if...?") היא תבנית מבוימת שמודלים משתמשים בה ליצירת דרמה.',
    fixHe: 'כתבו את התשובה כמשפט חיווי רגיל ומחקו את השאלה.',
    weight: 0.5,
    source: ['stop-slop', 'humanizer'],
    regex: {
      en: [
        String.raw`(?:^|[.!?]\s+)(?:and\s+)?(?:the\s+(?:result|outcome|answer|catch|kicker|best\s+part|twist|takeaway|bottom\s+line)|why\s+does\s+(?:this|it|that)\s+matter|what\s+does\s+this\s+mean|so\s+what)\s*\?`,
        String.raw`(?:^|[.!?]\s+)what\s+if\b[^.!?]{1,100}\?`,
        String.raw`\bthink\s+about\s+it[.:!]`,
      ],
      he: [
        String.raw`(?:^|[.!?]\s+)ו?(?:התוצאה|התשובה|השורה\s+התחתונה|החלק\s+הטוב\s+ביותר|המלכוד|הטוויסט|המסקנה)\s*\?`,
        String.raw`(?:^|[.!?]\s+)(?:למה|מדוע)\s+(?:זה|הדבר)\s+(?:חשוב|משנה)\s*\?`,
        String.raw`(?:^|[.!?]\s+)(?:ומה\s+אם|מה\s+אם)${HE}[^.!?]{1,100}\?`,
        he(String.raw`חשבו\s+על\s+זה|תחשבו\s+על\s+זה`),
      ],
    },
  },
  {
    id: 'pseudo-profound',
    category: 'rhetoric',
    nameHe: 'אמירות "עמוקות"',
    nameEn: 'Sayings that sound deep (At its core...)',
    descriptionHe:
      'ביטויים כמו "At its core", "What really matters", "בבסיסו", "בלב העניין", "מה שבאמת חשוב" מלבישים נקודה רגילה בתחפושת של תובנה.',
    fixHe: 'החליפו את האמירה בטענה הספציפית שעומדת מאחוריה.',
    weight: 0.45,
    source: ['humanizer', 'stop-slop'],
    regex: {
      en: [
        String.raw`\bat\s+(?:its|their|the)\s+(?:very\s+)?(?:core|heart)\b`,
        String.raw`\bwhat\s+(?:truly|really)\s+matters\b`,
        String.raw`\bthe\s+(?:heart|crux)\s+of\s+the\s+matter\b`,
        String.raw`\bthe\s+real\s+(?:question|issue|story)\s+is\b`,
        String.raw`\bis\s+the\s+(?:language|currency|architecture|grammar)\s+of\b`,
        String.raw`\bat\s+the\s+end\s+of\s+the\s+day\b`,
      ],
      he: [
        he(String.raw`בבסיסו|בבסיסה|בבסיסם|בליבו|בליבה|בלב\s+העניין|בלב\s+הדברים|בלב\s+הסוגיה|בעיקרו\s+של\s+דבר`),
        heOpen(String.raw`בלב\s+ה`) + String.raw`\p{L}+`,
        he(String.raw`מה\s+ש(?:באמת|בסופו\s+של\s+דבר)\s+(?:חשוב|משנה|קובע)|השאלה\s+האמיתית\s+היא|בסופו\s+של\s+יום`),
        he(String.raw`(?:היא|הוא|הם)\s+(?:ה)?(?:שפה|מטבע|ארכיטקטורה|דקדוק)\s+של`),
      ],
    },
  },
  {
    id: 'arguing-with-no-one',
    category: 'rhetoric',
    nameHe: 'ויכוח עם אף אחד',
    nameEn: "Arguing with no one (I'm not saying...)",
    descriptionHe:
      'הטקסט מתגונן מפני טענה שאיש לא העלה ("I\'m not saying", "To be clear", "אין זאת אומרת ש", "אפשר היה להתפתות") - לרוב שארית של טיוטת מכונה.',
    fixHe: 'מחקו את ההתגוננות; אם יש בה טענה אמיתית - נסחו אותה ישירות.',
    weight: 0.35,
    source: ['humanizer'],
    regex: {
      en: [
        String.raw`\b(?:i${AP}m\s+not\s+saying|to\s+be\s+clear|don${AP}t\s+get\s+me\s+wrong|this\s+is\s+not\s+to\s+say|that${AP}s\s+not\s+to\s+say|one\s+might\s+be\s+tempted\s+to|a\s+tempting\s+approach\s+would\s+be|you\s+might\s+think|it\s+would\s+be\s+easy\s+to)\b`,
      ],
      he: [
        he(
          String.raw`אל\s+תבינו\s+אותי\s+לא\s+נכון|כדי\s+להבהיר|ניתן\s+היה\s+להתפתות|אפשר\s+היה\s+להתפתות|ייתכן\s+שתחשבו`,
        ),
        heOpen(String.raw`(?:אינני|איני|אני\s+לא)\s+(?:טוען|טוענת|אומר|אומרת)\s+ש|(?:אפשר|ניתן)\s+היה\s+לחשוב\s+ש`),
      ],
    },
  },
  {
    id: 'vague-declarative',
    category: 'rhetoric',
    nameHe: 'הצהרה עמומה',
    nameEn: 'Vague declaratives (The implications are significant)',
    descriptionHe:
      'משפטים כמו "The implications are significant", "ההשלכות מרחיקות לכת", "הסיכונים גבוהים" מכריזים על חשיבות בלי לנקוב בדבר הספציפי.',
    fixHe: 'ציינו מהי ההשלכה או הסיבה המסוימת, או מחקו את המשפט.',
    weight: 0.4,
    source: ['stop-slop'],
    regex: {
      en: [
        String.raw`\bthe\s+(?:implications|stakes|consequences|ramifications|reasons|benefits|possibilities)\s+(?:are|is|remain)\s+(?:significant|profound|high|real|structural|enormous|far-reaching|immense|endless|clear)\b`,
        String.raw`\bthis\s+is\s+the\s+deepest\s+problem\b`,
      ],
      he: [
        he(String.raw`ה(?:השלכות|סיכונים|השפעות|השלכותיו|השלכותיה|היתרונות|האפשרויות)`) +
          String.raw`\s+(?:הן\s+|הם\s+)?(?:משמעותיות|משמעותיים|מרחיקות\s+לכת|מרחיקי\s+לכת|עצומות|עצומים|ברורות|ברורים|רבות|רבים|אינסופיות|גבוהים|גבוהות)${HE}`,
        he(String.raw`(?:יש|ישנן)\s+לכך\s+השלכות\s+מרחיקות\s+לכת`),
      ],
    },
  },
  {
    id: 'false-agency',
    category: 'rhetoric',
    nameHe: 'סוכנות מדומה',
    nameEn: 'False agency (the data tells us)',
    descriptionHe:
      'ייחוס פעולה אנושית לדבר דומם ("the decision emerges", "הנתונים מספרים לנו", "השיח נע לעבר") מסתיר מי באמת פעל.',
    fixHe: 'ציינו את האדם או הגוף שפעל ("החוקרים מצאו", "הוועדה החליטה").',
    weight: 0.25,
    source: ['stop-slop'],
    regex: {
      en: [
        String.raw`\bthe\s+data\s+(?:tells|told)\s+us\b`,
        String.raw`\b(?:the\s+)?(?:decision|answer|consensus|solution)\s+emerg(?:es|ed)\b`,
        String.raw`\bthe\s+market\s+rewards\b`,
      ],
      he: [
        he(String.raw`הנתונים\s+(?:מספרים|מספרות|מלמדים|לוחשים)\s+לנו|ההחלטה\s+(?:מתגבשת|צומחת|עולה)|השיח\s+נע\s+(?:לעבר|אל)|הנתונים\s+מדברים\s+בעד\s+עצמם`),
      ],
    },
  },

  /* ================================================================ */
  /* TONE                                                              */
  /* ================================================================ */
  {
    id: 'promotional-puffery',
    category: 'tone',
    nameHe: 'שפה שיווקית',
    nameEn: 'Promotional / puffery language',
    descriptionHe:
      'מילים כמו nestled, breathtaking, renowned, groundbreaking, exemplifies, rich heritage ("שוכן בלב", "עוצר נשימה", "מרהיב", "בעל שם עולמי") הופכות טקסט עיוני למודעת פרסומת. לפי ויקיפדיה זה אופייני בעיקר למודלים של 2023–2025; מודלים חדשים פחות "מתפרסמים".',
    fixHe: 'תארו מה הדבר הוא בפועל, בלשון ניטרלית ועם נתונים.',
    weight: 0.5,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:nestled|breathtaking|stunning|must-visit|world-class|renowned|awe-inspiring|picturesque|unparalleled|second\s+to\s+none|state-of-the-art|groundbreaking|exemplif(?:y|ies|ied|ying))\b`,
        String.raw`\b(?:worth\s+visiting|offers?\s+visitors|a\s+fascinating\s+glimpse)\b`,
        String.raw`\brich\s+(?:cultural\s+)?(?:heritage|history|tradition|tapestry)\b`,
        String.raw`\b(?:natural\s+beauty|in\s+the\s+heart\s+of|diverse\s+array\s+of|boasts?\s+(?:a|an|over|more\s+than))\b`,
      ],
      he: [
        he(String.raw`שוכן|שוכנת|שוכנים|ממוקם|ממוקמת`) + String.raw`\s+בלב${HE}`,
        he(String.raw`עוצר\s+נשימה|עוצרת\s+נשימה|עוצרי\s+נשימה|מרהיב|מרהיבה|מרהיבים|מרהיבות|מהמם|מהממת|בעל\s+שם\s+עולמי|בעלת\s+שם\s+עולמי|מן\s+השורה\s+הראשונה|מהשורה\s+הראשונה|יוצא\s+מן\s+הכלל|יוצאת\s+מן\s+הכלל`),
        he(String.raw`מורשת\s+(?:תרבותית\s+)?עשירה|היסטוריה\s+עשירה|מגוון\s+עשיר\s+של|יופי\s+טבעי|מתהדר|מתהדרת|מתהדרים`),
      ],
    },
  },
  {
    id: 'inflated-significance',
    category: 'tone',
    nameHe: 'ניפוח חשיבות',
    nameEn: 'Inflated significance / legacy',
    descriptionHe:
      'מודלים מצרפים לעובדה רגילה טענה שהיא "מסמנת נקודת מפנה", "משקפת מגמה רחבה", "עוררה דיון ציבורי" או "מותירה חותם בל יימחה" - חשיבות או הקשר רחב שלא הוכחו, לעיתים אפילו אחרי הודאה שהנושא שולי.',
    fixHe: 'השאירו את העובדה עצמה וסיימו בפרט הקונקרטי האחרון.',
    weight: 0.5,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\bmark(?:s|ed|ing)?\s+(?:a|an|the)\s+(?:pivotal|significant|major|key|crucial|turning|watershed|defining|new)\s+(?:moment|point|milestone|chapter|era|shift|turning\s+point)\b`,
        String.raw`\b(?:watershed\s+moment|turning\s+point|focal\s+point|indelible\s+mark|lasting\s+(?:impact|legacy|impression)|enduring\s+legacy|deeply\s+rooted|continues?\s+to\s+(?:captivate|inspire|resonate|shape))\b`,
        String.raw`\b(?:pivotal|crucial|vital|defining|key)\s+moment\b`,
        String.raw`\brepresent(?:s|ed|ing)?\s+a\s+(?:\w+\s+)?shift\b`,
        String.raw`\b(?:reflect(?:s|ed|ing)?|part\s+of|contribut(?:es|ed|ing)\s+to)\s+(?:a|the)\s+broader\s+(?:\w+\s+)?(?:trend|movement|shift|history|context|pattern|narrative|debate|discussion|effort)s?\b`,
        String.raw`\b(?:highlight(?:s|ed|ing)?|underscor(?:es|ed|ing)|emphasi[sz](?:es|ed|ing))\s+(?:its|their|his|her|the)\s+(?:\w+\s+)?(?:importance|significance|relevance)\b`,
        String.raw`\bsymboli[sz](?:e|es|ed|ing)\s+(?:its|their|the)\s+(?:ongoing|enduring|lasting|continued)\b`,
        String.raw`\b(?:generated|sparked|prompted|fueled|fuelled)\s+(?:broader\s+|ongoing\s+|public\s+|considerable\s+)?(?:debate|reflection|discussions?)\b`,
        String.raw`,\s+raising\s+(?:\w+\s+)?questions\s+about\b`,
        String.raw`\b(?:enduring|ongoing|continued|lasting)\s+relevance\b`,
        String.raw`\b(?:the\s+)?distinction\s+(?:matters|is\s+important)\s+because\b`,
        String.raw`\bshap(?:e|es|ed|ing)\s+the\s+(?:future|course|trajectory)\s+of\b`,
      ],
      he: [
        he(String.raw`נקודת\s+(?:מפנה|ציון\s+דרך)|אבן\s+דרך\s+(?:חשובה|משמעותית|מרכזית)|רגע\s+(?:מכונן|היסטורי|מכריע)|חותם\s+בל\s+יימחה|חותם\s+עמוק|מורשת\s+(?:מתמשכת|נצחית|עמוקה)`),
        he(String.raw`מעצב|מעצבת|מעצבים|מעצבות|עיצב|עיצבה`) + String.raw`\s+את\s+(?:עתיד|פני|דמותו\s+של|דמותה\s+של)`,
        he(String.raw`משקף|משקפת|משקפים|משקפות`) + String.raw`\s+(?:מגמה|תופעה|שינוי)\s+(?:רחבה|רחב|כללית|כללי|עמוקה|עמוק)`,
        he(String.raw`(?:ממשיך|ממשיכה|ממשיכים|ממשיכות)\s+(?:לרתק|לעורר\s+השראה|להדהד|לעצב)`),
        he(String.raw`(?:חלק|כחלק)\s+מ(?:מגמה|תנועה|מהלך|שיח)\s+(?:רחב|רחבה|כללי|כללית)(?:\s+יותר)?|נקודת\s+מוקד|רגע\s+מכונן`),
        he(String.raw`עורר|עוררה|עוררו|מעורר|מעוררת|מעוררים|הצית|הציתה`) +
          String.raw`\s+(?:\p{L}+\s+)?(?:דיון|דיונים|שיח|רפלקציה|הרהורים)\s+(?:ציבורי|ציבוריים|רחב|רחבים|נרחב|נוקב|מעמיק)?\s*(?:על|בשאלת|בנוגע\s+ל)`,
        he(String.raw`רלוונטיות(?:ו|ה|ם)?\s+(?:המתמשכת|הנמשכת|העכשווית)|חשיבות(?:ו|ה|ם)?\s+המתמשכת`),
      ],
    },
  },
  {
    id: 'plays-key-role',
    category: 'tone',
    nameHe: '"ממלא תפקיד מרכזי"',
    nameEn: 'Plays a vital / key role',
    descriptionHe:
      'הביטוי "plays a crucial/pivotal/key role" ומקבילו "ממלא תפקיד מרכזי/מכריע/חיוני" הוא מהשכיחים בטקסט מכונה, ולרוב אינו מסביר מהו התפקיד.',
    fixHe: 'כתבו מה הגורם עושה בפועל ובאיזו מידה ("מסביר 40% מהשונות").',
    weight: 0.45,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\bplay(?:s|ed|ing)?\s+(?:a|an)\s+(?:\w+\s+)?(?:pivotal|crucial|vital|key|central|significant|critical|instrumental|major|integral|important|essential)\s+(?:role|part)\b`,
        String.raw`\b(?:is|are|was|were)\s+(?:an\s+)?integral\s+(?:part|component)\s+of\b`,
      ],
      he: [
        he(String.raw`ממלא|ממלאת|ממלאים|ממלאות|מילא|מילאה|מילאו|למלא|משחק|משחקת|משחקים|משחקות`) +
          String.raw`\s+(?:\p{L}+\s+)?תפקיד\s+(?:\p{L}+\s+)?(?:מרכזי|מכריע|חיוני|קריטי|משמעותי|חשוב|מפתח|בלתי\s+נפרד|מהותי)${HE}`,
        he(String.raw`תפקיד\s+מפתח`),
        heOpen(String.raw`חלק\s+בלתי\s+נפרד\s+מ`),
      ],
    },
  },
  {
    id: 'challenges-future-outlook',
    category: 'tone',
    nameHe: '"למרות האתגרים... העתיד מבטיח"',
    nameEn: 'Challenges & future-outlook formula',
    descriptionHe:
      'נוסחה קשיחה: "Despite its [מעלות], X faces several challenges..." ואחריה "Despite these challenges, X continues to thrive" או "העתיד נראה מבטיח", לעיתים תחת כותרת "אתגרים ותחזית לעתיד". הסימן הוא הנוסחה, לא עצם האזכור של אתגרים.',
    fixHe: 'מחקו את פסקת ה"אתגרים והעתיד" או החליפו בתוכניות ובנתונים קונקרטיים מהמקורות.',
    weight: 0.55,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\bdespite\s+(?:these|its|their|the|such|some|numerous|several)\s+(?:\w+\s+)?(?:challenges|setbacks|obstacles|hurdles|limitations)\b`,
        String.raw`\bdespite\s+(?:its|their|his|her)\s+[^.!?,]{1,60},\s+[^.!?,]{1,60}?\bfac(?:e|es|ed)\s+(?:\w+\s+)?challenges\b`,
        String.raw`\bfac(?:e|es|ed|ing)\s+(?:several|numerous|many|various|new|a\s+number\s+of)\s+(?:\w+\s+)?challenges\b`,
        String.raw`\bcontinues?\s+to\s+(?:thrive|flourish|evolve|grow)\b`,
        String.raw`\b(?:future\s+(?:outlook|prospects)|challenges\s+and\s+(?:legacy|future\s+prospects|opportunities))\b`,
        String.raw`\b(?:the\s+future\s+(?:looks|is|remains)\s+(?:bright|promising)|exciting\s+times\s+(?:lie\s+)?ahead|a\s+step\s+in\s+the\s+right\s+direction|remains?\s+to\s+be\s+seen)\b`,
      ],
      he: [
        he(String.raw`למרות|על\s+אף|חרף`) + String.raw`\s+(?:כל\s+)?(?:ה)?(?:אתגרים|קשיים|מכשולים|מגבלות)(?:\s+(?:הללו|האלה|אלו|אלה|הרבים))?${HE}`,
        he(String.raw`ניצב|ניצבת|ניצבים|ניצבות|עומד|עומדת|עומדים|עומדות`) + String.raw`\s+(?:כיום\s+)?בפני\s+(?:(?:מספר|כמה|שורה\s+של)\s+אתגרים|אתגרים\s+(?:רבים|משמעותיים|לא\s+מעטים))${HE}`,
        he(String.raw`אתגרים\s+ו(?:הזדמנויות|מורשת|תחזית|כיווני\s+עתיד)|תחזית\s+לעתיד|סיכויים\s+לעתיד`),
        he(String.raw`ממשיך|ממשיכה|ממשיכים|ממשיכות`) + String.raw`\s+(?:לשגשג|לפרוח|להתפתח\s+ולצמוח)${HE}`,
        he(String.raw`העתיד\s+(?:נראה|נראית)?\s*(?:מבטיח|ורוד|זוהר)|צעד\s+בכיוון\s+הנכון|ימים\s+(?:יגידו|יוכיחו)|זמנים\s+מרגשים`),
      ],
    },
  },
  {
    id: 'vague-attribution',
    category: 'citation',
    nameHe: 'ייחוס עמום',
    nameEn: 'Vague attributions (experts say)',
    descriptionHe:
      'ייחוס לסמכות לא מזוהה ("experts believe", "studies show", "מחקרים מראים", "מומחים סבורים") בלי הפניה ספציפית הוא סימן מובהק לטקסט מכונה, ובעבודה אקדמית גם פגם מתודולוגי.',
    fixHe: 'הוסיפו הפניה מדויקת (מחבר, שנה) או מחקו את הטענה.',
    weight: 0.45,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:experts?|scholars|researchers|analysts|observers|critics|historians|scientists)\s+(?:have\s+)?(?:say|said|believe|believed|argue|argued|agree|agreed|suggest|suggested|note|noted|cited|claim|claimed|contend)\b(?![^.!?]*\(\s*\p{L}[^)]*\d{4})`,
        String.raw`\b(?:studies|research|evidence|reports|surveys)\s+(?:has\s+|have\s+)?(?:shows?|shown|suggests?|indicates?|demonstrates?)\b(?![^.!?]*\(\s*\p{L}[^)]*\d{4})`,
        String.raw`\b(?:industry\s+reports|some\s+critics|many\s+(?:experts|scholars|observers)|it\s+is\s+(?:widely|generally|commonly)\s+(?:believed|accepted|acknowledged|recognized|recognised|agreed)|according\s+to\s+(?:experts|some|many))\b`,
        String.raw`\b(?:observers\s+have\s+cited|described\s+in\s+(?:scholarship|the\s+literature)|modern\s+(?:researchers|scholars)\s+(?:treat|view|regard|see)|researchers\s+and\s+(?:conservationists|practitioners|policymakers)|(?:several|multiple|numerous|various)\s+(?:sources|publications|outlets)\s+(?:have\s+)?(?:noted|described|reported|highlighted|cited))\b`,
        String.raw`\b(?:\w+\s+)?(?:industry|trade)\s+publications\s+such\s+as\b`,
      ],
      he: [
        he(String.raw`מומחים|חוקרים\s+רבים|רבים|מבקרים|פרשנים|משקיפים|אנשי\s+מקצוע`) +
          String.raw`\s+(?:\p{L}+\s+)?(?:טוענים|סבורים|מסכימים|מציינים|מאמינים|גורסים|מעריכים)${HE}(?![^.!?]*\(\s*\p{L}[^)]*\d{4})`,
        he(String.raw`מחקרים|מחקרים\s+רבים|מחקרים\s+עדכניים|דוחות|סקרים`) +
          String.raw`\s+(?:\p{L}+\s+)?(?:מראים|הראו|מראה|מצביעים|מצביעה|הצביעו|מלמדים|מעידים)${HE}(?![^.!?]*\(\s*\p{L}[^)]*\d{4})`,
        he(String.raw`יש\s+הטוענים|יש\s+הסבורים|מקובל\s+לחשוב|מקובל\s+לטעון|לדעת\s+מומחים|על\s+פי\s+מומחים|לפי\s+מומחים|רבים\s+סבורים`),
        he(String.raw`(?:מקורות|פרסומים|כלי\s+תקשורת)\s+(?:רבים|שונים|מגוונים)\s+(?:ציינו|תיארו|דיווחו|הדגישו|מציינים|מתארים)|חוקרים\s+בני\s+זמננו\s+(?:רואים|מתייחסים)`),
      ],
    },
  },
  {
    id: 'media-coverage-emphasis',
    category: 'citation',
    nameHe: 'הדגשת סיקור ובולטות',
    nameEn: 'Canned emphasis on coverage / notability',
    descriptionHe:
      'במקום לסכם מה המקורות אומרים, מודלים מדגישים את עצם הסיקור ואת סוג המקורות ("featured in national media outlets", "independent coverage", "trade publications", "סוקר בהרחבה בכלי תקשורת ארציים") או "נוכחות פעילה ברשתות החברתיות". נפוץ במיוחד בכלים מ-2025 ואילך.',
    fixHe: 'כתבו מה המקור אומר בפועל, עם הפניה, במקום לציין שהנושא סוקר.',
    weight: 0.4,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\bindependent\s+(?:\w+\s+)?coverage\b`,
        String.raw`\b(?:significant|substantial|sustained|widespread|extensive|repeated|national|regional|international)\s+(?:media|press|news)\s+coverage\b`,
        String.raw`\b(?:local|regional|national|international|mainstream|prominent|major|other)\s+(?:\w+\s+)?media\s+(?:outlets|coverage|platforms)\b`,
        String.raw`\b(?:music|business|tech|technology|industry|specialist)\s+outlets\b`,
        String.raw`\b(?:featured|profiled|spotlighted)\s+in\b`,
        String.raw`\b(?:maintains?|has)\s+an?\s+(?:active|strong|robust|growing|vibrant)\s+(?:social\s+media|digital|online)\s+presence\b`,
        String.raw`\bwritten\s+by\s+a\s+leading\s+expert\b`,
      ],
      he: [
        he(String.raw`(?:זכה|זכתה|זכו)\s+(?:ל)?סיקור\s+(?:תקשורתי\s+)?(?:נרחב|רחב|עצמאי|משמעותי|ארצי|בינלאומי)|סיקור\s+(?:תקשורתי\s+)?(?:עצמאי|נרחב\s+ועקבי)`),
        he(String.raw`כלי\s+(?:ה)?תקשורת\s+(?:ה)?(?:מקומיים|אזוריים|ארציים|בינלאומיים|מובילים|מרכזיים|בולטים)`),
        he(String.raw`(?:ה)?(?:פרסומים|כתבי\s+עת)\s+(?:ה)?מקצועיים\s+(?:בתחום\s+)?כגון`),
        he(String.raw`נוכחות\s+(?:פעילה|חזקה|בולטת|דיגיטלית\s+(?:חזקה|פעילה|בולטת))\s+ב(?:רשתות\s+(?:ה)?חברתיות|מדיה\s+(?:ה)?חברתית)|נוכחות\s+דיגיטלית\s+(?:חזקה|פעילה|בולטת)`),
      ],
    },
  },
  {
    id: 'identified-by-sources',
    category: 'citation',
    nameHe: '"המקור מזהה אותו כ..."',
    nameEn: 'Undue emphasis on identification by sources',
    descriptionHe:
      'מודלים (בעיקר מ-2026) מדגישים איך מקור ראשוני או מאגר "מזהה" את הנושא ("His website identifies him as...", "records list her as...") במקום לכתוב את העובדה עצמה. הניסוח נוקשה ונוסחתי.',
    fixHe: 'כתבו את העובדה ישירות ("X הוא קצין בדימוס") עם הפניה למקור.',
    weight: 0.35,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\b(?:website|profile|biography|database|databases|records|listings?|filings?|materials|registry|directory)\s+(?:\w+\s+)?(?:identif(?:y|ies)|lists?|describes?)\s+(?:him|her|them|it|the\s+\w+)\s+as\b`,
        String.raw`\b(?:was|were|is|are)\s+identified\s+by\s+[^.!?]{1,60}?\s+as\b`,
        String.raw`\b(?:his|her|their)\s+professional\s+profile\s+lists\b`,
      ],
      he: [
        heOpen(String.raw`(?:אתר|פרופיל|רשומות|מאגר|רישומי|מרשם)(?:\s+\p{L}+){0,2}\s+(?:מזהה|מזהים|מציג|מציגים|מתאר|מתארים)\s+(?:אותו|אותה|אותם|אותן)\s+כ`) + String.raw`\p{L}`,
      ],
    },
  },
  {
    id: 'awards-recognition-heading',
    category: 'structure',
    nameHe: 'כותרת "פרסים והוקרה"',
    nameEn: '"Awards and recognition" / "X and Y" section headings',
    descriptionHe:
      'כותרות בתבנית "X ו-Y", ובמיוחד "Awards and recognition", "Legacy and impact" או "Challenges and future directions", כמעט קבועות בטקסטים שנוצרו בבינה מלאכותית ומשקפות את ההתמקדות במורשת ובהכרה.',
    fixHe: 'תנו לפרק כותרת שמתארת את תוכנו הספציפי, או שלבו את המידע בפרק אחר.',
    weight: 0.35,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`(?:^|\n)[ \t]*(?:#{1,6}[ \t]*|=+[ \t]*)?(?:awards\s+and\s+(?:recognition|honou?rs|achievements)|recognition\s+and\s+awards|legacy\s+and\s+(?:impact|influence)|impact\s+and\s+legacy|challenges\s+and\s+(?:legacy|future\s+(?:directions|prospects|outlook)))[ \t]*=*[ \t]*:?[ \t]*(?:\n|$)`,
      ],
      he: [
        String.raw`(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:פרסים\s+ו(?:הוקרה|הכרה|אותות|הישגים)|מורשת\s+ו(?:השפעה|השפעות)|השפעה\s+ומורשת|אתגרים\s+ו(?:מורשת|כיווני\s+עתיד|תחזית\s+לעתיד))[ \t]*:?[ \t]*(?:\n|$)`,
      ],
    },
  },
  {
    id: 'source-usage-disclaimer',
    category: 'citation',
    nameHe: 'הסתייגות על אופן השימוש במקור',
    nameEn: 'Corrective framing (should be treated as X rather than Y)',
    descriptionHe:
      'מאז אמצע 2026 מודלים מוסיפים הנחיות על איך "יש להתייחס" לטענה ("should be treated as tradition rather than as evidence"), קובעים ש"המידע אינו מבסס כשלעצמו" מסקנה, או מבהירים ש"אין לבלבל" עם נושא אחר. לפני יולי 2026 זה כמעט לא הופיע.',
    fixHe: 'כתבו מה המקור אומר ומי אומר זאת; אם יש ספק - ייחסו את הטענה, בלי הוראות לקורא.',
    weight: 0.45,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\bshould\s+be\s+(?:treated|presented|understood|read|regarded|viewed|seen|interpreted)\s+as\b[^.!?]{1,100}?\brather\s+than\b`,
        String.raw`\b(?:does|do|did)\s+not\s+(?:by\s+itself\s+|on\s+its\s+own\s+|in\s+itself\s+|by\s+themselves\s+)?establish\s+(?:that|whether|a|an|any)\b`,
        String.raw`\bshould\s+not\s+be\s+confused\s+with\b`,
      ],
      he: [
        heOpen(String.raw`(?:יש|ראוי|מומלץ)\s+(?:להתייחס|לראות|להציג|לקרוא|להבין)\s+`) + String.raw`[^.!?]{1,100}?\s+ולא\s+(?:כ|בתור\s)`,
        he(String.raw`(?:אין\s+בכך|אין\s+בו|אין\s+בה|אין\s+בהם)\s+(?:כשלעצמו\s+|כשלעצמה\s+)?כדי\s+(?:לבסס|להוכיח)|(?:אינו|אינה|אינם|אינן)\s+(?:מבסס|מבססת|מבססים|מבססות)\s+(?:כשלעצמו|כשלעצמה|כשלעצמם|כשלעצמן|בפני\s+עצמו|בפני\s+עצמה)`),
      ],
    },
  },
  {
    id: 'sycophancy',
    category: 'tone',
    nameHe: 'חנופה',
    nameEn: 'Sycophantic tone (Great question!)',
    descriptionHe:
      'מחמאות לשואל ("Great question!", "You\'re absolutely right", "שאלה מצוינת!") הן שאריות של שיחה עם צ\'אטבוט שהודבקו לטקסט.',
    fixHe: 'מחקו את המחמאה והשאירו רק את התוכן.',
    weight: 0.9,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:great|excellent|fantastic|good|fascinating|insightful|thoughtful)\s+(?:question|point|observation)\b`,
        String.raw`\byou${AP}re\s+(?:absolutely|completely|totally|so)\s+right\b`,
        String.raw`\bwhat\s+a\s+(?:great|fascinating|wonderful|thoughtful)\s+(?:question|topic|idea)\b`,
      ],
      he: [
        he(String.raw`שאלה\s+(?:מצוינת|מעולה|נהדרת|מרתקת|חשובה\s+מאוד)|נקודה\s+(?:מצוינת|מעולה|נהדרת)|אתה\s+(?:צודק|צודקת)\s+(?:לחלוטין|בהחלט|לגמרי)|את\s+צודקת\s+(?:לחלוטין|בהחלט|לגמרי)|צודק\s+לחלוטין|צודקת\s+לחלוטין`),
      ],
    },
  },
  {
    id: 'chatbot-residue',
    category: 'tone',
    nameHe: "שאריות צ'אטבוט",
    nameEn: 'Chatbot residue (I hope this helps)',
    descriptionHe:
      'פתיחות, סיומות והוראות של שיחה ("Certainly!", "I hope this helps", "Would you like...", "Here are several paraphrases", "verify before submitting", "מקווה שזה עוזר", "אשמח לעזור", "בדקו לפני ההגשה") הן הסימן הוודאי ביותר שהטקסט הועתק מצ\'אטבוט.',
    fixHe: 'מחקו את העטיפה השיחתית והשאירו את התוכן בלבד.',
    weight: 0.95,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:i\s+hope\s+(?:this|that|it)\s+helps|hope\s+this\s+helps|let\s+me\s+know\s+if|feel\s+free\s+to|happy\s+to\s+help|would\s+you\s+like\s+(?:me\s+to|a|an|more)|want\s+me\s+to|should\s+i\s+continue|i${AP}d\s+be\s+happy\s+to|i\s+can\s+also\s+help)\b`,
        String.raw`(?:^|[.!?]\s+)(?:certainly|of\s+course|absolutely|sure|great)!`,
        String.raw`(?:^|[.!?:]\s+)here(?:\s+is|\s+are|${AP}s)\s+(?:a|an|the|some|several)\s+(?:[\w,-]+\s+){0,3}(?:overview|summary|breakdown|list|draft|version|rewrite|revised|paragraph|essay|outline|template|paraphrases?)\b`,
        String.raw`\b(?:is\s+there\s+anything\s+else|(?:a\s+)?more\s+detailed\s+breakdown|a\s+wikipedia-style\s+(?:article|paraphrase|summary)|i\s+(?:hope|trust)\s+this\s+(?:message|email|note)\s+finds\s+you\s+well|apologi[sz]e\s+for\s+any\s+inconvenience|if\s+there\s+are\s+(?:any\s+)?specific\s+(?:issues|concerns|areas)|final\s+important\s+tip|delete\s+this\s+section\s+before)\b`,
        String.raw`\b(?:check|verify|confirm|double-check)\b[^.!?]{0,60}\bbefore\s+(?:publishing|publication|submitting|submission)\b`,
      ],
      he: [
        he(String.raw`(?:אני\s+)?מקווה\s+ש(?:זה|הדבר|התשובה|המידע)\s+(?:עוזר|עזר|יעזור|מועיל|הועיל|עונה)|אשמח\s+לעזור|אשמח\s+להרחיב|אם\s+(?:תרצה|תרצי|תרצו)|(?:תרגיש|תרגישי|הרגישו|הרגש)\s+חופשי|האם\s+להמשיך`),
        he(String.raw`האם\s+יש\s+(?:עוד\s+(?:משהו|דבר)|משהו\s+נוסף)|פירוט\s+(?:מפורט|מעמיק)\s+יותר|(?:אני\s+)?(?:מתנצל|מתנצלת|מתנצלים)\s+על\s+(?:כל\s+)?אי[\s-]?ה?נוחות|מחקו\s+(?:את\s+)?(?:הסעיף|החלק|ההערה)\s+(?:הזה|הזו|הזאת)\s+לפני`),
        he(String.raw`בדקו|ודאו|וודאו|אמתו|בדוק|ודא|וודא|אמת`) + String.raw`[^.!?]{0,60}?${HB}לפני\s+(?:ה)?(?:פרסום|הגשה|הגשת|שליחה|שליחת)${HE}`,
        heOpen(String.raw`אל\s+תהסס(?:י|ו)?\s+ל|האם\s+(?:תרצה|תרצי|תרצו)\s+ש|(?:רוצה|תרצה|תרצי)\s+ש(?:א|נ)`),
        String.raw`(?:^|[.!?]\s+)(?:בהחלט|כמובן|בשמחה|בוודאי|בטח)!`,
        String.raw`(?:^|[.!?]\s+)הנה\s+(?:\p{L}+\s+)?(?:סיכום|סקירה|רשימה|טיוטה|גרסה|פסקה|מאמר|תקציר|פירוט|ניסוח)${HE}`,
      ],
    },
  },
  {
    id: 'knowledge-cutoff',
    category: 'citation',
    nameHe: 'הסתייגות "גבולות הידע"',
    nameEn: 'Knowledge-cutoff disclaimers',
    descriptionHe:
      'משפטים כמו "As of my last training update" או "נכון לעדכון הידע שלי", "על סמך המידע הזמין" חושפים שמודל כתב את הטקסט ולעיתים ממלא חוסר במידע בניחוש.',
    fixHe: 'מחקו את ההסתייגות; ציינו מה המקורות מראים בפועל או השמיטו את הטענה.',
    weight: 0.9,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:as\s+of\s+my\s+(?:last\s+)?(?:knowledge|training)|up\s+to\s+my\s+(?:last\s+)?(?:training|knowledge)|my\s+knowledge\s+cutoff|as\s+of\s+my\s+last\s+update|i\s+(?:do\s+not|don${AP}t)\s+have\s+(?:access\s+to\s+)?real-time)\b`,
        String.raw`\b(?:while\s+specific\s+(?:details|information)\s+(?:about\s+[^.!?,]{1,60}\s+)?(?:are|is|remain|remains)\s+(?:limited|scarce)|based\s+on\s+(?:the\s+)?available\s+information|(?:is|are|was|were)\s+not\s+(?:widely|extensively|publicly|readily|fully)\s+(?:documented|available|disclosed|transcribed)|in\s+the\s+(?:provided|available)\s+(?:sources|search\s+results|documents)|maintains\s+a\s+low\s+profile|keeps?\s+(?:his|her|their)\s+personal\s+(?:details|life|information)\s+private)\b`,
        String.raw`\b(?:isn${AP}t|aren${AP}t|wasn${AP}t|weren${AP}t)\s+(?:widely|extensively|fully|publicly|readily)\s+(?:documented|available|disclosed|transcribed)\b`,
        String.raw`\b(?:my\s+analysis\s+is\s+based\s+on|i${AP}ve\s+inferred|not\s+fully\s+documented\s+in\s+public\s+sources)\b`,
      ],
      he: [
        heOpen(String.raw`אין\s+לי\s+גישה\s+ל`),
        he(String.raw`נכון\s+ל(?:עדכון|מועד\s+עדכון|תאריך\s+עדכון)\s+(?:ה)?(?:ידע|המידע|האימון)|עד\s+למועד\s+עדכון\s+הידע|אין\s+ברשותי\s+מידע\s+עדכני`),
        he(String.raw`על\s+סמך\s+(?:ה)?מידע\s+(?:ה)?(?:זמין|הקיים\s+בידי)|(?:אינו|אינה|אינם|אינן|לא)\s+(?:מתועד|מתועדת|מתועדים|מתועדות|זמין|זמינה|זמינים)\s+(?:בהרחבה|לציבור|במקורות\s+הזמינים)|במקורות\s+(?:הזמינים|שסופקו)|אין\s+מידע\s+זמין`),
        he(String.raw`(?:שומר|שומרת|שומרים)\s+על\s+פרופיל\s+נמוך|(?:שומר|שומרת|שומרים)\s+את\s+(?:פרטיו|פרטיה|פרטיהם)\s+האישיים\s+(?:ב)?(?:פרטיות|לעצמו|לעצמה)|בתוצאות\s+החיפוש\s+(?:שסופקו|הזמינות)|(?:הניתוח|הסקירה)\s+שלי\s+מבוסס(?:ת)?\s+על`),
      ],
    },
  },
  {
    id: 'ai-self-reference',
    category: 'tone',
    nameHe: 'הזדהות כמודל / סירוב',
    nameEn: 'AI self-reference / refusal',
    descriptionHe:
      'ביטויים כמו "As an AI language model" או "כמודל שפה אינני יכול" הם הוכחה ישירה להעתקה מצ\'אטבוט.',
    fixHe: 'מחקו את המשפט כולו וכתבו את התוכן בעצמכם.',
    weight: 1,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\bas\s+(?:an?\s+)?(?:ai|artificial\s+intelligence|large\s+language|language)\s+(?:language\s+)?model\b`,
        String.raw`\bas\s+an\s+ai\b`,
        String.raw`\bi${AP}m\s+(?:unable|not\s+able)\s+to\s+(?:browse|access|provide\s+real-time)\b`,
        String.raw`\bi${AP}m\s+sorry,?\s+but\s+i\s+(?:can${AP}t|cannot|am\s+unable\s+to)\b`,
        String.raw`\bi\s+(?:cannot|can${AP}t)\s+(?:offer|provide|give)\s+(?:medical|legal|financial)\s+advice\b`,
        String.raw`\bi\s+(?:cannot|can${AP}t)\s+directly\s+(?:add|edit|access|browse)\b`,
      ],
      he: [
        he(String.raw`כמודל\s+(?:שפה|בינה\s+מלאכותית)|כבינה\s+מלאכותית|בתור\s+מודל\s+שפה|אני\s+מודל\s+שפה|כעוזר\s+וירטואלי`),
        he(String.raw`(?:אני\s+)?(?:מצטער|מצטערת)\s*,?\s+(?:אך|אבל)\s+(?:אינני|איני|אני\s+לא)\s+יכול(?:ה)?|(?:אינני|איני|אני\s+לא)\s+(?:יכול|יכולה)\s+(?:לתת|להעניק|לספק)\s+ייעוץ\s+(?:רפואי|משפטי|פיננסי)`),
      ],
    },
  },

  /* ================================================================ */
  /* FILLER                                                            */
  /* ================================================================ */
  {
    id: 'important-to-note',
    category: 'filler',
    nameHe: '"חשוב לציין"',
    nameEn: "It's important to note",
    descriptionHe:
      'ביטויי עריכה כמו "It\'s important to note", "It is worth noting", "חשוב לציין", "ראוי להדגיש" מכריזים על חשיבות במקום להראות אותה, ומודלים משתמשים בהם בצפיפות חריגה.',
    fixHe: 'מחקו את הביטוי והתחילו ישר במידע עצמו.',
    weight: 0.4,
    source: ['wikipedia', 'stop-slop'],
    regex: {
      en: [
        String.raw`\bit${AP}?s?\s*(?:is\s+)?(?:important|worth|crucial|essential|vital|interesting)\s+(?:to\s+(?:note|remember|mention|highlight|emphasize|emphasise|consider|recognize|understand)|noting|mentioning)\b`,
        String.raw`\bit\s+(?:should|must)\s+be\s+(?:noted|emphasized|emphasised|highlighted)\b`,
        String.raw`(?:^|[.!?]\s+)(?:notably|importantly|interestingly|crucially),`,
        String.raw`\bno\s+discussion\s+(?:of\s+[^.]{1,40}\s+)?would\s+be\s+complete\s+without\b`,
      ],
      he: [
        he(String.raw`(?:חשוב|ראוי|כדאי|יש|מעניין|חיוני|הכרחי)\s+(?:לציין|להדגיש|לזכור|לשים\s+לב|להזכיר|לומר|להבין)`),
        he(String.raw`(?:יש|ראוי|חשוב)\s+לתת\s+את\s+הדעת`),
      ],
    },
  },
  {
    id: 'in-conclusion',
    category: 'filler',
    nameHe: '"לסיכום" / "בסופו של דבר"',
    nameEn: 'Section summaries (In conclusion, Overall)',
    descriptionHe:
      'משפט שפותח ב-"In conclusion", "In summary", "Overall" או "לסיכום", "בשורה התחתונה" וחוזר על מה שנאמר זה עתה הוא דפוס סיום קבוע של מודלים.',
    fixHe: 'סיימו בטענה או בממצא החדש האחרון, בלי לחזור על הפסקה.',
    weight: 0.3,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`(?:^|[.!?]\s+)(?:in\s+(?:conclusion|summary|essence|sum)|to\s+(?:sum\s+up|summarize|summarise|conclude)|overall|ultimately|all\s+in\s+all),`,
      ],
      he: [
        heNoPrefix(String.raw`לסיכום|לסיכומו\s+של\s+דבר|בסיכומו\s+של\s+דבר|כללו\s+של\s+דבר|בשורה\s+התחתונה|בסופו\s+של\s+דבר|לבסוף|בסיכום\s+כולל|לסיכום\s+הדברים|על\s+כן\s+ניתן\s+לסכם`) +
          String.raw`\s*[,:]?`,
      ],
    },
  },
  {
    id: 'transition-overuse',
    category: 'filler',
    nameHe: 'מילות קישור מוגזמות',
    nameEn: 'Overused transitions (Moreover, Furthermore)',
    descriptionHe:
      'פתיחת משפטים רבים ב-"Moreover", "Furthermore", "Additionally" או "יתרה מכך", "יתר על כן", "זאת ועוד" יוצרת קצב של חיבור מכני; צפיפות גבוהה היא סימן אופייני.',
    fixHe: 'מחקו את רוב מילות הקישור; אם הקשר ברור מההקשר, אין בהן צורך.',
    weight: 0.25,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\b(?:moreover|furthermore|additionally|in\s+addition|consequently|nevertheless|nonetheless|subsequently|conversely|thereby|hence)\b`],
      he: [he(String.raw`יתרה\s+מכך|יתרה\s+מזו|יתר\s+על\s+כן|יתרה\s+על\s+כן|זאת\s+ועוד|בנוסף\s+לכך|מעבר\s+לכך|כמו\s+כן|לאור\s+זאת|אי\s+לכך|אשר\s+על\s+כן`)],
    },
  },
  {
    id: 'meta-signposting',
    category: 'filler',
    nameHe: 'שילוט מטא-טקסטואלי',
    nameEn: 'Meta-commentary / signposting',
    descriptionHe:
      'משפטים שמתארים את הטקסט עצמו ("In this section, we will explore", "As we\'ll see", "בפרק זה נצלול", "הטבלה שלהלן משווה") במקום את הנושא. בעבודה אקדמית מבנה מסוים לגיטימי, ולכן המשקל נמוך.',
    fixHe: 'השאירו הכרזת מבנה אחת בפתח הפרק, ובשאר המקומות פשוט הציגו את התוכן.',
    weight: 0.2,
    source: ['stop-slop', 'humanizer', 'wikipedia'],
    regex: {
      en: [
        String.raw`\b(?:in\s+this\s+(?:section|article|essay|chapter|paper|report),?\s+(?:we|i)\s+(?:will|shall|(?:${AP}ll))\s+(?:explore|delve|dive|examine|unpack|discuss|take\s+a\s+look)|as\s+we${AP}ll\s+see|the\s+rest\s+of\s+this\s+(?:essay|article|post)|i\s+want\s+to\s+explore|but\s+that${AP}s\s+(?:another|a\s+topic\s+for\s+another)\s+(?:post|story|day))\b`,
        String.raw`(?:^|[.!?]\s+)(?:hint|plot\s+twist|spoiler):`,
      ],
      he: [
        he(String.raw`(?:בפרק|בסעיף|במאמר|בחלק)\s+(?:זה|הזה)\s+(?:נצלול|נצא\s+למסע|נעמיק\s+ונחקור|נגלה|נפרק)`),
        he(String.raw`כפי\s+שנראה\s+(?:בהמשך|מיד)|אבל\s+זה\s+כבר\s+(?:נושא|סיפור)\s+(?:ל|אחר)|ספוילר:|רמז:`),
      ],
    },
  },
  {
    id: 'filler-phrases',
    category: 'filler',
    nameHe: 'ביטויי מילוי',
    nameEn: 'Filler phrases (When it comes to...)',
    descriptionHe:
      'ביטויים כמו "When it comes to", "At the end of the day", "In terms of", "כשזה מגיע ל", "בסופו של יום", "בכל הנוגע ל" מאריכים את המשפט בלי להוסיף תוכן.',
    fixHe: 'מחקו את הביטוי ופתחו ישירות בנושא.',
    weight: 0.25,
    source: ['stop-slop'],
    regex: {
      en: [String.raw`\b(?:when\s+it\s+comes\s+to|at\s+the\s+end\s+of\s+the\s+day|in\s+terms\s+of|it\s+goes\s+without\s+saying|needless\s+to\s+say|first\s+and\s+foremost|last\s+but\s+not\s+least)\b`],
      he: [heOpen(String.raw`(?:כשזה|כאשר\s+זה)\s+מגיע\s+ל`),
        he(String.raw`בסופו\s+של\s+יום|למותר\s+לציין|מיותר\s+לציין|אין\s+צורך\s+לומר|ראשית\s+וחשוב\s+מכל|אחרון\s+חביב`)],
    },
  },
  {
    id: 'hedging-stack',
    category: 'filler',
    nameHe: 'ערימת הסתייגויות',
    nameEn: 'Stacked hedges (could potentially)',
    descriptionHe:
      'צירוף כמה הסתייגויות יחד ("could potentially", "it may arguably", "ייתכן שאולי", "עשוי באופן פוטנציאלי") הופך כל טענה לחסרת עמדה; הסתייגות בודדת היא תקינה.',
    fixHe: 'השאירו הסתייגות אחת שהמקור תומך בה ונסחו את הטענה בבהירות.',
    weight: 0.3,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:could|may|might|can|would)\s+(?:potentially|possibly|arguably|perhaps|conceivably|theoretically)\b`,
        String.raw`\b(?:potentially|possibly|arguably|perhaps)\s+(?:could|may|might)\b`,
        String.raw`\bit\s+(?:could|may|might)\s+(?:possibly\s+|perhaps\s+)?be\s+(?:argued|suggested|said)\b`,
        String.raw`\bin\s+some\s+cases\s+it\s+(?:may|might)\b`,
      ],
      he: [
        he(String.raw`ייתכן|יתכן|ייתכן\s+מאוד|אפשר|יכול\s+להיות`) +
          String.raw`\s+(?:ש|כי\s+)[^.!?]{0,40}?${HB}(?:אולי|עשוי|עשויה|עשויים|עשויות|עלול|עלולה|עלולים|עלולות|ייתכן|יתכן|פוטנציאלית|ככל\s+הנראה)${HE}`,
        he(String.raw`עשוי|עשויה|עשויים|עשויות|עלול|עלולה|עלולים|עלולות|יכול|יכולה|יכולים|יכולות`) +
          String.raw`\s+(?:אולי|פוטנציאלית|באופן\s+פוטנציאלי|ככל\s+הנראה|אולי\s+אף)${HE}`,
        heOpen(String.raw`(?:ניתן|אפשר)\s+(?:אולי\s+)?(?:היה\s+)?לטעון\s+(?:אולי\s+)?(?:ש|כי)`),
      ],
    },
  },
  {
    id: 'copula-avoidance',
    category: 'filler',
    nameHe: 'הימנעות מ"הוא/יש" ("מהווה")',
    nameEn: 'Copula avoidance (serves as, boasts)',
    descriptionHe:
      'מודלים מחליפים את "is/has" בביטויים מנופחים כמו "serves as", "stands as", "boasts", "holds the distinction of", ובעברית "מהווה", "משמש כ", "מתפקד כ", "עומד כ", "מחזיק בתואר". מחקר מצא ירידה של יותר מ-10% בשימוש ב-is/are בכתיבה אקדמית מ-2023. "מהווה" נפוץ גם אצל כותבים אנושיים, ולכן המשקל בינוני.',
    fixHe: 'החליפו ב"הוא/היא/הם" או ב"יש", למשל "X הוא מרכז המחקר" במקום "X מהווה את מרכז המחקר".',
    weight: 0.25,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:serv(?:es|ed|ing)|stand(?:s|ing)|stood|function(?:s|ed|ing)?|act(?:s|ed|ing)?|operat(?:es|ed|ing))\s+as\s+(?:a|an|the)\b`,
        String.raw`\bboast(?:s|ed|ing)?\s+(?:a|an|the|over|more|some|numerous|several)\b`,
        String.raw`\bserves?\s+as\s+a\s+(?:reminder|testament|catalyst|cornerstone|bridge)\b`,
        String.raw`\bholds?\s+the\s+distinction\s+of\b`,
        String.raw`\bventured\s+into\s+\w+(?:\s+\w+)?\s+as\s+an?\b`,
      ],
      he: [
        he(String.raw`מהווה|מהווים|מהוות|מהווֹת|היווה|היוותה|היוו|להוות`),
        he(String.raw`משמש|משמשת|משמשים|משמשות|שימש|שימשה|שימשו|מתפקד|מתפקדת|מתפקדים|מתפקדות|עומד|עומדת|עומדים|עומדות`) +
          String.raw`\s+כ(?:מרכז|גשר|זרז|אבן|תזכורת|עדות|מקור|בסיס|מודל|דוגמה|נדבך|עוגן)`,
        he(String.raw`מחזיק|מחזיקה|מחזיקים|מחזיקות|החזיק|החזיקה`) + String.raw`\s+בתואר\s+(?:ה)?(?:ראשון|ראשונה|הוותיק|הוותיקה|היחיד|היחידה)`,
      ],
    },
  },
  {
    id: 'superficial-ing-analysis',
    category: 'filler',
    nameHe: 'פרשנות שטחית מצורפת',
    nameEn: 'Superficial -ing analyses (highlighting...)',
    descriptionHe:
      'תוספת בסוף משפט כמו ", highlighting the importance of..." או ", ובכך ממחיש את..." / ", דבר המעיד על..." מדביקה פרשנות לעובדה פשוטה בלי ביסוס.',
    fixHe: 'השאירו את העובדה; הוסיפו פרשנות רק אם מקור תומך בה, כמשפט נפרד עם הפניה.',
    weight: 0.5,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`[,;—–]\s*(?:thereby\s+|thus\s+|further\s+)?(?:highlighting|underscoring|emphasizing|emphasising|reflecting|symbolizing|symbolising|showcasing|illustrating|demonstrating|signaling|signalling|contributing\s+to|fostering|ensuring|cultivating|encompassing|enhancing|embodying|solidifying|reinforcing|cementing|confirming|providing|offering|enabling|paving\s+the\s+way|marking|underlining)\b`,
      ],
      he: [
        String.raw`[,;]\s*(?:ובכך\s+|ובזאת\s+|וכך\s+|דבר\s+[הש]?|מה\s+ש)(?:מדגיש|מדגישה|מדגישים|ממחיש|ממחישה|ממחישים|משקף|משקפת|משקפים|מעיד|מעידה|מעידים|תורם|תורמת|תורמים|מבטיח|מבטיחה|מחזק|מחזקת|מחזקים|מסמל|מסמלת|מבליט|מבליטה|מטפח|מטפחת|סולל|סוללת|מבסס|מבססת|מקבע|מקבעת)${HE}`,
      ],
    },
  },
  {
    id: 'vague-association',
    category: 'filler',
    nameHe: 'קשר עמום',
    nameEn: 'Vague connection (associated with)',
    descriptionHe:
      'במקום לומר מה היחס בין שני דברים ("ניהל את", "לימד ב"), מודלים כותבים שהם "associated with", "connected to", "in connection with" ("בזיקה ל", "נקשר בשמו של"), לעיתים שוב ושוב. לפי ויקיפדיה זה מהסימנים הנפוצים ביותר ב-2026. "associated with" נפוץ מאוד גם בכתיבה מדעית, ולכן רק צירופים אופייניים נתפסים.',
    fixHe: 'ציינו את היחס המדויק (ייסד, ניהל, גרם, נבע מ) אם המקור מאפשר.',
    weight: 0.15,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`\b(?:in\s+(?:association|connection)\s+(?:with|to)|(?:is|was|are|were)\s+associated\s+with\s+the\s+(?:leadership|work|efforts)\s+of)\b`,
        String.raw`\b(?:principally|particularly|widely|closely|primarily|chiefly)\s+(?:associated|connected)\s+with\b`,
        String.raw`\b(?:became|becomes|become)\s+(?:associated|connected)\s+with\b`,
        String.raw`\b(?:was|were|has\s+been|have\s+been)\s+connected\s+(?:with|to)\s+(?:the\s+)?(?:\w+\s+)?(?:education|leadership|work|activities|initiatives|recognition|efforts)\b`,
      ],
      he: [heOpen(String.raw`בזיקה\s+ל`),
        he(String.raw`נקשר(?:ה|ו)?\s+בשמו\s+של|נקשר(?:ה|ו)?\s+בשמה\s+של`),
        he(String.raw`(?:מזוהה|מזוהים|מזוהות|נעשה\s+מזוהה|נעשתה\s+מזוהה)\s+(?:בעיקר|במיוחד|בעיקרו)\s+עם`)],
    },
  },

  {
    id: 'revision-assurance',
    category: 'filler',
    nameHe: 'הערות עריכה "שיפרתי בהירות וזרימה"',
    nameEn: 'Canned revision notes (improved clarity and flow, while preserving...)',
    descriptionHe:
      'מודלים שמתבקשים לערוך מוסיפים סיכום עריכה נוסחתי: "שופרו הבהירות והזרימה", "טון ניטרלי/אקדמי יותר", "תוך שמירה על המשמעות המקורית", "addressed reviewer feedback". ויקיפדיה מתעדת זאת בתקצירי עריכה; בעבודה מוגשת זו שארית של פלט.',
    fixHe: 'מחקו את הערת העריכה; אם צריך לתעד שינויים, ציינו מה שונה בפועל ולמה.',
    weight: 0.55,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\bwhile\s+(?:preserving|retaining|maintaining|keeping)\s+(?:the\s+)?(?:original|core|existing|overall|key)\s+(?:meaning|structure|intent|content|details|tone|voice|message|emphasis)\b`,
        String.raw`\b(?:improved?|improving|enhanced?|enhancing|refined?|refining)\s+(?:the\s+)?(?:overall\s+)?(?:clarity|flow|readability|coherence|concision)(?:,?\s+(?:and\s+)?(?:flow|readability|clarity|coherence|tone|concision))+\b`,
        String.raw`\b(?:for\s+(?:a\s+)?more|to\s+(?:be\s+)?more)\s+(?:neutral|encyclopedic|academic|formal|balanced)\s+(?:and\s+\w+\s+)?tone\b`,
        String.raw`\b(?:reduced|removed)\s+redundancy\b`,
        String.raw`\bensur(?:e|ed|ing)\s+(?:full\s+)?(?:compliance|adherence)\s+with\s+(?:the\s+)?(?:\w+\s+)?(?:guidelines|style\s+guide|manual\s+of\s+style)\b`,
      ],
      he: [
        he(String.raw`תוך\s+שמירה\s+על\s+(?:ה)?(?:משמעות|כוונה|מבנה|תוכן|סגנון)\s+(?:ה)?(?:מקורי|מקורית|קיים|קיימת)`),
        he(String.raw`(?:שיפור|שופרו|שיפרתי|לשיפור)\s+(?:ה)?(?:בהירות|קריאות|זרימה|רהיטות)(?:\s*,?\s*ו?(?:ה)?(?:בהירות|קריאות|זרימה|רהיטות|טון))+`),
        he(String.raw`(?:טון|נימה|סגנון)\s+(?:ניטרלי|ניטרלית|אקדמי|אקדמית|מאוזן|מאוזנת|רשמי|רשמית)\s+יותר`),
        he(String.raw`צמצום\s+(?:ה)?חזרות|הוסרו\s+(?:ה)?חזרות`),
      ],
    },
  },
  {
    id: 'stiff-synonyms',
    category: 'filler',
    nameHe: 'מילים נוקשות במקום פשוטות',
    nameEn: 'Stiff synonyms (utilized, authored, relocated)',
    descriptionHe:
      'ויקיפדיה מציינת שכותבים אנושיים משתמשים יותר במילים הפשוטות (used, wrote, moved, died), ומודלים מעדיפים מילים נוקשות או מכובסות (utilized, authored, relocated, passed away; בעברית "עשה שימוש ב", "הלך לעולמו"). סימן חלש מאוד לבדו.',
    fixHe: 'החליפו במילה הפשוטה: "השתמש", "כתב", "עבר", "מת/נפטר".',
    weight: 0.08,
    source: ['wikipedia'],
    regex: {
      en: [String.raw`\b(?:utili[sz](?:e|es|ed|ing|ation)|authored|relocated|passed\s+away)\b`],
      he: [
        heOpen(String.raw`(?:עושה|עושים|עושות|עשה|עשתה|עשו)\s+שימוש\s+ב`) + String.raw`\p{L}`,
        he(String.raw`הלך\s+לעולמו|הלכה\s+לעולמה|הלכו\s+לעולמם`),
      ],
    },
  },

  /* ================================================================ */
  /* FORMATTING                                                        */
  /* ================================================================ */
  {
    id: 'em-dash-overuse',
    category: 'formatting',
    nameHe: 'שימוש יתר במקף ארוך',
    nameEn: 'Em-dash overuse',
    descriptionHe:
      'מקף ארוך (—), לרוב מוקף ברווחים, כמחבר אוניברסלי במקום פסיק, סוגריים או נקודתיים הוא מהסימנים הוויזואליים הבולטים של מודלי שפה; מקף בודד חלש, צפיפות גבוהה חזקה. מאז סוף 2026 מודלים חדשים נמנעים ממנו כליל, כך שהיעדרו אינו מוכיח דבר.',
    fixHe: 'החליפו בנקודה, פסיק, נקודתיים או סוגריים בהתאם ליחס בין החלקים.',
    weight: 0.2,
    source: ['wikipedia', 'stop-slop', 'humanizer'],
    regex: {
      en: [String.raw`—|\s–\s|\s--\s`],
      he: [String.raw`—|\s–\s|\s--\s`],
    },
  },
  {
    id: 'curly-quotes',
    category: 'formatting',
    nameHe: 'מירכאות מעוגלות',
    nameEn: 'Curly quotation marks',
    descriptionHe:
      'מירכאות ואפוסטרופים מעוגלים (“ ” ’) במקום ישרים או גרשיים עבריים (״) מופיעים בטקסט שהועתק מצ\'אטבוט; Word מעגל מירכאות אוטומטית, לכן הסימן חלש מאוד לבדו.',
    fixHe: 'השתמשו בסוג מירכאות אחיד בכל העבודה (בעברית: " או ״).',
    weight: 0.05,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`[“”]`, String.raw`(?<=\p{L})’(?=\p{L})`],
      he: [String.raw`[“”„]`],
    },
  },
  {
    id: 'title-case-heading',
    category: 'formatting',
    nameHe: 'כותרות באותיות רישיות',
    nameEn: 'Title Case headings',
    descriptionHe:
      'כותרות באנגלית שבהן כל מילה מתחילה באות גדולה ("Strategic Negotiations And Global Partnerships") הן ברירת מחדל של מודלים. לא רלוונטי לעברית; מזוהה בקוד תלוי-רישיות ולא ב-regex (הדגל i פעיל).',
    fixHe: 'כתבו כותרות באנגלית ב-sentence case: רק המילה הראשונה ושמות פרטיים באות גדולה.',
    weight: 0.25,
    source: ['wikipedia', 'humanizer'],
  },
  {
    id: 'excessive-bold',
    category: 'formatting',
    nameHe: 'הדגשה מוגזמת',
    nameEn: 'Excessive boldface',
    descriptionHe:
      'הדגשת מונחים רבים בתוך הטקסט (**כך**) ללא סיבה היא הרגל עיצובי של מודלים שעובד בפורמט Markdown.',
    fixHe: 'הסירו את ההדגשה; הדגישו לכל היותר מונח מוגדר אחד בהופעתו הראשונה.',
    weight: 0.3,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`\*\*[^*\n]{1,80}\*\*`, String.raw`<(?:b|strong)>`],
      he: [String.raw`\*\*[^*\n]{1,80}\*\*`, String.raw`<(?:b|strong)>`],
    },
  },
  {
    id: 'inline-header-list',
    category: 'formatting',
    nameHe: 'רשימה עם כותרות מודגשות',
    nameEn: 'Bold-label vertical lists',
    descriptionHe:
      'רשימה שבה כל פריט נפתח בתווית מודגשת ונקודתיים ("- **ביצועים:** הביצועים שופרו") היא תבנית קבועה של מודלים, ולרוב התווית רק חוזרת על התוכן.',
    fixHe: 'הפכו את הרשימה לפסקה רציפה או הסירו את התוויות.',
    weight: 0.5,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`(?:^|\n)\s*(?:[-*•▪◦]|\d+[.)])\s*\*\*[^*\n]{1,60}\*\*\s*:?`, String.raw`(?:^|\n)\s*(?:[-*•▪◦]|\d+[.)])\s*\*\*[^*\n]{1,60}:\*\*`],
      he: [String.raw`(?:^|\n)\s*(?:[-*•▪◦]|\d+[.)])\s*\*\*[^*\n]{1,60}\*\*\s*:?`, String.raw`(?:^|\n)\s*(?:[-*•▪◦]|\d+[.)])\s*\*\*[^*\n]{1,60}:\*\*`],
    },
  },
  {
    id: 'emoji-decoration',
    category: 'formatting',
    nameHe: "אימוג'י וחצים",
    nameEn: 'Emoji bullets & decorative arrows',
    descriptionHe:
      'אימוג\'י בראש כותרות או פריטי רשימה (🚀, 💡, ✅) וחצים (→) כקישוט אינם מקובלים בכתיבה אקדמית ומאפיינים פלט של צ\'אטבוט.',
    fixHe: 'הסירו את האימוג\'י והחצים וכתבו את הקשר במילים.',
    weight: 0.6,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [String.raw`(?![©®™‼⁉])\p{Extended_Pictographic}`, String.raw`[→⇒➜➡]`],
      he: [String.raw`(?![©®™‼⁉])\p{Extended_Pictographic}`, String.raw`[→⇒➜➡←⇐⬅]`],
    },
  },
  {
    id: 'markdown-artifacts',
    category: 'formatting',
    nameHe: 'שאריות Markdown',
    nameEn: 'Markdown artifacts in prose',
    descriptionHe:
      'סימני Markdown שנותרו בטקסט (## כותרת, ```, קווי הפרדה ---, קישורים בתבנית [טקסט](כתובת)) מעידים שהטקסט הודבק ישירות מממשק צ\'אט. לפי ויקיפדיה זה מהסימנים הנפוצים ביותר כיום.',
    fixHe: 'הסירו את הסימנים והשתמשו בעיצוב של מעבד התמלילים.',
    weight: 0.55,
    source: ['wikipedia', 'humanizer'],
    regex: {
      en: [
        String.raw`(?:^|\n)\s*#{1,6}\s+\S`,
        String.raw`(?:^|\n)\s*(?:---+|\*\*\*+|___+)\s*(?:\n|$)`,
        '`{3}',
        String.raw`\[[^\]\n]{1,80}\]\((?:https?://|www\.)[^)\s]+\)`,
      ],
      he: [
        String.raw`(?:^|\n)\s*#{1,6}\s+\S`,
        String.raw`(?:^|\n)\s*(?:---+|\*\*\*+|___+)\s*(?:\n|$)`,
        '`{3}',
        String.raw`\[[^\]\n]{1,80}\]\((?:https?://|www\.)[^)\s]+\)`,
      ],
    },
  },
  {
    id: 'placeholder-text',
    category: 'formatting',
    nameHe: 'טקסט ממלא-מקום',
    nameEn: 'Unfilled placeholders',
    descriptionHe:
      'תבניות שלא מולאו ("[Your Name]", "[Article Title 1]", "[Year]", "(Add your URL here)", "INSERT_SOURCE_URL_30", "2025-XX-XX", "example.com/source1", "[שם המחבר]", "[הוסף מקור]") הן הוכחה כמעט ודאית להעתקה מפלט של מודל.',
    fixHe: 'מלאו את הפרט החסר מתוך המקורות שלכם או מחקו את המשפט.',
    weight: 1,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`\[(?:your|insert|add|describe|list|author|name|date|year|source|citation|reference|company|placeholder|link|url|brief|specific|article\s+title|founder|title)\b[^\]\n]{0,80}\]`,
        String.raw`\[[^\]\n]{0,40}\b(?:name|names|title|date|year|url|address|here)\s*\d*\]`,
        String.raw`\((?:add|insert|paste)\s+[^)\n]{1,40}\s+here\)`,
        String.raw`\b(?:INSERT|PASTE|PLACEHOLDER)_[A-Z0-9_]+\b|\bSOURCE_PUBLISHER\b`,
        String.raw`\b(?:19|20)\d{2}-(?:\d{2}|XX)-XX\b|\{\{CURRENTYEAR\}\}-XX-XX`,
        String.raw`\{\{\s*(?:placeholder|name|date|source)[^}]*\}\}`,
        String.raw`\bexample\.com/(?:source|article|news|page|link)\d*\b`,
      ],
      he: [
        String.raw`\[(?:שם|הכנס|הכניסו|הוסף|הוסיפו|תאר|תארו|תאריך|מקור|ציטוט|הפניה|קישור|שם\s+המחבר|שנה|מספר\s+עמוד|כותרת)[^\]\n]{0,80}\]`,
        String.raw`\((?:הוסף|הוסיפו|הכנס|הכניסו|הדבק|הדביקו)\s+[^)\n]{1,40}\s+כאן\)`,
        String.raw`\b(?:19|20)\d{2}-(?:\d{2}|XX)-XX\b`,
      ],
    },
  },

  /* ================================================================ */
  /* CITATION                                                          */
  /* ================================================================ */
  {
    id: 'chatgpt-citation-artifacts',
    category: 'citation',
    nameHe: 'שאריות ציטוט של ChatGPT',
    nameEn: 'ChatGPT citation artifacts (oaicite, utm_source)',
    descriptionHe:
      'מחרוזות כמו "contentReference[oaicite:0]", "turn0search0", "citeturn", קישורים עם "utm_source=chatgpt.com" / "utm_source=copilot.com" / "referrer=grok.com", או סימן החזרה ↩ ליד הערות שוליים, נשארים כשמעתיקים תשובה של צ\'אטבוט - הוכחה כמעט ודאית לשימוש בכלי (גם אם לא בהכרח לכתיבת הטקסט עצמו).',
    fixHe: 'מחקו את המחרוזת ובדקו ידנית את המקור המקורי; צטטו אותו בפורמט האקדמי הנדרש.',
    weight: 1,
    source: ['wikipedia'],
    regex: {
      en: [
        String.raw`oaicite|contentReference\s*\[|turn\d+(?:search|news|view|file)\d+|citeturn|utm_source=(?:chatgpt\.com|openai|copilot\.com|perplexity)|referrer=grok\.com`,
        String.raw`【\d+(?:[:†][^】]{0,40})?】`,
        String.raw`↩`,
      ],
      he: [
        String.raw`oaicite|contentReference\s*\[|turn\d+(?:search|news|view|file)\d+|citeturn|utm_source=(?:chatgpt\.com|openai|copilot\.com|perplexity)|referrer=grok\.com`,
        String.raw`【\d+(?:[:†][^】]{0,40})?】`,
        String.raw`↩`,
      ],
    },
  },
  {
    id: 'fabricated-references',
    category: 'citation',
    nameHe: 'הפניות מפוברקות',
    nameEn: 'Hallucinated / unverifiable references',
    descriptionHe:
      'מודלים ממציאים מאמרים, קישורים שבורים (שגם בארכיון האינטרנט אינם), מספרי ISBN עם ספרת ביקורת שגויה ו-DOI שמוביל למאמר לא קשור; ספרים מצוטטים בלי מספרי עמודים או עם עמודים שאינם תומכים בטענה. מזוהה רק באימות מול מאגרים (Crossref, Google Scholar).',
    fixHe: 'אמתו כל הפניה במאגר; מחקו או החליפו כל מקור שלא נמצא או שאינו אומר את מה שמיוחס לו.',
    weight: 0.7,
    source: ['wikipedia'],
  },
];

/** Quick lookup by id. */
export const PATTERNS_BY_ID: Record<string, Pattern> = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
