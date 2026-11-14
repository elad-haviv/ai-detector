/**
 * File forensics: what the uploaded Word/PDF file itself says about how it was made, apart from
 * its wording. Three sources: metadata (which program wrote the file, who, how long it was edited),
 * dates (created / last saved and whether they add up) and the figures embedded in it.
 *
 * Everything here is circumstantial. Metadata is easy to change, and text pasted into Word says the
 * text was written elsewhere, not who wrote it. So the result is a list of findings a reader can
 * check, and a score that only nudges the overall number (see FILE_WEIGHT in heuristics.ts).
 */

/** Findings and the text of each live in the dictionaries under `file.findings`. */
export type FindingId =
  // Word
  | 'generatorLibrary'
  | 'statsMismatch'
  | 'fastTyping'
  | 'singleSession'
  | 'createdEqualsModified'
  | 'longEditing'
  | 'manySessions'
  | 'trackedChanges'
  | 'exported'
  // PDF
  | 'pdfGeneratorLibrary'
  | 'pdfChatPrint'
  | 'pdfLatex'
  // both
  | 'dateInconsistent'
  | 'aiLink'
  // figures
  | 'figureAiCredentials'
  | 'figureAiMetadata'
  | 'figureAiFilename'
  | 'figureGenSize'
  | 'figurePlotLib'
  | 'figureCamera';

export interface FileFinding {
  id: FindingId;
  /** Log-odds-like points: above 0 points to AI, below 0 to human work, 0 is a note that is not counted. */
  weight: number;
  /** Values for the {placeholders} of the finding's text. */
  vars?: Record<string, string | number>;
}

export interface FileMeta {
  /** Word: the application that last saved the file. PDF: the Producer. */
  application?: string;
  /** PDF: the Creator (the program the document was authored in). */
  creator?: string;
  author?: string;
  lastModifiedBy?: string;
  title?: string;
  /** ISO timestamps. */
  created?: string;
  modified?: string;
  /** Word: total editing time in minutes, as Word counts it. */
  editMinutes?: number;
  /** Word: number of saves. */
  revision?: number;
  /** Word: number of editing sessions that left text in the file. */
  sessions?: number;
  /** Words in the file's body text. */
  words?: number;
}

export interface FileForensics {
  kind: 'docx' | 'pdf';
  fileName: string;
  /** 0-100. Exactly 50 = nothing points either way (then it is left out of the overall score). */
  score: number;
  findings: FileFinding[];
  meta: FileMeta;
  /** Figures at least 100px on each side. */
  figures: number;
}
