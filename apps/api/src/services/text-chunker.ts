// Text normalization and chunking utilities for document ingestion.

export interface TextChunk {
  content: string;
  tokenEstimate: number;
}

export function normalizeText(input: string): string {
  return input.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkText(input: string, maxChars = 1600, overlapChars = 180): TextChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1 || !Number.isInteger(overlapChars) || overlapChars < 0 || overlapChars >= maxChars) {
    throw new RangeError("Chunk size must be positive and overlap must be smaller than the chunk size.");
  }
  const normalized = normalizeText(input);

  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + maxChars, normalized.length);
    const window = normalized.slice(start, end);
    const lastBreak = window.lastIndexOf("\n\n");
    const cutPoint = lastBreak > maxChars * 0.5 ? start + lastBreak : end;
    const content = normalized.slice(start, cutPoint).trim();

    if (content) {
      chunks.push({
        content,
        tokenEstimate: Math.ceil(content.length / 4)
      });
    }

    start = Math.max(start + 1, cutPoint - overlapChars);
    if (cutPoint >= normalized.length) {
      break;
    }
  }

  return chunks;
}
