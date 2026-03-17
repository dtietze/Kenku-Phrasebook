/**
 * src/search/searchService.ts
 *
 * Orchestrates search across two complementary backends:
 *
 *   1. FTS5 (SQLite full-text search) — fast exact / prefix matching.
 *      Best for short queries, specific words, and "I know what I want" use cases.
 *
 *   2. TF-IDF vector search — ranked by semantic relevance.
 *      Best for "find something about X" exploratory searches.
 *
 * The `search` function merges both result sets:
 *   - FTS5 matches get a base score of 1.0 (they are exact by definition).
 *   - TF-IDF scores are in (0, 1].
 *   - Phrases appearing in both get their scores summed and then normalised,
 *     so they rank higher than either set alone.
 *
 * Filters (tags, emotions) are applied AFTER scoring so they don't affect
 * the ranking of the results that do match.
 */

import * as SQLite from 'expo-sqlite';
import { Phrase, SearchQuery, SearchResult, Emotion } from '../types';
import { tokenize } from './tokenizer';
import { rankDocuments, CandidateDocument } from './tfidf';
import {
  getPhraseIdsContainingTerms,
  getDocumentFrequencies,
  getTermsForPhrases,
  getPhraseCount,
} from '../db/repositories/tfidf_index';
import { getPhrasesByIds, listPhrases } from '../db/repositories/phrases';

// ---------------------------------------------------------------------------
// FTS5 search
// ---------------------------------------------------------------------------

interface FtsRow {
  phrase_id: string;
  rank: number; // Lower (more negative) = better in FTS5
}

/**
 * Run an FTS5 query and return phrase IDs with normalised scores.
 * Returns an empty array if the query is blank or too short.
 */
async function ftsSearch(
  db: SQLite.SQLiteDatabase,
  queryText: string
): Promise<Map<string, number>> {
  const trimmed = queryText.trim();
  if (trimmed.length < 2) return new Map();

  // FTS5 MATCH syntax: append * for prefix matching on the last token
  const ftsQuery = trimmed
    .replace(/"/g, '""') // Escape double-quotes inside the query
    .split(/\s+/)
    .join(' ') + '*';

  try {
    const rows = await db.getAllAsync<FtsRow>(
      `SELECT phrase_id, rank
       FROM phrases_fts
       WHERE phrases_fts MATCH ?
       ORDER BY rank
       LIMIT 100;`,
      [ftsQuery]
    );

    if (rows.length === 0) return new Map();

    // FTS5 rank values are negative; normalise to [0, 1]
    const minRank = Math.min(...rows.map((r) => r.rank));
    const maxRank = Math.max(...rows.map((r) => r.rank));
    const range   = maxRank - minRank || 1;

    const scores = new Map<string, number>();
    for (const row of rows) {
      // Map most negative (best) rank to score of 1, least negative to 0
      scores.set(row.phrase_id, (row.rank - maxRank) / -range);
    }
    return scores;
  } catch {
    // FTS5 syntax errors can be thrown for malformed queries; return empty
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// TF-IDF search
// ---------------------------------------------------------------------------

/**
 * Run a TF-IDF vector search and return phrase IDs with cosine similarity scores.
 */
async function vectorSearch(
  db: SQLite.SQLiteDatabase,
  queryText: string
): Promise<Map<string, number>> {
  const tokens = tokenize(queryText);
  if (tokens.length === 0) return new Map();

  // 1. Find candidate phrase IDs that share ≥1 token with the query
  const candidateIds = await getPhraseIdsContainingTerms(db, tokens);
  if (candidateIds.length === 0) return new Map();

  // 2. Load document frequencies for query terms and corpus size
  const [dfMap, N] = await Promise.all([
    getDocumentFrequencies(db, tokens),
    getPhraseCount(db),
  ]);

  // 3. Load stored TF values for all candidates
  const phraseTermMap = await getTermsForPhrases(db, candidateIds);

  // 4. Build candidate list and rank
  const candidates: CandidateDocument[] = candidateIds
    .filter((id) => phraseTermMap.has(id))
    .map((phraseId) => ({ phraseId, termTf: phraseTermMap.get(phraseId)! }));

  const ranked = rankDocuments(tokens, candidates, N, dfMap);

  const scores = new Map<string, number>();
  for (const result of ranked) {
    scores.set(result.phraseId, result.score);
  }
  return scores;
}

// ---------------------------------------------------------------------------
// Combined search
// ---------------------------------------------------------------------------

/**
 * Perform a combined search and return ranked, filtered results.
 *
 * - In "smart" mode: runs both FTS5 and TF-IDF; merges and ranks combined scores.
 * - In "exact" mode: runs FTS5 only.
 *
 * @param db    Database handle
 * @param query Search query from the UI
 * @returns     Ranked array of SearchResult, most relevant first.
 */
export async function search(
  db: SQLite.SQLiteDatabase,
  query: SearchQuery
): Promise<SearchResult[]> {
  const { text, tagIds, emotions, mode } = query;

  // Empty query with no filters → return all phrases sorted by recency
  if (!text.trim() && tagIds.length === 0 && emotions.length === 0) {
    const all = await listPhrases(db);
    return all.map((phrase) => ({
      phrase,
      score: 1,
      matchType: 'fts',
    }));
  }

  // Run FTS5 and (optionally) TF-IDF in parallel
  const [ftsScores, vectorScores] = await Promise.all([
    text.trim() ? ftsSearch(db, text) : Promise.resolve(new Map<string, number>()),
    text.trim() && mode === 'smart'
      ? vectorSearch(db, text)
      : Promise.resolve(new Map<string, number>()),
  ]);

  // Merge scores: union of phrase IDs from both result sets
  const allIds = new Set([...ftsScores.keys(), ...vectorScores.keys()]);

  if (allIds.size === 0 && !tagIds.length && !emotions.length) {
    return [];
  }

  // Build a combined score for each ID
  interface ScoredId {
    phraseId: string;
    score: number;
    matchType: SearchResult['matchType'];
  }

  const scored: ScoredId[] = [];

  for (const phraseId of allIds) {
    const fts    = ftsScores.get(phraseId) ?? 0;
    const vector = vectorScores.get(phraseId) ?? 0;

    let score: number;
    let matchType: SearchResult['matchType'];

    if (fts > 0 && vector > 0) {
      score     = Math.min(1, fts * 0.6 + vector * 0.4); // Exact match weighted higher
      matchType = 'combined';
    } else if (fts > 0) {
      score     = fts;
      matchType = 'fts';
    } else {
      score     = vector;
      matchType = 'vector';
    }

    scored.push({ phraseId, score, matchType });
  }

  // Sort by descending score
  scored.sort((a, b) => b.score - a.score);

  // Fetch phrase data for all candidates
  const phraseIds = scored.map((s) => s.phraseId);
  const phrasesById = new Map<string, Phrase>();

  // If we have tag/emotion filters, use listPhrases to apply them
  if (tagIds.length > 0 || emotions.length > 0) {
    // Fetch all matching phrases with filters applied, then intersect with scored IDs
    const filtered = await listPhrases(db, {
      tagIds,
      emotions: emotions as Emotion[],
      limit: 500,
    });
    for (const p of filtered) phrasesById.set(p.id, p);
  } else {
    // No filters — just fetch by IDs
    const phrases = await getPhrasesByIds(db, phraseIds);
    for (const p of phrases) phrasesById.set(p.id, p);
  }

  // Build final result list
  const results: SearchResult[] = [];
  for (const { phraseId, score, matchType } of scored) {
    const phrase = phrasesById.get(phraseId);
    if (phrase) {
      results.push({ phrase, score, matchType });
    }
  }

  return results;
}
