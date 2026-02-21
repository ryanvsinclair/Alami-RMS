// ============================================================
// Fuzzy string matching utilities
// Uses trigram similarity (same algo as pg_trgm)
// ============================================================

/**
 * Generate trigrams from a string.
 * "chicken" → ["  c", " ch", "chi", "hic", "ick", "cke", "ken", "en "]
 */
function trigrams(s: string): Set<string> {
  const padded = `  ${s.toLowerCase().trim()} `;
  const result = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/**
 * Trigram similarity between two strings (0..1).
 * Mirrors PostgreSQL's similarity() function.
 */
export function similarity(a: string, b: string): number {
  const triA = trigrams(a);
  const triB = trigrams(b);
  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }
  const union = triA.size + triB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalize text for comparison:
 * - lowercase
 * - collapse whitespace
 * - remove common noise words
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if one string contains all significant words of another.
 * Useful for abbreviated receipt text matching.
 */
export function wordOverlap(query: string, target: string): number {
  const qWords = normalizeText(query).split(" ").filter((w) => w.length > 1);
  const tWords = new Set(
    normalizeText(target).split(" ").filter((w) => w.length > 1)
  );

  if (qWords.length === 0) return 0;

  let matches = 0;
  for (const w of qWords) {
    for (const tw of tWords) {
      if (tw.includes(w) || w.includes(tw)) {
        matches++;
        break;
      }
    }
  }
  return matches / Math.max(qWords.length, tWords.size);
}
