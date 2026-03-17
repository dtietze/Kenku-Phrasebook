/**
 * src/search/tfidf.ts
 *
 * Pure-TypeScript TF-IDF (Term Frequency – Inverse Document Frequency) engine.
 *
 * This module is intentionally free of all React Native / Expo / SQLite
 * dependencies so it can be tested with plain Jest in a Node environment.
 *
 * Concepts:
 *   TF  (Term Frequency)          = count(term, doc) / count(all terms, doc)
 *   IDF (Inverse Doc Frequency)   = log((N + 1) / (df(term) + 1)) + 1
 *                                   (smoothed to avoid division-by-zero)
 *   TF-IDF                        = TF × IDF
 *   Cosine similarity             = dot(A, B) / (|A| × |B|)
 *
 * Usage flow:
 *   1. On write: call computeTf(tokens) → store in tfidf_terms table via the repo.
 *   2. On search: call rankDocuments(queryTokens, candidateDocs, N, dfMap).
 *
 * The separation of concerns is intentional:
 *   - This file does pure maths (no I/O).
 *   - src/search/searchService.ts handles database I/O and orchestration.
 */

// ---------------------------------------------------------------------------
// TF computation
// ---------------------------------------------------------------------------

/**
 * Compute the Term Frequency map for a list of tokens.
 *
 * TF(term) = count(term in tokens) / total tokens
 *
 * Returns a Map<term, TF> where TF ∈ (0, 1].
 * An empty token list returns an empty map.
 */
export function computeTf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const total = tokens.length;
  if (total === 0) return new Map();

  const tf = new Map<string, number>();
  for (const [term, count] of counts.entries()) {
    tf.set(term, count / total);
  }
  return tf;
}

// ---------------------------------------------------------------------------
// IDF computation
// ---------------------------------------------------------------------------

/**
 * Compute the Inverse Document Frequency for a single term.
 *
 * Uses the "smoothed" IDF formula to avoid log(0) when a term appears in
 * every document, and to give non-zero weight to new terms:
 *
 *   IDF(term) = log((N + 1) / (df + 1)) + 1
 *
 * @param N  Total number of documents in the corpus
 * @param df Number of documents containing the term
 */
export function computeIdf(N: number, df: number): number {
  if (N === 0) return 1;
  return Math.log((N + 1) / (df + 1)) + 1;
}

// ---------------------------------------------------------------------------
// TF-IDF vector computation
// ---------------------------------------------------------------------------

/**
 * Compute a TF-IDF weight map for a set of terms.
 *
 * @param tfMap  Map<term, TF> from computeTf
 * @param N      Total documents in the corpus
 * @param dfMap  Map<term, df> — document frequency for each term in tfMap
 * @returns      Map<term, TF-IDF weight>
 */
export function computeTfidfWeights(
  tfMap: Map<string, number>,
  N: number,
  dfMap: Map<string, number>
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [term, tf] of tfMap.entries()) {
    const df  = dfMap.get(term) ?? 0;
    const idf = computeIdf(N, df);
    weights.set(term, tf * idf);
  }
  return weights;
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Compute the cosine similarity between two sparse TF-IDF weight vectors.
 * Returns a value in [0, 1]; 1 means identical direction, 0 means orthogonal.
 *
 * Sparse vectors are represented as Map<term, weight>.
 * Only terms present in either map contribute to the calculation.
 */
export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  if (vecA.size === 0 || vecB.size === 0) return 0;

  // Dot product: sum of (A[term] × B[term]) for each shared term
  let dot = 0;
  for (const [term, weightA] of vecA.entries()) {
    const weightB = vecB.get(term) ?? 0;
    dot += weightA * weightB;
  }

  // Magnitudes
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/** Euclidean magnitude of a sparse weight vector. */
function magnitude(vec: Map<string, number>): number {
  let sumOfSquares = 0;
  for (const weight of vec.values()) {
    sumOfSquares += weight * weight;
  }
  return Math.sqrt(sumOfSquares);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/** Input for ranking: a candidate document's stored TF values. */
export interface CandidateDocument {
  phraseId: string;
  /** Map<term, TF> as stored in the DB. */
  termTf: Map<string, number>;
}

/** A ranked result with its cosine similarity score. */
export interface RankedResult {
  phraseId: string;
  score: number; // Cosine similarity ∈ [0, 1]
}

/**
 * Rank a set of candidate documents against a query, returning results sorted
 * by descending cosine similarity.
 *
 * @param queryTokens    Tokenised query (from tokenize())
 * @param candidates     Candidate documents with their stored TF maps
 * @param N              Total document count in the corpus
 * @param dfMap          Map<term, df> for all query terms (from the DB)
 * @param minScore       Minimum cosine similarity to include (default 0.01)
 */
export function rankDocuments(
  queryTokens: string[],
  candidates: CandidateDocument[],
  N: number,
  dfMap: Map<string, number>,
  minScore = 0.01
): RankedResult[] {
  if (queryTokens.length === 0 || candidates.length === 0) return [];

  // Build the query TF-IDF vector
  const queryTf      = computeTf(queryTokens);
  const queryTfidf   = computeTfidfWeights(queryTf, N, dfMap);

  // Score each candidate
  const results: RankedResult[] = [];

  for (const candidate of candidates) {
    const docTfidf = computeTfidfWeights(candidate.termTf, N, dfMap);
    const score    = cosineSimilarity(queryTfidf, docTfidf);

    if (score >= minScore) {
      results.push({ phraseId: candidate.phraseId, score });
    }
  }

  // Sort by score descending, then alphabetically by ID for stable ordering
  results.sort((a, b) =>
    b.score - a.score || a.phraseId.localeCompare(b.phraseId)
  );

  return results;
}
