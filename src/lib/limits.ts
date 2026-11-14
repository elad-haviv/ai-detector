/**
 * Size limits shared by the input form and the API routes.
 * The client enforces them for a friendly error; the server enforces them again
 * so a direct request cannot push oversized text through a paid model.
 */

/** Longest document accepted for one analysis. */
export const MAX_DOC_WORDS = 40000;

/**
 * Longest text in one /api/analyze request. The client sends chunks of up to 900 words,
 * but a single very long sentence goes alone, so leave headroom.
 */
export const MAX_CHUNK_WORDS = 3000;

/** Most sentences in one /api/analyze request (the client sends at most 30). */
export const MAX_CHUNK_SENTENCES = 60;

/** Longest free-text context the user can attach. */
export const MAX_CONTEXT_CHARS = 4000;

/** Largest JSON body any API route will parse (40,000 Hebrew words plus JSON overhead fit well under this). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
