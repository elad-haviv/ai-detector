import type { LegalDoc } from './legal.he';

/**
 * English legal documents: privacy & cookie policy, terms of use and the accessibility statement.
 * Same structure and section ids as legal.he.ts (anchors such as /privacy#cookies work in both).
 * Placeholders in [square brackets] must be filled in by the operator, in both languages.
 * If the two versions ever differ, the Hebrew version prevails for users in Israel.
 */

export const privacyDoc: LegalDoc = {
  title: 'Privacy and cookie policy',
  intro:
    'Penprint is built so that we know as little about you as possible. We have no database: we keep no accounts, texts, API keys or history. This page explains exactly what passes through us, what is stored in your browser and what is held by other providers.',
  sections: [
    {
      id: 'who',
      title: 'Who we are',
      blocks: [
        { p: 'The service is operated by [business name] ([business / company number]), [address] ("we"). Privacy questions: [email].' },
        { p: "This policy covers the Penprint website and its APIs. It follows Israel's Privacy Protection Law, 5741-1981 (including Amendment 13), and the principles of the GDPR for users in the European Union." },
      ],
    },
    {
      id: 'data',
      title: 'What data passes through us, and why',
      blocks: [
        {
          ul: [
            'Texts you analyze: sent from your browser to our server and from there to the AI provider you chose (or that we chose for you on Pro), only to run the analysis. We do not store them or log them. The AI provider processes them under its own policy (see "Third parties").',
            'API keys (if you add one): stored only in your browser. A key is sent to the server inside a single analysis request, passed to the provider and forgotten. It is never stored on the server, in a file, in a cache or in a log.',
            'Sign in with Google (only if you choose to sign in, which is needed only for Pro): Google gives us your verified email address and your name. They are kept only in a signed sign-in cookie (penprint_session) in your browser, not by us.',
            'Payment: Paddle is the Merchant of Record. Your payment details, address and invoices are held by Paddle, and we never see your card details. To check whether you have an active subscription, the server asks Paddle using your email address.',
            'Technical data: the hosting server may log basic access data (IP address, time, request path and response code) for security and operations, without the content of requests. It is deleted according to the hosting provider’s retention policy.',
          ],
        },
        { p: 'Legal basis (under the GDPR): performing the service you asked for (analysis, sign-in, subscription) and our legitimate interest in keeping the service secure. We have no analytics, ads or profiling.' },
      ],
    },
    {
      id: 'storage',
      title: 'What is stored in your browser',
      blocks: [
        { p: 'This data is stored on your device only, and you can delete it at any time (in the site settings, on the history page, or by clearing the site data in your browser).' },
        {
          table: {
            caption: 'Local browser storage',
            head: ['Name', 'What it holds', 'How long'],
            rows: [
              ['penprint:settings:v1 (localStorage)', 'Settings: provider, model, sensitivity, explanation language, color theme, text size', 'Until you delete it'],
              ['penprint:history:v1 (localStorage)', 'Your analysis history, including the texts', 'Until you delete it (up to 40 analyses)'],
              ['penprint-files (IndexedDB)', 'Word files you uploaded, to show them in the formatted view', 'Until you delete the analysis'],
              ['penprint:keys:session:v1 (sessionStorage)', 'API keys, by default', 'Until you close the tab'],
              ['penprint:keys:v1 (localStorage)', 'API keys, only if you checked "Remember on this device"', 'Until you delete it'],
              ['penprint:onboarded:v1 (localStorage)', 'That you chose "Try with local rules"', 'Until you delete it'],
            ],
          },
        },
        { p: 'If you used the site under its previous name, the data your browser stored back then was moved once to the new names on your first visit after the rename, and the old copies were deleted.' },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      blocks: [
        { p: 'We use only essential cookies, without which the service cannot work. There are no analytics or advertising cookies. You can change your choice at any time through "Cookie settings" at the bottom of every page.' },
        {
          table: {
            caption: 'Cookies set by Penprint',
            head: ['Name', 'Purpose', 'Duration', 'Type'],
            rows: [
              ['penprint_session', 'Remembers that you signed in (email, name and subscription status), signed so it cannot be forged. Set only after you sign in. HttpOnly.', '30 days', 'Essential'],
              ['penprint_oauth', 'Secures the Google sign-in flow (state and PKCE). Deleted as soon as sign-in completes. HttpOnly.', '10 minutes', 'Essential'],
              ['penprint_lang', 'Remembers the interface language you chose (Hebrew or English) so the page loads in it from the start. Set only when you switch language.', '12 months', 'Essential (preference)'],
              ['penprint_consent', 'Remembers your choice in the cookie notice and its date.', '12 months', 'Essential'],
            ],
          },
        },
        { p: "Paddle's checkout window is loaded from Paddle's servers and may set its own cookies for payment and fraud prevention, under [Paddle's cookie policy](https://www.paddle.com/legal/cookie-policy)." },
      ],
    },
    {
      id: 'third-parties',
      title: 'Third parties',
      blocks: [
        { p: 'We pass data only to those who need it to provide the service. Some providers are outside Israel and the EU (mainly in the US), so data may be transferred there, subject to their data-protection commitments.' },
        {
          ul: [
            "Google: sign-in (name and email). [Google's privacy policy](https://policies.google.com/privacy)",
            "Paddle: payment, invoices and VAT, and subscription management. [Paddle's privacy policy](https://www.paddle.com/legal/privacy)",
            "OpenRouter: text analysis, if you chose it, or on Pro when it is our provider. [OpenRouter's privacy policy](https://openrouter.ai/privacy)",
            "OpenAI: text analysis, if you chose it. [OpenAI's privacy policy](https://openai.com/policies/privacy-policy/)",
            "Anthropic: text analysis, if you chose it. [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy)",
            'Google AI Studio (Gemini API): text analysis, if you chose it. [Gemini API terms](https://ai.google.dev/gemini-api/terms)',
            "xAI: text analysis, if you chose it. [xAI's privacy policy](https://x.ai/legal/privacy-policy)",
          ],
        },
        { p: 'When you use your own key, the relationship between you and the provider is governed by its terms and policies, including whether it keeps your texts or trains models on them.' },
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        { p: "Under Israel's Privacy Protection Law, 5741-1981, and its Amendment 13, you have the right to see the information about you, to ask for it to be corrected or deleted, and to be told how it is used. Users in the European Union also have rights under the GDPR: access, rectification, erasure, restriction of processing, data portability and objection to processing." },
        {
          ul: [
            'Because we have no database, you hold most of the data yourself: "Sign out" deletes the sign-in cookie, and clearing the site data in your browser deletes your settings, history and keys.',
            'Payment and subscription data is held by Paddle. You can contact us at [email] and we will help, or contact Paddle directly.',
            "If you believe we have violated your rights, you can complain to Israel's [Privacy Protection Authority](https://www.gov.il/en/departments/the_privacy_protection_authority), or to the data-protection supervisory authority in your EU country.",
          ],
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      blocks: [
        { p: 'All traffic is encrypted (HTTPS). The sign-in cookie is signed with HMAC-SHA256, marked HttpOnly and Secure, and cannot be read by code on the page. API keys and request content are never logged, and provider errors are stripped of keys before they are shown.' },
        { p: 'Keys you chose to "Remember on this device" are stored in the browser without extra encryption, so do not choose that option on a shared computer.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [{ p: 'If we change this policy we will update the date at the top of the page. A material change, such as adding analytics, will also be announced on the site and will not be enabled without your consent.' }],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: [{ p: '[Business name] · [address] · [email]. We aim to reply within 30 days, including to requests under the law.' }],
    },
  ],
};

export const termsDoc: LegalDoc = {
  title: 'Terms of use',
  intro: 'These are the terms for using Penprint. We wrote them in plain language. By using the service you agree to them; if you do not agree, please do not use the service.',
  sections: [
    {
      id: 'parties',
      title: 'Who we are',
      blocks: [{ p: 'The service is operated by [business name] ([business / company number]), [address] ("we"). Contact: [email].' }],
    },
    {
      id: 'service',
      title: 'What the service does',
      blocks: [
        { p: 'Penprint estimates, sentence by sentence, how much a text sounds like language-model writing, explains what led to the estimate and suggests alternative wording. You can use it in three ways: with your own API key (free), with a Pro subscription (paid), or with local rules only.' },
      ],
    },
    {
      id: 'accuracy',
      title: 'Results are estimates only',
      blocks: [
        {
          ul: [
            'There is no way to know for certain who wrote a text. Results are a statistical estimate that can be wrong in both directions, especially for academic writing, writing by second-language authors and short texts.',
            'Do not use the results as the sole basis for an academic, disciplinary or employment sanction against anyone. Such a decision requires human review, a conversation with the author and further evidence.',
            'We make no commitment that the results are accurate, complete or fit for any particular purpose.',
          ],
        },
      ],
    },
    {
      id: 'byok',
      title: 'Using your own API key',
      blocks: [
        {
          ul: [
            'You are responsible for your key, for keeping it safe and for all costs the provider charges for using it. We charge nothing for it.',
            'Use of a provider is subject to its own terms and policies (OpenRouter, OpenAI, Anthropic, Google, xAI). You are responsible for complying with them.',
            'Your key is stored only in your browser, and we do not keep it. If your key leaks, revoke it with the provider.',
          ],
        },
      ],
    },
    {
      id: 'subscription',
      title: 'Pro subscription',
      blocks: [
        {
          ul: [
            "The subscription is sold and billed by Paddle.com, the Merchant of Record. [Paddle's buyer terms](https://www.paddle.com/legal/checkout-buyer-terms) also apply to the payment. Paddle issues the invoice and collects VAT as required by law.",
            'The subscription renews automatically every billing period (monthly or yearly) until you cancel. The current price is shown on the pricing page and at checkout.',
            'You can cancel at any time on the "My account" page → "Manage billing". Cancellation takes effect at the end of the paid period, and the subscription will not renew.',
            'The subscription includes fair use: a number of model calls per hour, as listed on the pricing page. We choose the provider and model and may change them to maintain quality.',
            'A price change applies only from the next billing period, and we will notify you by email in advance.',
          ],
        },
      ],
    },
    {
      id: 'refunds',
      title: 'Cancellation and refunds',
      blocks: [
        { p: "Under Israel's Consumer Protection Law, 5741-1981, a consumer may cancel a distance purchase within 14 days of the transaction or of receiving the disclosure document, whichever is later, subject to the cancellation fee set by law (5% of the price or ILS 100, whichever is lower). An ongoing transaction may be cancelled at any time by notice." },
        { p: "Refunds are made through Paddle under [Paddle's refund policy](https://www.paddle.com/legal/refund-policy). To ask for a refund, reply to Paddle's receipt or write to us at [email]. Nothing here limits your rights under the law." },
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      blocks: [
        {
          ul: [
            "Do not upload texts you have no right to use, or other people's sensitive personal information without permission.",
            'Do not try to bypass usage limits, overload the service, access it automatically at unusual volume, or share one subscription among several people.',
            'Do not use the service for unlawful activity or to harm others.',
          ],
        },
        { p: 'If a material term is breached, we may suspend access to the subscription, with notice where possible.' },
      ],
    },
    {
      id: 'content',
      title: 'Your content',
      blocks: [{ p: 'The texts you analyze, and the suggestions you receive for them, belong to you. We do not store them or use them for any other purpose. The service’s code, design and name belong to us.' }],
    },
    {
      id: 'availability',
      title: 'Availability and changes to the service',
      blocks: [{ p: 'The service is provided as is. We work to keep it available, but there may be outages, maintenance downtime or changes to features. The service also depends on the availability of the AI providers, Google and Paddle.' }],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      blocks: [
        { p: 'To the fullest extent permitted by law, we are not liable for indirect or consequential damage, loss of data or any decision made on the basis of the results. Our total liability in connection with the service is limited to the amount you paid us in the three months before the event. This limitation does not affect liability that cannot be limited by law, including under consumer protection law.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: [{ p: 'If we change these terms we will update the date at the top of the page. Subscribers will be told about a material change in advance and can cancel before it takes effect.' }],
    },
    {
      id: 'law',
      title: 'Governing law and jurisdiction',
      blocks: [{ p: 'These terms are governed by the laws of the State of Israel. The competent courts of the Tel Aviv-Jaffa district have exclusive jurisdiction, without limiting a consumer’s right to go to the court where they live when the law grants that right.' }],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: [{ p: '[Business name] · [address] · [email] · [phone]' }],
    },
  ],
};

/**
 * Accessibility statement. The Hebrew version (הצהרת נגישות) is the one required by the Equal Rights
 * for Persons with Disabilities (Service Accessibility Adjustments) Regulations 2013, reg. 35; keep
 * both versions' dates and the coordinator's details in step.
 */
export const accessibilityDoc: LegalDoc = {
  title: 'Accessibility statement',
  updated: 'Statement date: November 9, 2026 · Last accessibility audit: November 9, 2026',
  intro:
    'Penprint is an online service for analyzing and improving texts. We see accessibility as part of the quality of the service and work so that everyone, including people with disabilities, can use it independently, equally and comfortably. This statement describes the site’s accessibility, what we have done, what is still limited, and how to contact us.',
  sections: [
    {
      id: 'standard',
      title: 'Conformance level and standard',
      blocks: [
        {
          p: "The site is designed to meet Israel's Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013, and Israeli Standard SI 5568 at level AA. That standard is based on the W3C's Web Content Accessibility Guidelines (WCAG) 2.0; we test the site against WCAG 2.1 level AA, which is stricter.",
        },
        {
          p: 'The site does not use an accessibility plug-in or overlay toolbar. Accessibility is built into the code itself, so it works with the tools you already use: screen readers, browser zoom, keyboard navigation and your operating system’s settings.',
        },
      ],
    },
    {
      id: 'done',
      title: 'What we did to make the site accessible',
      blocks: [
        {
          ul: [
            'Full keyboard access: every action works from the keyboard, in a logical order, with no focus traps. A "Skip to main content" link at the start of every page.',
            'Visible focus: a clear focus outline (at least 3:1 contrast) on every element you can reach, including the highlighted sentences in the results.',
            'Windows and dialogs: focus moves into a dialog when it opens, Esc closes it and focus returns to where it was opened from. On mobile, the sentence-details panel closes with Esc and returns focus to the sentence.',
            'Screen-reader support: named headings and landmarks, labels for every field and button, and status messages (analysis progress, connection test, copy, delete and errors) that are announced automatically without moving focus. [Update after testing: tested with NVDA version ___ in Firefox/Chrome on Windows, and with VoiceOver in Safari on macOS and iOS].',
            'Results do not rely on color alone: each likelihood level also has its own underline style (dotted, dashed, solid), a written percentage, and text read out to screen readers.',
            'Contrast: text at 4.5:1 or more, and graphical elements and field borders at 3:1 or more, in both light and dark mode.',
            'Text size: you can enlarge all text on the site from Settings (Normal, Large, Larger), and zoom the browser up to 400% without horizontal scrolling and without losing content or functions.',
            'Dark mode: following your system setting, or chosen manually in Settings.',
            'Language and direction: the site is available in Hebrew (right to left) and English (left to right); switch with the language button in the header or in Settings. The page language and direction are set from the first load, and passages in another language are marked with their language so screen readers pronounce them correctly. Text you enter is shown in its own direction automatically.',
            'Motion: animations are turned off when your system asks to reduce motion, and nothing on the site flashes.',
            'No time limits: nothing has to be completed within a set time. Pop-up notifications close by themselves, but their content is announced and also available on the page.',
            'Forms: every field has a visible label, guidance where needed, and error messages that are linked to the field and announced.',
            'Small screens and touch: the site works at a width of 320 pixels, and tap targets are at least 24×24 pixels (most are 44×44).',
            'File uploads: you can upload TXT, MD, DOCX and PDF files with an ordinary button (not only by dragging). Text extracted from a file is shown as plain, accessible text, and Word files can also be viewed in the text view.',
            'Testing: every page and main state is tested automatically with axe-core against WCAG 2.1 AA, in light and dark mode, at desktop width and at 320 pixels, in both Hebrew and English, and was also checked manually with the keyboard and with zoom.',
          ],
        },
      ],
    },
    {
      id: 'limits',
      title: 'Known limitations',
      blocks: [
        { p: 'We keep improving accessibility. These are the parts we know are not yet fully accessible:' },
        {
          ul: [
            'Previews of documents you upload: the Word view is built from the file itself, so its accessibility (headings, alt text for images, tables) depends on the accessibility of the original file. The text view is always available as an accessible alternative. Scanned PDFs (images only) are not supported, because they contain no text to read.',
            'Third-party services: the Paddle checkout and the Google sign-in window are run by those companies, not by us, and their accessibility is their responsibility. If you run into a problem there, contact us and we will help you complete the action another way.',
            'Suggested rewrites and explanations are generated by a language model and may occasionally contain passages in another language that are not marked as such.',
          ],
        },
      ],
    },
    {
      id: 'physical',
      title: 'Physical accessibility',
      blocks: [{ p: 'Penprint is an online-only service. We have no office or place that receives the public, so physical accessibility arrangements do not apply.' }],
    },
    {
      id: 'contact',
      title: 'Accessibility coordinator and requests',
      blocks: [
        { p: 'Did you run into an accessibility problem, or do you need an accommodation to use the service (for example, information in another format or help completing an action)? We are happy to help. Contact our accessibility coordinator:' },
        {
          ul: ['Name: [accessibility coordinator’s name]', 'Phone: [phone]', 'Email: [email]', 'How to reach us: phone or email, in Hebrew or English.'],
        },
        {
          p: 'To help us handle your request, please tell us what you were trying to do, on which page, what the problem was, and which browser and assistive technology you used (if any). We will confirm receipt and get back to you within 5 business days. A problem that prevents use of the service is handled with top priority, and until it is fixed we will offer another way to complete the action.',
        },
      ],
    },
    {
      id: 'updates',
      title: 'Updates to this statement',
      blocks: [
        { p: 'This statement was written on November 9, 2026. The last accessibility audit took place on November 9, 2026. We will update the statement after any material change to the site, and at least once a year.' },
      ],
    },
  ],
};
