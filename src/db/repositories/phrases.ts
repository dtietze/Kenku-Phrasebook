/**
 * src/db/repositories/phrases.ts
 *
 * CRUD operations for the `phrases` table, including FTS5 and TF-IDF
 * index maintenance.
 *
 * Every write (create / update / delete) is wrapped in a transaction that
 * also updates `phrases_fts` (full-text search) and `tfidf_terms` so all
 * three data stores stay in sync atomically.
 */

import * as SQLite from 'expo-sqlite';
import { Phrase, Emotion } from '../../types';
import { generateId } from '../../utils/uuid';
import { getTagsForPhrase, setPhraseTagIds } from './tags';
import { replaceTermsForPhrase } from './tfidf_index';
import { computeTf } from '../../search/tfidf';
import { tokenize } from '../../search/tokenizer';

// ---------------------------------------------------------------------------
// Row type (internal)
// ---------------------------------------------------------------------------

interface PhraseRow {
  id: string;
  text: string;
  transcription: string | null;
  emotion: string | null;
  accent: string | null;
  speaker_name: string | null;
  speaker_role: string | null;
  speaker_notes: string | null;
  context: string | null;
  audio_path: string | null;
  audio_duration: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Convert a raw phrase row to the domain type.
 * Tags are NOT populated here — use `attachTags` afterwards if needed.
 */
function rowToPhrase(row: PhraseRow): Omit<Phrase, 'tags'> {
  return {
    id:            row.id,
    text:          row.text,
    transcription: row.transcription ?? undefined,
    emotion:       (row.emotion as Emotion) ?? undefined,
    accent:        row.accent ?? undefined,
    speakerName:   row.speaker_name ?? undefined,
    speakerRole:   row.speaker_role ?? undefined,
    speakerNotes:  row.speaker_notes ?? undefined,
    context:       row.context ?? undefined,
    audioPath:     row.audio_path ?? undefined,
    audioDuration: row.audio_duration ?? undefined,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

/** Attach tags to a set of phrase stubs in one batch query. */
async function attachTagsBatch(
  db: SQLite.SQLiteDatabase,
  phrases: Omit<Phrase, 'tags'>[]
): Promise<Phrase[]> {
  if (phrases.length === 0) return [];

  const ids = phrases.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(', ');

  interface JoinRow {
    phrase_id: string;
    id: string;
    name: string;
    color: string;
    created_at: string;
  }

  const joinRows = await db.getAllAsync<JoinRow>(
    `SELECT pt.phrase_id, t.id, t.name, t.color, t.created_at
     FROM phrase_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.phrase_id IN (${placeholders})
     ORDER BY t.name ASC;`,
    ids
  );

  // Group tags by phrase_id
  const tagMap = new Map<string, Array<{ id: string; name: string; color: string; createdAt: string }>>();
  for (const row of joinRows) {
    if (!tagMap.has(row.phrase_id)) tagMap.set(row.phrase_id, []);
    tagMap.get(row.phrase_id)!.push({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    });
  }

  return phrases.map((p) => ({ ...p, tags: tagMap.get(p.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Options for listing phrases. */
export interface ListPhrasesOptions {
  /** Filter to only phrases that have ALL of these tag IDs. */
  tagIds?: string[];
  /** Filter to only phrases with one of these emotions. */
  emotions?: Emotion[];
  /** Return at most this many results. */
  limit?: number;
  /** Skip this many results (for pagination). */
  offset?: number;
}

/** Return all phrases (most recent first), with optional filtering. */
export async function listPhrases(
  db: SQLite.SQLiteDatabase,
  options: ListPhrasesOptions = {}
): Promise<Phrase[]> {
  const { tagIds = [], emotions = [], limit = 200, offset = 0 } = options;

  let query = 'SELECT p.* FROM phrases p';
  const params: (string | number)[] = [];

  // Join phrase_tags for each required tag (intersection via multiple JOINs)
  tagIds.forEach((tagId, i) => {
    query += ` JOIN phrase_tags pt${i} ON pt${i}.phrase_id = p.id AND pt${i}.tag_id = ?`;
    params.push(tagId);
  });

  const conditions: string[] = [];

  if (emotions.length > 0) {
    const emotionPlaceholders = emotions.map(() => '?').join(', ');
    conditions.push(`p.emotion IN (${emotionPlaceholders})`);
    params.push(...emotions);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?;';
  params.push(limit, offset);

  const rows = await db.getAllAsync<PhraseRow>(query, params);
  const stubs = rows.map(rowToPhrase);
  return attachTagsBatch(db, stubs);
}

/** Return a single phrase by ID, or null. */
export async function getPhraseById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Phrase | null> {
  const row = await db.getFirstAsync<PhraseRow>(
    'SELECT * FROM phrases WHERE id = ?;',
    [id]
  );
  if (!row) return null;
  const [phrase] = await attachTagsBatch(db, [rowToPhrase(row)]);
  return phrase;
}

/** Return a set of phrases by their IDs (preserves input order). */
export async function getPhrasesByIds(
  db: SQLite.SQLiteDatabase,
  ids: string[]
): Promise<Phrase[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.getAllAsync<PhraseRow>(
    `SELECT * FROM phrases WHERE id IN (${placeholders});`,
    ids
  );
  const stubs = rows.map(rowToPhrase);
  const phrases = await attachTagsBatch(db, stubs);

  // Restore caller's order
  const byId = new Map(phrases.map((p) => [p.id, p]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

// ---------------------------------------------------------------------------
// Write helpers (run inside the caller's transaction)
// ---------------------------------------------------------------------------

/** The text used to build the TF-IDF index and FTS5 index for a phrase. */
function buildIndexText(data: {
  text: string;
  context?: string;
  speakerName?: string;
}): string {
  return [data.text, data.context, data.speakerName]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreatePhraseData {
  text: string;
  transcription?: string;
  emotion?: Emotion;
  accent?: string;
  speakerName?: string;
  speakerRole?: string;
  speakerNotes?: string;
  context?: string;
  audioPath?: string;
  audioDuration?: number;
  tagIds?: string[];
}

/** Insert a new phrase and update both search indexes. */
export async function createPhrase(
  db: SQLite.SQLiteDatabase,
  data: CreatePhraseData
): Promise<Phrase> {
  const id  = generateId();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Insert the phrase row
    await db.runAsync(
      `INSERT INTO phrases
         (id, text, transcription, emotion, accent,
          speaker_name, speaker_role, speaker_notes,
          context, audio_path, audio_duration, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.text,
        data.transcription ?? null,
        data.emotion       ?? null,
        data.accent        ?? null,
        data.speakerName   ?? null,
        data.speakerRole   ?? null,
        data.speakerNotes  ?? null,
        data.context       ?? null,
        data.audioPath     ?? null,
        data.audioDuration ?? null,
        now,
        now,
      ]
    );

    // 2. Update FTS5 (must mirror the phrase row's rowid)
    const inserted = await db.getFirstAsync<{ rowid: number }>(
      'SELECT rowid FROM phrases WHERE id = ?;',
      [id]
    );
    if (inserted) {
      await db.runAsync(
        `INSERT INTO phrases_fts(rowid, phrase_id, text, context, speaker_name)
         VALUES (?, ?, ?, ?, ?);`,
        [
          inserted.rowid,
          id,
          data.text,
          data.context     ?? '',
          data.speakerName ?? '',
        ]
      );
    }

    // 3. Update TF-IDF index
    const indexText = buildIndexText(data);
    const tokens = tokenize(indexText);
    const tfMap  = computeTf(tokens);
    await replaceTermsForPhrase(db, id, tfMap);

    // 4. Set tag associations
    if (data.tagIds && data.tagIds.length > 0) {
      await setPhraseTagIds(db, id, data.tagIds);
    }
  });

  const phrase = await getPhraseById(db, id);
  return phrase!;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdatePhraseData = Partial<CreatePhraseData>;

/** Update an existing phrase and refresh both search indexes. */
export async function updatePhrase(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: UpdatePhraseData
): Promise<Phrase | null> {
  const existing = await getPhraseById(db, id);
  if (!existing) return null;

  const now = new Date().toISOString();

  // Merge with existing values
  const merged = {
    text:          data.text          ?? existing.text,
    transcription: data.transcription ?? existing.transcription,
    emotion:       data.emotion       ?? existing.emotion,
    accent:        data.accent        ?? existing.accent,
    speakerName:   data.speakerName   ?? existing.speakerName,
    speakerRole:   data.speakerRole   ?? existing.speakerRole,
    speakerNotes:  data.speakerNotes  ?? existing.speakerNotes,
    context:       data.context       ?? existing.context,
    audioPath:     data.audioPath     ?? existing.audioPath,
    audioDuration: data.audioDuration ?? existing.audioDuration,
    tagIds:        data.tagIds        ?? existing.tags.map((t) => t.id),
  };

  await db.withTransactionAsync(async () => {
    // 1. Update phrase row
    await db.runAsync(
      `UPDATE phrases SET
         text = ?, transcription = ?, emotion = ?, accent = ?,
         speaker_name = ?, speaker_role = ?, speaker_notes = ?,
         context = ?, audio_path = ?, audio_duration = ?, updated_at = ?
       WHERE id = ?;`,
      [
        merged.text,
        merged.transcription  ?? null,
        merged.emotion        ?? null,
        merged.accent         ?? null,
        merged.speakerName    ?? null,
        merged.speakerRole    ?? null,
        merged.speakerNotes   ?? null,
        merged.context        ?? null,
        merged.audioPath      ?? null,
        merged.audioDuration  ?? null,
        now,
        id,
      ]
    );

    // 2. Update FTS5 (delete old, insert new — FTS5 "content table" workaround)
    const rowRecord = await db.getFirstAsync<{ rowid: number }>(
      'SELECT rowid FROM phrases WHERE id = ?;',
      [id]
    );
    if (rowRecord) {
      await db.runAsync(
        `DELETE FROM phrases_fts WHERE phrase_id = ?;`,
        [id]
      );
      await db.runAsync(
        `INSERT INTO phrases_fts(rowid, phrase_id, text, context, speaker_name)
         VALUES (?, ?, ?, ?, ?);`,
        [
          rowRecord.rowid,
          id,
          merged.text,
          merged.context     ?? '',
          merged.speakerName ?? '',
        ]
      );
    }

    // 3. Refresh TF-IDF index
    const indexText = buildIndexText(merged);
    const tokens = tokenize(indexText);
    const tfMap  = computeTf(tokens);
    await replaceTermsForPhrase(db, id, tfMap);

    // 4. Replace tag associations
    await setPhraseTagIds(db, id, merged.tagIds);
  });

  return getPhraseById(db, id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Delete a phrase and its search index entries. Returns the deleted audio path (if any). */
export async function deletePhrase(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<{ audioPath: string | null }> {
  // Read audio path before deleting
  const row = await db.getFirstAsync<{ audio_path: string | null }>(
    'SELECT audio_path FROM phrases WHERE id = ?;',
    [id]
  );
  const audioPath = row?.audio_path ?? null;

  await db.withTransactionAsync(async () => {
    // FTS5: content table requires manual delete
    await db.runAsync('DELETE FROM phrases_fts WHERE phrase_id = ?;', [id]);
    // tfidf_terms: cascade handles this, but being explicit is clearer
    await db.runAsync('DELETE FROM tfidf_terms WHERE phrase_id = ?;', [id]);
    // phrase_tags: cascade handles this
    await db.runAsync('DELETE FROM phrases WHERE id = ?;', [id]);
  });

  return { audioPath };
}

// ---------------------------------------------------------------------------
// Bulk delete (for "delete all data")
// ---------------------------------------------------------------------------

/** Delete every phrase, tag, and index entry. Resets the app to a clean slate. */
export async function deleteAllData(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM phrases_fts;
      DELETE FROM tfidf_terms;
      DELETE FROM phrase_tags;
      DELETE FROM phrases;
      DELETE FROM tags;
    `);
  });
}
