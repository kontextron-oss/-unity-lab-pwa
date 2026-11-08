/**
 * Conservative, fully local document-structure detection for Hörblick.
 * Never discards an OCR word: `originalText` always stays available through
 * the "Alle Angaben" control. No network requests or third-party model.
 */
export type DocumentStructure = {
  kind: 'letter' | 'general';
  contentText: string;
  originalText: string;
  headerText: string;
  subject: string;
};

const ADMINISTRATIVE_MARKER = /\b(?:aktenzeichen|geschäftszeichen|unser\s+zeichen|ihr\s+zeichen|kundennummer|vorgangsnummer|telefon|telefax|postanschrift|e-?mail|betreff|betrifft|referenznummer|datum|bearbeiter(?:in)?)\b/i;
const GREETING = /(?:^|\n)\s*(sehr\s+geehrte(?:r|n|s)?\s+(?:damen\s+und\s+herren|frau\s+[^\n,!?]{2,65}|herrn?\s+[^\n,!?]{2,65})\s*[,!]|guten\s+tag\s*[,!]|liebe(?:r|s)?\s+[^\n,!?]{2,65}\s*[,!])\s*/gim;

export function analyzeDocumentStructure(text: string): DocumentStructure {
  const originalText = String(text || '').replace(/\r\n?/g, '\n').trim();
  const untouched: DocumentStructure = { kind: 'general', contentText: originalText, originalText, headerText: '', subject: '' };
  if (!originalText || originalText.length < 90) return untouched;
  const salutation = GREETING.exec(originalText);
  GREETING.lastIndex = 0;
  if (!salutation) return untouched;
  const start = salutation.index + salutation[0].indexOf(salutation[1]);
  const headerText = originalText.slice(0, start).trim();
  const after = originalText.slice(start).trim();
  const words = after.match(/[\p{L}]{2,}/gu) || [];
  // Deliberately strict: do not hide book titles, posters, invoices or free text.
  if (headerText.length < 30 || words.length < 22 || !ADMINISTRATIVE_MARKER.test(headerText)) return untouched;
  const subjectMatch = headerText.match(/(?:^|\n)\s*(?:betreff|betrifft|gegenstand)\s*:?\s*([^\n]{5,110})/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';
  const contentText = (subject ? `Betreff: ${subject}\n\n` : '') + after;
  if (contentText.length < 80) return untouched;
  return { kind: 'letter', contentText, originalText, headerText, subject };
}
