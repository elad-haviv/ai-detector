# קולמוס: זיהוי ושיפור ניסוח AI

כלי לניתוח טקסטים אקדמיים (עברית ואנגלית). הוא מסמן כל משפט שנשמע כמו כתיבה של מודל שפה, מציג אחוז סבירות, מסביר מה הוביל לסימון ומציע ניסוח חלופי.

## איך הזיהוי עובד

כל משפט מקבל ציון משוקלל משלושה מקורות:

| מקור | משקל | מה הוא בודק |
|---|---|---|
| מודל שפה (OpenRouter / OpenAI / Anthropic / Google AI Studio / xAI) | 60% | קורא את המשפט בהקשר, מחזיר הסתברות, דפוסים, הסבר והצעת ניסוח (`src/lib/prompts.ts`) |
| מודל החלטה (Jev של TypeSafe, או מודל אחר מ-OpenRouter Decisions) | 25% | הסתברות מכוילת לשאלת כן/לא על כל משפט |
| כללים מקומיים | 15% | 62 דפוסים מ-Wikipedia "Signs of AI writing", stop-slop ו-humanizer, כולל מקבילות בעברית (`src/lib/patterns/catalog.ts`) |

כשהכללים המקומיים מוצאים ראיה חזקה, הציון לא יורד הרבה מתחתיה. בלי מפתח API האתר עובד על הכללים המקומיים בלבד. הציון הכללי משלב את ממוצע המשפטים, את שיעור הטקסט המסומן ואת ההערכה הכוללת של המודל. רמת הביטחון נקבעת לפי אורך הטקסט ומידת ההסכמה בין המקורות.

מדדי סגנון: גיוון באורך המשפטים (burstiness) ועושר לשוני (MATTR).

## הרצה

```bash
npm install
npm run dev
```

פותחים את http://localhost:3000 ובוחרים ספק ומפתח בעמוד ההגדרות (הגדרות ← גישה).

## ספקים ומפתחות

שלוש דרכים להשתמש בקולמוס:

1. **מפתח API משלכם (חינם, BYOK).** ספקים נתמכים:

   | ספק | מודל ברירת מחדל | איפה מקבלים מפתח |
   |---|---|---|
   | OpenRouter (מפתח אחד לכל המודלים, וגם מודלי החלטה) | `anthropic/claude-sonnet-5.5` | openrouter.ai/keys |
   | OpenAI | `gpt-6.1-terra` | platform.openai.com/api-keys |
   | Anthropic | `claude-sonnet-5-5` | console.anthropic.com/settings/keys |
   | Google AI Studio | `gemini-3.8-flash` | aistudio.google.com/apikey |
   | xAI (Grok) | `grok-4.3` | console.x.ai |

   xAI עובד דרך ה-API התואם ל-OpenAI בכתובת `https://api.x.ai/v1/chat/completions`.

2. **מנוי Pro.** משתמש מנוי מתחבר עם Google ומשלם דרך Paddle, ולא צריך מפתח: השרת משתמש במפתחות של המפעיל (משתני סביבה). מפתח משלכם, אם הוגדר, תמיד גובר.
3. **כללים מקומיים בלבד.** בלי שום מפתח, הניתוח רץ בדפדפן על הכללים המקומיים.

### איפה נשמר המפתח

- המפתחות נשמרים **רק בדפדפן**, בנפרד מההגדרות (`src/lib/keyStore.ts`).
- ברירת המחדל: **ללשונית הזו בלבד** (`sessionStorage`), והם נמחקים כשסוגרים אותה.
- סימון "לזכור במכשיר הזה" מעביר אותם ל-`localStorage`. כפתור "מחק את כל המפתחות" מוחק את שניהם.
- מפתחות שנשמרו בגרסאות קודמות בתוך `kulmus:settings:v1` עוברים פעם אחת לאחסון "לזכור במכשיר" ונמחקים מההגדרות.

### מה השרת עושה עם המפתח

המפתח נשלח בגוף בקשה אחת לנתיב ה-API שלנו, עובר משם לספק, ונשכח. הוא לא נרשם ביומנים, לא נשמר במטמון, בקובץ או במסד נתונים, ולא מוחזר בהודעות שגיאה (טקסט שגיאה מהספק עובר ניקוי). כל תשובות ה-API נשלחות עם `Cache-Control: no-store`. ההתחייבות כתובה גם בראש `src/lib/server/llm.ts`.

### מפתחות בצד השרת

מפתחות בצד השרת (`OPENROUTER_API_KEY` ודומיו, ראו `.env.example`) משמשים **רק** למשתמש שיש לו מנוי פעיל, לפי `getEntitlement(req)` ב-`src/lib/server/entitlement.ts`. בקשה בלי מפתח ובלי מנוי מקבלת 401 `missing_key`. במצב מנוי השרת בוחר בעצמו את הספק והמודל (`MANAGED_PROVIDER`, `MANAGED_MODEL`), ובתוצאה נרשם `meta.mode` (`managed` או `byok`).

"התחברות עם ChatGPT" מוצגת ככפתור מושבת: OpenAI פתחה אותה רק לשותפים נבחרים. הדגל `NEXT_PUBLIC_CHATGPT_SIGNIN=1` שמור למימוש עתידי.

## חשבונות ומנוי, בלי מסד נתונים

אין מסד נתונים ושום דבר לא נכתב לדיסק בשרת:

- **זהות**: התחברות עם Google (OAuth 2.0 + PKCE, נכתב ידנית עם `fetch`, `src/lib/server/google.ts`). האימייל המאומת והשם נשמרים בעוגייה `kulmus_session`: ‏JSON ב-base64url + חתימת HMAC-SHA256 עם `SESSION_SECRET`, ‏HttpOnly, ‏Secure (חוץ מ-http://localhost), ‏SameSite=Lax, ‏30 יום (`src/lib/server/session.ts`). ה-state וה-PKCE verifier נשמרים בעוגייה חתומה קצרת מועד `kulmus_oauth` (‏10 דקות). חתימת ה-id_token לא נבדקת, כי הוא מתקבל ישירות מ-Google בהחלפת הקוד מעל TLS (OIDC Core §3.1.3.7); נבדקים `iss`, `aud`, `exp` ו-`email_verified`.
- **מנוי**: ‏Paddle Billing הוא מקור האמת (`src/lib/server/billing/`, ממשק `BillingProvider` עם `findActiveSubscription(email)` ו-`createPortalUrl(customerId)`). חיפוש: `GET /customers?email=` ואז `GET /subscriptions?customer_id=…&status=active,trialing,past_due`. פורטל: `POST /customers/{id}/portal-sessions` ← `data.urls.general.overview`. התשלום עצמו ב-Paddle.js v2 (overlay), אחרי התחברות, עם האימייל של Google, כדי שהחיפוש לפי אימייל ימצא את המנוי.
- **מטמון הזכאות**: העוגייה מחזיקה צילום של מצב המנוי (`sub.checkedAt`). צילום בן פחות מ-10 דקות נחשב תקף. אחרת השרת שואל את Paddle דרך מטמון בזיכרון (10 דקות, לפי אימייל, לכל מופע). נתיבי ה-API לא יכולים לכתוב עוגיות, ולכן העוגייה עצמה נחתמת מחדש ב-`GET /api/me` (נקרא בטעינה ובחזרה לחלון) וב-`POST /api/account/refresh`. אם Paddle לא זמין, המצב האחרון בעוגייה תקף עד 24 שעות ואז נסגר (free). ‏`active`/`trialing` = Pro; ‏`past_due` = Pro עד `PAST_DUE_GRACE_DAYS` ימים מתחילת התקופה.
- **שימוש הוגן**: הגבלה בזיכרון לכל מופע, חלון נע של שעה לכל אימייל, רק לבקשות managed (`PRO_RATE_LIMIT_PER_HOUR`, ברירת מחדל 100). מעבר למגבלה: ‏429 `rate_limit`. ההגבלה "בערך": מתאפסת באתחול ולא משותפת בין מופעים.

נתיבים: `/api/auth/google`, ‏`/api/auth/google/callback`, ‏`/api/auth/signout` (POST), ‏`/api/me`, ‏`/api/account/refresh` (POST), ‏`/api/account/portal` (POST).

### הגדרת Google OAuth

1. ב-Google Cloud Console: APIs & Services ← OAuth consent screen. סוג External, ‏scopes: ‏`openid`, ‏`email`, ‏`profile`.
2. Credentials ← Create credentials ← OAuth client ID ← Web application.
3. Authorized redirect URI: `${APP_URL}/api/auth/google/callback` (למשל `http://localhost:3000/api/auth/google/callback` בפיתוח).
4. מעתיקים ל-`GOOGLE_CLIENT_ID` ו-`GOOGLE_CLIENT_SECRET`, וקובעים `SESSION_SECRET` (‏`openssl rand -base64 48`) ו-`APP_URL`.

### הגדרת Paddle (sandbox)

1. נרשמים ב-sandbox-vendors.paddle.com.
2. Catalog ← Products: מוצר "Kulmus Pro" עם מחיר חודשי (ואם רוצים גם שנתי). מעתיקים את מזהי `pri_…` ל-`NEXT_PUBLIC_PADDLE_PRICE_MONTHLY` / `NEXT_PUBLIC_PADDLE_PRICE_YEARLY`.
3. Developer tools ← Authentication: יוצרים API key (הרשאות קריאה ל-customers ו-subscriptions, וכתיבה ל-customer portal sessions) ← `PADDLE_API_KEY`; ו-client-side token ← `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
4. Checkout ← Checkout settings: מגדירים Default payment link (למשל `${APP_URL}/pricing`) ומאשרים את הדומיין.
5. `PADDLE_ENV=sandbox`. תשלום בדיקה בכרטיס `4242 4242 4242 4242`. אחרי התשלום Paddle מחזיר ל-`/account?checkout=success`, והעמוד בודק את המנוי מחדש.
6. למעבר לייצור: `PADDLE_ENV=production` ומפתחות/מחירים מהחשבון האמיתי.

משתני `NEXT_PUBLIC_PADDLE_*` נקראים בשרת בזמן הבקשה (עמוד המחירים דינמי), ולכן אפשר לשנות אותם בלי לבנות מחדש. בלי הגדרות Paddle עמוד המחירים מציג "בקרוב"; בלי Google, כפתורי ההתחברות מושבתים עם הסבר.

### עוגיות והסכמה

רק עוגיות חיוניות: `kulmus_session`, ‏`kulmus_oauth`, ‏`kulmus_consent` (הבחירה בהודעת העוגיות, 12 חודשים). הודעת העוגיות (`src/components/CookieConsent.tsx`) מוצגת בביקור הראשון, ו"הגדרות עוגיות" בתחתית העמוד פותח אותה מחדש. כל קוד אנליטיקה עתידי חייב לבדוק `getConsent()` (`src/lib/consent.ts`).

### בדיקות

`npm run check:m3` מריץ בדיקות יחידה בלי רשת: חתימת עוגייה ודחיית זיוף, ‏`returnTo`, ‏PKCE, ‏claims של Google, ‏Paddle עם `fetch` מדומה, והגבלת קצב.

## פריסה

יש `Dockerfile` (Next.js standalone) שמתאים ל-Coolify או לכל שרת Docker.

## מבנה

- `src/lib/segment.ts`: פירוק לפסקאות ומשפטים (Intl.Segmenter) וחלוקה למקטעים
- `src/lib/heuristics.ts`: התאמת דפוסים, ציון, שקלול ומדדים
- `src/lib/runAnalysis.ts`: הרצה בדפדפן, שני מקטעים במקביל ותוצאות שמתעדכנות בהדרגה
- `src/lib/keyStore.ts`: אחסון המפתחות בדפדפן (לשונית או מכשיר)
- `src/lib/server/llm.ts`: מתאמי הספקים, בחירת מפתח (`resolveAccess`) ו-Decisions API
- `src/lib/server/entitlement.ts`: מי רשאי להשתמש במפתחות השרת (עוגייה חתומה + Paddle)
- `src/lib/server/session.ts`, ‏`google.ts`, ‏`billing/`, ‏`rateLimit.ts`: עוגייה, התחברות, מנוי, שימוש הוגן
- `src/lib/account.ts`: ‏`useAccount()` בדפדפן
- `src/app/api/*`: ‏analyze, ‏assess, ‏rewrite, ‏extract (DOCX/PDF), ‏test, ‏models, ‏me, ‏auth, ‏account
- `docs/design-spec.md`: מפרט העיצוב והחוויה

## בהמשך

היסטוריה בענן, מד שימוש וייצוא דוח (דורשים אחסון בצד השרת, ולכן לא נכללו).
