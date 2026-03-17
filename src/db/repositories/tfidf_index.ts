/**
 * src/db/repositories/tfidf_index.ts
 *
 * Persistence layer for the TF-IDF search index.
 *
 * The index stores one row per (phrase, term) pair with the term's TF value.
 * IDF is computed at query time from the total document count and the
 * per-term document frequency (df), both of which are derived from this table.
 *
 * Cascade deletes handle cleanup when a phrase is removed.
 * When a phrase's text is updated, the old terms are deleted and the new
 * terms are written fresh — see replaceTermsForPhrase.
 */

import * as SQLite from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw DB row for a single term entry. */
interface TfidfTermRow {
  phrase_id: string;
  term: string;
  tf: number;
}

/** A term with its corpus-wide document frequency (df). */
export interface TermDf {
  term: string;
  df: number;   // Number of phrases containing this term
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Replace all TF entries for a phrase with a fresh set.
 * Call inside the same transaction as the phrase INSERT / UPDATE.
 *
 * @param db       Database handle
 * @param phraseId Phrase ID
 * @param termTf   Map of term → TF value, as produced by tfidf.computeTf()
 */
export async function replaceTermsForPhrase(
  db: SQLite.SQLiteDatabase,
  phraseId: string,
  termTf: Map<string, number>
): Promise<void> {
  // Remove stale entries first (safe to call even on first insert)
  await db.runAsync(
    'DELETE FROM tfidf_terms WHERE phrase_id = ?;',
    [phraseId]
  );

  // Insert the new TF values
  for (const [term, tf] of termTf.entries()) {
    await db.runAsync(
      'INSERT INTO tfidf_terms (phrase_id, term, tf) VALUES (?, ?, ?);',
      [phraseId, term, tf]
    );
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Return the total number of phrases indexed (used as N for IDF). */
export async function getPhraseCount(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(DISTINCT phrase_id) AS count FROM tfidf_terms;'
  );
  return row?.count ?? 0;
}

/**
 * For each term in `queryTerms`, return how many phrases contain that term (df).
 * Terms not found in the index have df = 0 (not included in results).
 */
export async function getDocumentFrequencies(
  db: SQLite.SQLiteDatabase,
  queryTerms: string[]
): Promise<Map<string, number>> {
  if (queryTerms.length === 0) return new Map();

  const placeholders = queryTerms.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ term: string; df: number }>(
    `SELECT term, COUNT(DISTINCT phrase_id) AS df
     FROM tfidf_terms
     WHERE term IN (${placeholders})
     GROUP BY term;`,
    queryTerms
  );

  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.term, row.df);
  }
  return result;
}

/**
 * For a set of candidate phrases, return all their TF rows so the
 * caller can compute cosine similarity without a second DB round-trip.
 *
 * @param db        Database handle
 * @param phraseIds Candidate phrase IDs (typically those containing ≥1 query term)
 */
export async function getTermsForPhrases(
  db: SQLite.SQLiteDatabase,
  phraseIds: string[]
): Promise<Map<string, Map<string, number>>> {
  // Returns Map<phraseId, Map<term, tf>>
  if (phraseIds.length === 0) return new Map();

  const placeholders = phraseIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<TfidfTermRow>(
    `SELECT phrase_id, term, tf FROM tfidf_terms WHERE phrase_id IN (${placeholders});`,
    phraseIds
  );

  const result = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!result.has(row.phrase_id)) {
      result.set(row.phrase_id, new Map());
    }
    result.get(row.phrase_id)!.set(row.term, row.tf);
  }
  return result;
}

/**
 * Return the IDs of all phrases that contain at least one of the given terms.
 * Used to narrow the candidate set before computing full cosine similarity.
 */
export async function getPhraseIdsContainingTerms(
  db: SQLite.SQLiteDatabase,
  terms: string[]
): Promise<string[]> {
  if (terms.length === 0) return [];

  const placeholders = terms.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ phrase_id: string }>(
    `SELECT DISTINCT phrase_id FROM tfidf_terms WHERE term IN (${placeholders});`,
    terms
  );
  return rows.map((r) => r.phrase_id);
}
