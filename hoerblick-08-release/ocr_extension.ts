// Combines the reliable large-print detection of Paddle with the more reliable
// German prose/footer transcription of Tesseract. No extra OCR request is needed.
// Only align candidates if they share an unmistakable sequence of four words.
function indexedRecognitionWords(text: string): { token: string; start: number }[] {
  const result: { token: string; start: number }[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  for (const match of text.matchAll(re)) {
    result.push({ token: match[0].toLocaleLowerCase('de-DE'), start: match.index });
  }
  return result;
}

export function mergeRecognitionCandidates(candidates: RecognitionCandidate[]): string {
  const fallback = selectBestRecognitionText(candidates);
  const paddle = candidates.find((candidate) => candidate.source === 'paddle' && candidate.text.trim());
  if (!paddle) return fallback;
  const primary = normalizePaddleText(paddle.text);
  const primaryTokens = indexedRecognitionWords(primary);
  if (primaryTokens.length < 9) return fallback;
  let bestMerged = '';
  let bestImprovement = 0;
  const phraseLength = 4;

  for (const secondary of candidates.filter((candidate) =>
    candidate.source === 'tesseract' || candidate.source === 'combined')) {
    const alternate = normalizePaddleText(secondary.text);
    const otherTokens = indexedRecognitionWords(alternate);
    if (otherTokens.length < 9) continue;
    const anchors = new Map<string, number[]>();
    for (let j = 0; j + phraseLength <= otherTokens.length; j++) {
      const key = otherTokens.slice(j, j + phraseLength).map((word) => word.token).join(' ');
      const positions = anchors.get(key) ?? [];
      positions.push(j);
      anchors.set(key, positions);
    }
    for (let i = 2; i + phraseLength <= primaryTokens.length; i++) {
      const key = primaryTokens.slice(i, i + phraseLength).map((word) => word.token).join(' ');
      for (const j of anchors.get(key) ?? []) {
        const primarySuffixCount = primaryTokens.length - i;
        const alternateSuffixCount = otherTokens.length - j;
        if (primarySuffixCount < 6 || alternateSuffixCount < 6) continue;
        // Never discard much of the recognized document just because a partial
        // OCR pass is cleaner. Preserve the poster/title from the first pass.
        if (alternateSuffixCount < primarySuffixCount * 0.92) continue;
        let exact = phraseLength;
        while (i + exact < primaryTokens.length && j + exact < otherTokens.length &&
               primaryTokens[i + exact].token === otherTokens[j + exact].token) exact++;
        const sourcePrefix = primary.slice(0, primaryTokens[i].start).trim();
        const alternateSuffix = alternate.slice(otherTokens[j].start).trim();
        if (!sourcePrefix || !alternateSuffix) continue;
        const primaryTail = primary.slice(primaryTokens[i].start).trim();
        if (alternateSuffix === primaryTail) continue;
        // Prefer long overlaps and suffixes with additional retained words.
        // The alternate full-page OCR already ran in the standard pipeline.
        const improvement = exact * 10 +
          (alternateSuffixCount - primarySuffixCount) * 3 +
          Math.min(15, indexedRecognitionWords(sourcePrefix).length);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestMerged = normalizePaddleText(sourcePrefix + '\n' + alternateSuffix);
        }
      }
    }
  }
  return bestMerged || fallback;
}
