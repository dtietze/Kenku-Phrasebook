/**
 * src/search/tokenizer.ts
 *
 * Converts raw text into a normalised token list suitable for TF-IDF indexing.
 *
 * Steps:
 *   1. Lower-case
 *   2. Remove punctuation
 *   3. Split on whitespace
 *   4. Remove stop words (common English words that carry no search signal)
 *   5. Apply a very light stemmer (suffix-stripping only — no Porter algorithm
 *      complexity needed at this scale; the goal is to collapse "running"/"ran"
 *      to the same root, not perfection)
 *
 * This module has zero React Native / Expo dependencies and can run in Node
 * test environments without any mocking.
 */

// ---------------------------------------------------------------------------
// Stop words
// ---------------------------------------------------------------------------

/**
 * High-frequency English words excluded from the index.
 * Stored as a Set for O(1) lookup.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor',
  'so', 'yet', 'both', 'either', 'neither', 'as', 'if', 'then', 'than',
  'that', 'this', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'him', 'her', 'them', 'us', 'my', 'your',
  'his', 'their', 'our', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'all', 'each', 'every', 'any', 'some', 'few', 'more',
  'most', 'other', 'such', 'only', 'own', 'same', 'too', 'just',
]);

// ---------------------------------------------------------------------------
// Light suffix-stripping stemmer
// ---------------------------------------------------------------------------

/**
 * Very simple suffix stripper.
 * Handles the most common English inflections without the complexity of
 * Porter / Snowball.  Words shorter than 4 characters are left as-is.
 */
function stem(word: string): string {
  if (word.length < 4) return word;

  // Strip common suffixes, longest first
  if (word.endsWith('ing'))  return word.slice(0, -3);
  if (word.endsWith('tion')) return word.slice(0, -4);
  if (word.endsWith('ness')) return word.slice(0, -4);
  if (word.endsWith('ment')) return word.slice(0, -4);
  if (word.endsWith('ous'))  return word.slice(0, -3);
  if (word.endsWith('ful'))  return word.slice(0, -3);
  if (word.endsWith('ed'))   return word.slice(0, -2);
  if (word.endsWith('er'))   return word.slice(0, -2);
  if (word.endsWith('ly'))   return word.slice(0, -2);
  if (word.endsWith('es'))   return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);

  return word;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Tokenise a string into a normalised list of terms.
 *
 * @param text  Raw input (phrase text, context notes, etc.)
 * @returns     An array of stemmed, lower-cased, de-stopped tokens.
 *              May contain duplicates — use this array to compute TF.
 *
 * @example
 *   tokenize("The dragon roared fiercely!")
 *   // → ["dragon", "roar", "fierc"]
 */
export function tokenize(text: string): string[] {
  if (!text || text.trim() === '') return [];

  return text
    .toLowerCase()
    // Replace punctuation / special chars with spaces (keep apostrophes inside words)
    .replace(/[^\w\s']/g, ' ')
    .replace(/'\s|'\s*$/g, ' ') // trailing apostrophes
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem)
    .filter((word) => word.length > 1); // re-filter after stemming
}

/**
 * Build a unique vocabulary set from a list of token arrays.
 * Useful for debugging and for building the full corpus vocabulary.
 */
export function buildVocabulary(tokenLists: string[][]): Set<string> {
  const vocab = new Set<string>();
  for (const tokens of tokenLists) {
    for (const token of tokens) vocab.add(token);
  }
  return vocab;
}
