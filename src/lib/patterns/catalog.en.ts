/**
 * English UI text for the pattern catalog (catalog.ts holds the Hebrew text and the English names).
 * Keyed by pattern id; `scripts/check-m3.ts` asserts every pattern has an entry here.
 */
export const PATTERN_TEXT_EN: Record<string, { description: string; fix: string }> = {
  delve: {
    description: 'The verb "delve" (and its Hebrew equivalent, "diving deep") is one of the best-known signs of language-model text; human writers almost never use it in academic prose.',
    fix: 'Just write "we examine" or "we analyze", or simply present the analysis without announcing it.',
  },
  tapestry: {
    description: 'Textile metaphors ("rich tapestry", "diverse fabric", "colorful mosaic") recur again and again in model text to describe anything complex, with no real content.',
    fix: 'Replace it with a direct word such as "variety" or "combination", or spell out what the thing is made of.',
  },
  testament: {
    description: '"Stands as a testament" and "serves as a reminder" inflate an ordinary fact into proof or a grand lesson; a stock AI turn of phrase.',
    fix: 'State the fact itself, and if there is a causal link, explain it explicitly with a source.',
  },
  'pivotal-crucial': {
    description: 'Models attach "pivotal", "crucial", "vital" and "paramount" to any topic to signal importance.',
    fix: 'Delete the adjective, or explain exactly why and how much the thing matters.',
  },
  'underscore-highlight': {
    description: '"Underscores", "highlights" and "emphasizing" appear on the over-used word lists of every model generation (GPT-4 to GPT-5), and are used to attach meaning to a fact without supporting it.',
    fix: 'Write what the fact actually shows and who concluded it, or drop the verb.',
  },
  showcase: {
    description: '"Showcase" and "showcasing" are marketing words that models slip into expository text instead of "shows" or "includes".',
    fix: 'Use "shows", "presents" or "includes", or describe the thing itself.',
  },
  'intricate-meticulous': {
    description: '"Intricate", "intricacies", "meticulous" and "nuanced" appear far more often in model text than in human writing.',
    fix: 'Instead of saying something is intricate or meticulous, show the detail that makes it so.',
  },
  'landscape-realm': {
    description: 'Using "landscape" or "realm" abstractly ("the technological landscape", "in the realm of education") is model jargon in place of naming the field itself.',
    fix: 'Write "the field", "the situation" or the name of the specific field.',
  },
  'ai-buzz-verbs': {
    description: 'Verbs such as foster, enhance, bolster, garner, leverage, harness, empower, elevate and navigate recur in model text as stand-ins for simple verbs.',
    fix: 'Use a plain, precise verb: "improves", "increases", "uses", "deals with".',
  },
  'ai-buzz-adjectives': {
    description: 'Adjectives such as robust, vibrant, enduring, seamless, multifaceted, holistic, transformative and ever-evolving signal generic model writing.',
    fix: 'Delete the adjective or replace it with a specific, measurable description.',
  },
  'ai-vocabulary-2026': {
    description: 'According to Wikipedia, models from mid-2026 (GPT-6) shifted to a different vocabulary: dependable, quietly, universally, prioritize, echoed, alongside short sentences and heavy use of periods and commas. Each word alone is common in human writing too, so the weight is very low.',
    fix: 'Check whether the word adds information; if not, replace it with a specific description or delete it.',
  },
  'journey-metaphor': {
    description: 'Models describe every process as a "journey" ("embark on a journey", "the journey toward"), an emotional metaphor that does not suit academic writing.',
    fix: 'Describe the process itself and its stages instead of using a journey metaphor.',
  },
  'ever-changing-world': {
    description: 'A generic opening such as "In today\'s fast-paced world" or "in the digital age" is one of the most worn-out signs of machine text.',
    fix: 'Delete the opener and start straight with the claim or the specific figure.',
  },
  'cliche-metaphors': {
    description: 'Stock phrases such as "sheds light on", "paves the way", "opens a window onto", "a double-edged sword" or "at the forefront of" appear unusually densely in model text and replace a precise claim.',
    fix: 'Say plainly what exactly the research shows or makes possible.',
  },
  'business-jargon': {
    description: 'Phrases such as lean into, double down, circle back, game-changer, moving forward or "paradigm shift" are clichés models pick up from marketing copy.',
    fix: 'Use a plain verb or noun: "changes fundamentally", "from now on", "will revisit".',
  },
  'intensifier-adverbs': {
    description: 'Words such as really, truly, genuinely, fundamentally, inherently and crucially add empty emphasis without information. Weak on its own.',
    fix: 'Delete the adverb; if the sentence gets weaker, strengthen it with a fact, not an intensifier.',
  },
  'lazy-extremes': {
    description: 'Generalizations such as "always", "never", "everyone" or "no one" lend false authority in place of a precise figure. A weak sign on its own.',
    fix: 'Replace it with a precise amount or scope ("in most of the cases examined", "61% of respondents").',
  },
  'not-only-but-also': {
    description: 'The "not only X but also Y" construction inflates a claim with an artificial contrast; language models use it especially often.',
    fix: 'Write both claims as one simple positive sentence ("X and Y"), or keep only the important one.',
  },
  'negative-parallelism': {
    description: 'The pattern "It\'s not X, it\'s Y" denies a claim nobody made so that the second half looks bigger; according to humanizer, the strongest sign of all.',
    fix: 'Delete the negating half and state Y directly.',
  },
  'false-reframe': {
    description: 'Openings such as "The real question isn\'t..." or "Not because X, but because Y" set up a predictable dramatic reversal instead of presenting the claim.',
    fix: 'Present the real question or reason directly, without the negative part.',
  },
  'negative-listing': {
    description: 'A run of negations listing what something is not ("Not X. Not Y. Just Z.", "no X, no Y, just Z") is a rhetorical striptease typical of machine text.',
    fix: 'Say what the thing is, in one sentence.',
  },
  'rule-of-three': {
    description: 'Models arrange ideas in threes ("innovation, inspiration and insight") to sound complete, even when the content has no three parts. Detected statistically (density of triads), not from a single phrase.',
    fix: 'Keep only the items that add a separate idea; two, or one, is usually enough.',
  },
  'dramatic-fragments': {
    description: 'A short closing line that repeats the point ("That\'s the thing. That\'s the whole story.") or a string of dramatic fragments is staged emphasis that adds no information.',
    fix: 'Delete the punchline, or merge the fragments into one full sentence with a specific claim.',
  },
  'uniform-rhythm': {
    description: 'Consecutive sentences of nearly the same length and structure create a mechanical rhythm; human writing alternates short and long sentences. According to Wikipedia, mid-2026 models write almost only short sentences of 8–20 words, with just periods and commas. Detected statistically.',
    fix: 'Vary it: join two short sentences or split a long one.',
  },
  'repeated-openings': {
    description: 'Several sentences in a row that open with the same word or subject ("The study... The study... The study...") point to mechanical repetition. Detected by comparing neighbouring sentences.',
    fix: 'Merge sentences, or open with the action instead of the subject.',
  },
  'false-range': {
    description: 'Models write "from X to Y" between two things that are not ends of the same scale, just to sound comprehensive.',
    fix: 'List the relevant items explicitly, or keep only the important example.',
  },
  'elegant-variation': {
    description: 'Models swap a noun for a different alias in every sentence ("the researcher", "the renowned scholar", "the Israeli thinker") to avoid repetition, which confuses the reader. Detected only by contextual analysis.',
    fix: 'Pick one term and use it consistently.',
  },
  'rather-than-contrast': {
    description: 'The reversed form of negative parallelism ("Rather than simply retelling..., the film...", "a bridge rather than a replacement") is especially common in 2026 model output. "Rather than" itself is very common in human writing, so it is only caught at the start of a sentence or with "simply/merely", and at a low weight.',
    fix: 'Say what the thing does, without setting it against an alternative nobody proposed.',
  },
  'title-as-entity-lead': {
    description: 'Models open by defining the list title or concept as if it were a thing in the world ("The List of X is a curated compilation of...", "X refers to..."), instead of talking about the subject directly.',
    fix: 'Open with the subject itself ("Many songs about Mexico..."), not with a definition of the title.',
  },
  'throat-clearing': {
    description: 'Openers such as "Here\'s the thing", "The truth is" or "Let\'s be honest" announce a point instead of making it.',
    fix: 'Delete the opener and start with the claim itself.',
  },
  'lets-dive-in': {
    description: 'Invitations such as "Let\'s dive in", "Let\'s break it down" or "Let\'s explore" are leftovers of chatbot style and do not belong in academic work.',
    fix: 'Delete the invitation and present the content right away.',
  },
  'emphasis-crutch': {
    description: 'Phrases such as "Let that sink in", "Full stop." or "Make no mistake" add no meaning and perform artificial emotion.',
    fix: 'Delete the phrase; if the claim matters, back it with a figure.',
  },
  'rhetorical-question-setup': {
    description: 'A short question answered straight away ("The result? ...", "And the best part?", "What if...?") is a staged pattern models use to create drama.',
    fix: 'Write the answer as an ordinary statement and delete the question.',
  },
  'pseudo-profound': {
    description: 'Phrases such as "At its core", "What really matters" or "At the heart of it" dress an ordinary point up as an insight.',
    fix: 'Replace the saying with the specific claim behind it.',
  },
  'arguing-with-no-one': {
    description: 'The text defends itself against a claim nobody made ("I\'m not saying", "To be clear", "One might be tempted to"), usually a leftover of a machine draft.',
    fix: 'Delete the defence; if it contains a real claim, state it directly.',
  },
  'vague-declarative': {
    description: 'Sentences such as "The implications are significant" or "The stakes are high" announce importance without naming the specific thing.',
    fix: 'State the specific implication or reason, or delete the sentence.',
  },
  'false-agency': {
    description: 'Giving human action to an inanimate thing ("the decision emerges", "the data tells us", "the discourse moves toward") hides who actually acted.',
    fix: 'Name the person or body that acted ("the researchers found", "the committee decided").',
  },
  'promotional-puffery': {
    description: 'Words such as nestled, breathtaking, renowned, groundbreaking, exemplifies or "rich heritage" turn expository text into an advertisement. According to Wikipedia this is typical mainly of 2023–2025 models; newer models promote less.',
    fix: 'Describe what the thing actually is, in neutral language and with data.',
  },
  'inflated-significance': {
    description: 'Models attach to an ordinary fact a claim that it "marks a turning point", "reflects a broader trend", "sparked public debate" or "leaves an indelible mark": importance or wider context that was never shown, sometimes even after admitting the topic is minor.',
    fix: 'Keep the fact itself and end on the last concrete detail.',
  },
  'plays-key-role': {
    description: '"Plays a crucial/pivotal/key role" is one of the most frequent phrases in machine text, and usually does not explain what the role is.',
    fix: 'Write what the factor actually does and how much ("explains 40% of the variance").',
  },
  'challenges-future-outlook': {
    description: 'A rigid formula: "Despite its [strengths], X faces several challenges..." followed by "Despite these challenges, X continues to thrive" or "the future looks promising", sometimes under a "Challenges and future outlook" heading. The sign is the formula, not mentioning challenges as such.',
    fix: 'Delete the "challenges and future" paragraph, or replace it with concrete plans and data from your sources.',
  },
  'vague-attribution': {
    description: 'Attribution to an unnamed authority ("experts believe", "studies show") without a specific citation is a clear sign of machine text, and in academic work also a methodological flaw.',
    fix: 'Add a precise citation (author, year) or delete the claim.',
  },
  'media-coverage-emphasis': {
    description: 'Instead of summarizing what sources say, models stress the coverage itself and the kind of sources ("featured in national media outlets", "independent coverage", "trade publications") or an "active social media presence". Especially common in tools from 2025 on.',
    fix: 'Write what the source actually says, with a citation, instead of noting that the topic was covered.',
  },
  'identified-by-sources': {
    description: 'Models (mainly from 2026) stress how a primary source or database "identifies" the subject ("His website identifies him as...", "records list her as...") instead of stating the fact. The wording is stiff and formulaic.',
    fix: 'State the fact directly ("X is a retired officer") with a citation to the source.',
  },
  'awards-recognition-heading': {
    description: 'Headings of the form "X and Y", especially "Awards and recognition", "Legacy and impact" or "Challenges and future directions", are almost fixed features of AI-generated texts and reflect a focus on legacy and recognition.',
    fix: 'Give the section a heading that describes its specific content, or fold the information into another section.',
  },
  'source-usage-disclaimer': {
    description: 'Since mid-2026 models add instructions on how a claim "should be treated" ("should be treated as tradition rather than as evidence"), state that information "does not by itself establish" a conclusion, or clarify that something "should not be confused" with another topic. Before July 2026 this barely appeared.',
    fix: 'Write what the source says and who says it; if in doubt, attribute the claim, without instructions to the reader.',
  },
  sycophancy: {
    description: 'Compliments to the asker ("Great question!", "You\'re absolutely right") are leftovers of a chatbot conversation pasted into the text.',
    fix: 'Delete the compliment and keep only the content.',
  },
  'chatbot-residue': {
    description: 'Conversational openings, closings and instructions ("Certainly!", "I hope this helps", "Would you like...", "Here are several paraphrases", "verify before submitting") are the surest sign the text was copied from a chatbot.',
    fix: 'Delete the conversational wrapper and keep only the content.',
  },
  'knowledge-cutoff': {
    description: 'Sentences such as "As of my last training update" or "based on available information" reveal that a model wrote the text, and sometimes fill a gap in knowledge with a guess.',
    fix: 'Delete the disclaimer; state what the sources actually show, or drop the claim.',
  },
  'ai-self-reference': {
    description: 'Phrases such as "As an AI language model" are direct proof of copying from a chatbot.',
    fix: 'Delete the whole sentence and write the content yourself.',
  },
  'important-to-note': {
    description: 'Editorial phrases such as "It\'s important to note" or "It is worth noting" announce importance instead of showing it, and models use them unusually densely.',
    fix: 'Delete the phrase and start straight with the information.',
  },
  'in-conclusion': {
    description: 'A sentence that opens with "In conclusion", "In summary", "Overall" or "The bottom line" and repeats what was just said is a fixed model ending.',
    fix: 'End on the last new claim or finding, without repeating the paragraph.',
  },
  'transition-overuse': {
    description: 'Opening many sentences with "Moreover", "Furthermore" or "Additionally" creates a mechanical rhythm of connectors; high density is a typical sign.',
    fix: 'Delete most connectors; if the link is clear from context, they are not needed.',
  },
  'meta-signposting': {
    description: 'Sentences that describe the text itself ("In this section, we will explore", "As we\'ll see", "The table below compares") instead of the subject. Some structure is legitimate in academic work, so the weight is low.',
    fix: 'Keep one structural announcement at the start of the section, and elsewhere just present the content.',
  },
  'filler-phrases': {
    description: 'Phrases such as "When it comes to", "At the end of the day" or "In terms of" lengthen the sentence without adding content.',
    fix: 'Delete the phrase and open directly with the subject.',
  },
  'hedging-stack': {
    description: 'Stacking several hedges ("could potentially", "it may arguably") makes every claim noncommittal; a single hedge is fine.',
    fix: 'Keep one hedge that your source supports, and state the claim clearly.',
  },
  'copula-avoidance': {
    description: 'Models replace "is/has" with inflated phrases such as "serves as", "stands as", "boasts" or "holds the distinction of". A study found use of is/are in academic writing dropped by more than 10% from 2023. "Serves as" is common among human writers too, so the weight is medium.',
    fix: 'Use "is" or "has", e.g. "X is the center of the research" instead of "X serves as the center of the research".',
  },
  'superficial-ing-analysis': {
    description: 'A tail on the end of a sentence such as ", highlighting the importance of..." or ", which reflects..." sticks an interpretation onto a simple fact without support.',
    fix: 'Keep the fact; add interpretation only if a source supports it, as a separate sentence with a citation.',
  },
  'vague-association': {
    description: 'Instead of saying how two things relate ("directed", "taught at"), models write that they are "associated with", "connected to" or "in connection with", sometimes again and again. According to Wikipedia this is among the most common signs in 2026. "Associated with" is also very common in scientific writing, so only typical combinations are caught.',
    fix: 'State the exact relationship (founded, directed, caused, resulted from) if the source allows.',
  },
  'revision-assurance': {
    description: 'Models asked to edit add a formulaic revision summary: "improved clarity and flow", "a more neutral/academic tone", "while preserving the original meaning", "addressed reviewer feedback". Wikipedia documents this in edit summaries; in submitted work it is leftover output.',
    fix: 'Delete the revision note; if you need to document changes, say what actually changed and why.',
  },
  'stiff-synonyms': {
    description: 'Wikipedia notes that human writers prefer the plain words (used, wrote, moved, died), while models prefer stiff or euphemistic ones (utilized, authored, relocated, passed away). A very weak sign on its own.',
    fix: 'Use the plain word: "used", "wrote", "moved", "died".',
  },
  'em-dash-overuse': {
    description: 'The em dash (—), usually with spaces around it, used as a universal connector instead of a comma, parentheses or a colon, is one of the most visible signs of language models; a single dash is weak, high density is strong. Since late 2026 newer models avoid it entirely, so its absence proves nothing.',
    fix: 'Replace it with a period, comma, colon or parentheses, depending on how the parts relate.',
  },
  'curly-quotes': {
    description: 'Curly quotation marks and apostrophes (“ ” ’) instead of straight ones or Hebrew gershayim (״) appear in text copied from a chatbot; Word curls quotes automatically, so on its own the sign is very weak.',
    fix: 'Use one kind of quotation mark consistently throughout the paper.',
  },
  'title-case-heading': {
    description: 'English headings in which every word is capitalized ("Strategic Negotiations And Global Partnerships") are a model default. Not relevant to Hebrew; detected in case-sensitive code rather than a regex (the i flag is on).',
    fix: 'Write English headings in sentence case: capitalize only the first word and proper nouns.',
  },
  'excessive-bold': {
    description: 'Bolding many terms in running text (**like this**) for no reason is a formatting habit of models that work in Markdown.',
    fix: 'Remove the bold; at most, bold one defined term where it first appears.',
  },
  'inline-header-list': {
    description: 'A list in which every item opens with a bold label and a colon ("- **Performance:** performance improved") is a fixed model template, and the label usually just repeats the content.',
    fix: 'Turn the list into a continuous paragraph, or remove the labels.',
  },
  'emoji-decoration': {
    description: 'Emoji at the start of headings or list items (🚀, 💡, ✅) and decorative arrows (→) are not acceptable in academic writing and are typical of chatbot output.',
    fix: 'Remove the emoji and arrows and express the relationship in words.',
  },
  'markdown-artifacts': {
    description: 'Markdown left in the text (## headings, ```, --- dividers, links in [text](url) form) shows the text was pasted straight from a chat interface. According to Wikipedia this is among the most common signs today.',
    fix: 'Remove the markup and use your word processor’s formatting.',
  },
  'placeholder-text': {
    description: 'Unfilled templates ("[Your Name]", "[Article Title 1]", "[Year]", "(Add your URL here)", "INSERT_SOURCE_URL_30", "2025-XX-XX", "example.com/source1") are near-certain proof of copying from model output.',
    fix: 'Fill in the missing detail from your sources, or delete the sentence.',
  },
  'chatgpt-citation-artifacts': {
    description: 'Strings such as "contentReference[oaicite:0]", "turn0search0", "citeturn", links with "utm_source=chatgpt.com" / "utm_source=copilot.com" / "referrer=grok.com", or a ↩ return mark next to footnotes, remain when a chatbot answer is copied: near-certain proof the tool was used (though not necessarily to write the text itself).',
    fix: 'Delete the string and check the original source by hand; cite it in the required academic format.',
  },
  'fabricated-references': {
    description: 'Models invent papers, broken links (missing even from the Internet Archive), ISBNs with a wrong check digit and DOIs that lead to an unrelated paper; books are cited without page numbers or with pages that do not support the claim. Detected only by checking against databases (Crossref, Google Scholar).',
    fix: 'Verify every reference in a database; delete or replace any source that cannot be found or does not say what is attributed to it.',
  },
};
