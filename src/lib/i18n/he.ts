/**
 * Hebrew UI microcopy.
 *
 * App name: "קולמוס" (the scholar's pen; short, literary, not tied to "AI").
 * Alternatives considered:
 *   - "כתב יד"     : stresses the human hand behind the text
 *   - "טביעת עט"   : a play on "טביעת אצבע", the writer's own trace
 *   - "שורה אחר שורה" : describes the sentence-by-sentence method
 *
 * Interpolation: {name} placeholders are replaced by the app.
 */
export const he = {
  appName: 'קולמוס',
  tagline: 'לראות איפה הטקסט נשמע מכני, ולהחזיר אותו לקול שלך',

  nav: {
    analyze: 'ניתוח',
    history: 'היסטוריה',
    settings: 'הגדרות',
    about: 'איך זה עובד',
  },

  input: {
    title: 'הדביקו טקסט או העלו קובץ',
    placeholder: 'הדביקו כאן פסקה, פרק או עבודה שלמה. הניתוח נעשה משפט אחר משפט.',
    contextLabel: 'הקשר (לא חובה)',
    contextPlaceholder: 'תחום ונושא, למשל: עבודה סמינריונית בחינוך מיוחד. זה עוזר להבחין בין משלב אקדמי רגיל לבין ניסוח מלאכותי.',
    uploadHint: 'או גררו קובץ לכאן',
    uploadButton: 'בחירת קובץ',
    supportedFormats: 'נתמכים: ‎.docx, ‎.pdf, ‎.txt, ‎.md',
    languageLabel: 'שפת הטקסט',
    languageAuto: 'זיהוי אוטומטי',
    languageHe: 'עברית',
    languageEn: 'אנגלית',
    charCount: '{count} תווים',
    wordCount: '{count} מילים',
    sentenceCount: '{count} משפטים',
    analyzeButton: 'לנתח את הטקסט',
    clearButton: 'ניקוי',
    sampleButton: 'לנסות עם טקסט לדוגמה',
  },

  progress: {
    reading: 'קורא את הקובץ…',
    splitting: 'מפרק למשפטים…',
    measuring: 'מחשב מדדי סגנון…',
    analyzing: 'בודק משפטים: {done} מתוך {total}',
    summarizing: 'מסכם את הממצאים…',
    rewriting: 'מנסח הצעה חלופית…',
    cancel: 'ביטול',
    cancelled: 'הניתוח בוטל',
  },

  results: {
    title: 'תוצאות הניתוח',
    overallLabel: 'הערכה כוללת',
    overallHint: 'הסבירות המשוערת שחלקים מהטקסט נוסחו בסגנון של מודל שפה. זו הערכה ולא הוכחה.',
    scoreBands: {
      '0-20': {
        label: 'נשמע אנושי',
        description: 'כמעט לא נמצאו דפוסים אופייניים לכתיבה של מודל שפה.',
      },
      '20-40': {
        label: 'כנראה אנושי',
        description: 'יש כמה סימנים בודדים, וברוב המקרים הם חלק טבעי מכתיבה אקדמית.',
      },
      '40-60': {
        label: 'לא חד-משמעי',
        description: 'יש סימנים לכאן ולכאן. כדאי לעבור על המשפטים המסומנים ולשפוט בעצמך.',
      },
      '60-80': {
        label: 'דפוסים בולטים',
        description: 'כמה משפטים נשמעים מנוסחים בתבנית. זה עדיין לא אומר מי כתב אותם.',
      },
      '80-100': {
        label: 'דפוסים חזקים',
        description: 'הניסוח דומה מאוד לסגנון של מודלי שפה. גם כאן מדובר בהערכה, ולא בקביעה.',
      },
    },
    sentencesFlagged: '{flagged} מתוך {total} משפטים מעל הסף',
    noneFlagged: 'אף משפט לא עבר את הסף שבחרת.',
    rewriteParagraph: 'הצעה לניסוח מחדש של הפסקה',
    exportReport: 'ייצוא דוח',
    newAnalysis: 'ניתוח חדש',
  },

  categories: {
    vocabulary: 'אוצר מילים',
    structure: 'מבנה',
    tone: 'טון',
    formatting: 'עיצוב',
    rhetoric: 'רטוריקה',
    citation: 'ציטוט והפניה',
    filler: 'מילוי',
  },

  inspector: {
    title: 'פרטי המשפט',
    probability: 'סבירות משוערת',
    patternsDetected: 'דפוסים שזוהו',
    noPatterns: 'לא זוהו דפוסים מובהקים',
    why: 'למה סומן',
    suggestedRewrite: 'הצעה לניסוח',
    noRewrite: 'המשפט נשמע טבעי. אין צורך לשנות.',
    original: 'המקור',
    copy: 'העתקה',
    copied: 'הועתק',
    apply: 'החלה',
    applied: 'הוחל',
    ignore: 'התעלמות',
    ignored: 'סומן כתקין',
    undo: 'ביטול',
    regenerate: 'הצעה אחרת',
    previous: 'המשפט הקודם',
    next: 'המשפט הבא',
    close: 'סגירה',
    rewriteNote: 'ההצעה שומרת על המשמעות, המספרים וההפניות. כדאי לקרוא אותה ולהתאים לקול שלך.',
  },

  filters: {
    title: 'סינון',
    all: 'הכול',
    flaggedOnly: 'רק משפטים מסומנים',
    byCategory: 'לפי קטגוריה',
    hideIgnored: 'הסתרת משפטים שסימנתי כתקינים',
    sortByPosition: 'לפי סדר בטקסט',
    sortByScore: 'לפי ציון, מהגבוה לנמוך',
    reset: 'איפוס',
  },

  threshold: {
    label: 'סף סימון',
    hint: 'משפטים מעל הסף יודגשו בטקסט.',
    value: '{value}%',
  },

  stats: {
    title: 'מדדי סגנון',
    burstiness: 'גיוון באורך המשפטים',
    burstinessHint: 'כותבים אנושיים נוטים לערבב משפטים קצרים וארוכים. טקסט אחיד מדי עשוי להעיד על ניסוח אוטומטי.',
    lexicalDiversity: 'עושר לשוני',
    lexicalDiversityHint: 'היחס בין מספר המילים השונות לסך המילים. ערך נמוך מעיד על חזרתיות.',
    avgSentenceLength: 'אורך משפט ממוצע',
    avgSentenceLengthUnit: '{value} מילים',
    low: 'נמוך',
    medium: 'בינוני',
    high: 'גבוה',
  },

  settings: {
    title: 'הגדרות',
    providerSection: 'ספק מודל',
    provider: 'ספק',
    providers: {
      openrouter: 'OpenRouter',
      google: 'Google AI Studio',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
    },
    apiKey: 'מפתח API',
    apiKeyPlaceholder: 'הדביקו כאן את המפתח',
    apiKeyHint: 'המפתח נשמר רק בדפדפן שלך ונשלח ישירות לספק שבחרת.',
    showKey: 'הצגה',
    hideKey: 'הסתרה',
    model: 'מודל',
    modelPlaceholder: 'בחרו מודל',
    sensitivity: 'רגישות',
    sensitivityLow: 'זהירה',
    sensitivityMedium: 'מאוזנת',
    sensitivityHigh: 'רגישה',
    sensitivityHint: 'ברגישות גבוהה יסומנו יותר משפטים, וגם יותר משפטים אנושיים בטעות.',
    explanationLanguage: 'שפת ההסברים',
    save: 'שמירה',
    saved: 'נשמר',
    testConnection: 'בדיקת חיבור',
    testing: 'בודק…',
    testSuccess: 'החיבור תקין',
    testFailed: 'החיבור נכשל: {reason}',
  },

  history: {
    title: 'היסטוריה',
    analyzedOn: 'נותח ב-{date}',
    open: 'פתיחה',
    delete: 'מחיקה',
    deleteConfirm: 'למחוק את הניתוח הזה? אי אפשר לשחזר אותו.',
    clearAll: 'מחיקת כל ההיסטוריה',
    clearAllConfirm: 'כל הניתוחים השמורים יימחקו מהדפדפן הזה. להמשיך?',
    storedLocally: 'ההיסטוריה נשמרת רק במכשיר הזה.',
  },

  empty: {
    input: 'עוד אין טקסט. אפשר להדביק פסקה אחת כדי להתחיל.',
    results: 'כאן יופיעו התוצאות אחרי הניתוח.',
    history: 'עוד לא ניתחת טקסטים. הניתוחים שלך יישמרו כאן.',
    inspector: 'בחרו משפט בטקסט כדי לראות למה סומן ואיך אפשר לנסח אותו אחרת.',
    filtered: 'אין משפטים שמתאימים לסינון הנוכחי.',
  },

  errors: {
    missingKey: 'כדי לנתח צריך מפתח API. אפשר להוסיף אותו בהגדרות.',
    invalidKey: 'הספק דחה את המפתח. כדאי לבדוק שהעתקת אותו במלואו.',
    network: 'אין חיבור לשרת. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.',
    rateLimit: 'הספק מגביל כרגע את מספר הבקשות. נסו שוב בעוד דקה.',
    invalidFile: 'לא הצלחנו לקרוא את הקובץ. אפשר להעלות ‎.docx, ‎.pdf, ‎.txt או ‎.md.',
    scannedPdf: 'נראה שזה PDF סרוק, בלי שכבת טקסט. אפשר להעתיק את הטקסט ידנית.',
    tooLong: 'הטקסט ארוך מדי לניתוח אחד (עד {max} מילים). אפשר לחלק אותו לפרקים.',
    tooShort: 'הטקסט קצר מכדי להעריך אותו. כדאי להזין לפחות כמה משפטים.',
    badResponse: 'התשובה מהמודל לא הגיעה בפורמט הצפוי. נסו שוב, או בחרו מודל אחר.',
    unknown: 'משהו השתבש. נסו שוב.',
    retry: 'ניסיון חוזר',
  },

  disclaimer: {
    title: 'חשוב לדעת',
    body: 'הכלי מעריך סגנון כתיבה, ולא יכול לקבוע מי כתב טקסט. כתיבה אנושית, במיוחד אקדמית או של כותבים בשפה שנייה, מסומנת לפעמים בטעות. אין להשתמש בתוצאה כראיה נגד אף אחד; היא נועדה לעזור לך לכתוב בבהירות ובקול שלך.',
  },
} as const;

export type HeStrings = typeof he;
