/**
 * src/db/repositories/tags.ts
 *
 * CRUD operations for the `tags` table.
 * All functions are pure async functions that accept a database handle —
 * this makes them easily testable outside of React.
 */

import * as SQLite from 'expo-sqlite';
import { Tag } from '../../types';
import { generateId } from '../../utils/uuid';

// ---------------------------------------------------------------------------
// Row type (internal — maps to raw DB columns)
// ---------------------------------------------------------------------------

interface TagRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Convert a raw DB row to the domain Tag type. */
function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all tags ordered by name. */
export async function getAllTags(db: SQLite.SQLiteDatabase): Promise<Tag[]> {
  const rows = await db.getAllAsync<TagRow>(
    'SELECT * FROM tags ORDER BY name ASC;'
  );
  return rows.map(rowToTag);
}

/** Return a single tag by ID, or null if not found. */
export async function getTagById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Tag | null> {
  const row = await db.getFirstAsync<TagRow>(
    'SELECT * FROM tags WHERE id = ?;',
    [id]
  );
  return row ? rowToTag(row) : null;
}

/** Return all tags attached to a specific phrase. */
export async function getTagsForPhrase(
  db: SQLite.SQLiteDatabase,
  phraseId: string
): Promise<Tag[]> {
  const rows = await db.getAllAsync<TagRow>(
    `SELECT t.*
     FROM tags t
     JOIN phrase_tags pt ON pt.tag_id = t.id
     WHERE pt.phrase_id = ?
     ORDER BY t.name ASC;`,
    [phraseId]
  );
  return rows.map(rowToTag);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new tag and return it. Throws if the name is already taken. */
export async function createTag(
  db: SQLite.SQLiteDatabase,
  data: { name: string; color: string }
): Promise<Tag> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?);',
    [id, data.name.trim(), data.color, now]
  );

  return { id, name: data.name.trim(), color: data.color, createdAt: now };
}

/** Update a tag's name and/or colour. Returns the updated tag. */
export async function updateTag(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Pick<Tag, 'name' | 'color'>>
): Promise<Tag | null> {
  const existing = await getTagById(db, id);
  if (!existing) return null;

  const name  = data.name  ?? existing.name;
  const color = data.color ?? existing.color;

  await db.runAsync(
    'UPDATE tags SET name = ?, color = ? WHERE id = ?;',
    [name.trim(), color, id]
  );

  return { ...existing, name: name.trim(), color };
}

/** Delete a tag. `phrase_tags` rows are removed via ON DELETE CASCADE. */
export async function deleteTag(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM tags WHERE id = ?;', [id]);
}

// ---------------------------------------------------------------------------
// Phrase–tag association helpers (used by the phrase repository)
// ---------------------------------------------------------------------------

/**
 * Replace the complete tag set for a phrase.
 * Deletes existing associations then inserts the new ones.
 * Call inside the same transaction as the phrase write.
 */
export async function setPhraseTagIds(
  db: SQLite.SQLiteDatabase,
  phraseId: string,
  tagIds: string[]
): Promise<void> {
  await db.runAsync('DELETE FROM phrase_tags WHERE phrase_id = ?;', [phraseId]);

  for (const tagId of tagIds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO phrase_tags (phrase_id, tag_id) VALUES (?, ?);',
      [phraseId, tagId]
    );
  }
}
