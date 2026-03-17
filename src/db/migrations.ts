/**
 * src/db/migrations.ts
 *
 * Forward-only database migration system.
 *
 * How it works:
 *   1. On startup, `runMigrations` reads the highest applied version from the
 *      `schema_migrations` table (created automatically if absent).
 *   2. It then runs every migration whose `version` number is higher than the
 *      stored maximum, in ascending order, each inside its own transaction.
 *   3. On success the version is recorded; on failure the transaction is rolled
 *      back and the error is rethrown so the app can surface it to the user.
 *
 * Adding a new migration:
 *   - Append a new object to the MIGRATIONS array.
 *   - Never modify an existing migration — only add new ones.
 *   - The version number must be exactly 1 greater than the previous entry.
 *
 * Column-rename strategy (SQLite does not support ALTER COLUMN RENAME):
 *   Create a new table, INSERT SELECT from the old, DROP old, RENAME new.
 *   Wrap the entire operation in the migration's transaction.
 */

import * as SQLite from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Migration type
// ---------------------------------------------------------------------------

interface Migration {
  /** Monotonically increasing version number starting at 1. */
  version: number;
  /** Human-readable description for debugging / release notes. */
  description: string;
  /** Called inside a transaction. Throw to roll back. */
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Migration definitions
// ---------------------------------------------------------------------------

const MIGRATIONS: Migration[] = [
  // -------------------------------------------------------------------------
  // Version 1 — Initial schema
  // -------------------------------------------------------------------------
  {
    version: 1,
    description: 'Create initial schema: tags, phrases, phrase_tags, tfidf_terms, phrases_fts',
    up: async (db) => {
      // Tags table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tags (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL UNIQUE,
          color      TEXT NOT NULL DEFAULT '#8B5E3C',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Core phrase log
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS phrases (
          id              TEXT PRIMARY KEY,
          text            TEXT NOT NULL,
          transcription   TEXT,
          emotion         TEXT,
          accent          TEXT,
          speaker_name    TEXT,
          speaker_role    TEXT,
          speaker_notes   TEXT,
          context         TEXT,
          audio_path      TEXT,
          audio_duration  REAL,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Many-to-many phrase ↔ tag join table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS phrase_tags (
          phrase_id  TEXT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
          tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (phrase_id, tag_id)
        );
      `);

      // TF-IDF term index (one row per unique term per phrase)
      // IDF is computed at query time from aggregate counts.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tfidf_terms (
          phrase_id  TEXT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
          term       TEXT NOT NULL,
          tf         REAL NOT NULL,
          PRIMARY KEY (phrase_id, term)
        );
        CREATE INDEX IF NOT EXISTS idx_tfidf_term ON tfidf_terms(term);
      `);

      // FTS5 virtual table for fast full-text search.
      // Declared as a "content table" backed by phrases so we don't duplicate
      // the text, but we must keep it in sync manually (no auto-triggers).
      //
      // FTS5 is a SQLite extension that is compiled into the native SQLite
      // builds on iOS and Android, but is NOT included in the wa-sqlite WASM
      // binary used by expo-sqlite on web.  We attempt to create the table and
      // silently skip if the extension is unavailable; the search service
      // detects the absence and falls back to LIKE-based search on web.
      try {
        await db.execAsync(`
          CREATE VIRTUAL TABLE IF NOT EXISTS phrases_fts USING fts5(
            phrase_id UNINDEXED,
            text,
            context,
            speaker_name,
            content='phrases',
            content_rowid='rowid'
          );
        `);
      } catch (e) {
        console.warn(
          '[DB] FTS5 is not available on this platform (expected on web). ' +
          'Full-text search will use a LIKE fallback.',
          e
        );
      }

      // Useful indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_phrases_created_at ON phrases(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_phrases_emotion     ON phrases(emotion);
        CREATE INDEX IF NOT EXISTS idx_phrase_tags_tag     ON phrase_tags(tag_id);
      `);
    },
  },

  // -------------------------------------------------------------------------
  // Future migrations go here.
  // Example:
  // {
  //   version: 2,
  //   description: 'Add campaign_name column to phrases',
  //   up: async (db) => {
  //     await db.execAsync(`
  //       ALTER TABLE phrases ADD COLUMN campaign_name TEXT;
  //     `);
  //   },
  // },
  // -------------------------------------------------------------------------
];

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

/**
 * Ensures the `schema_migrations` bookkeeping table exists, then runs every
 * migration with a version number higher than the current maximum.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Create the tracking table if this is the very first launch.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Find the highest already-applied version (0 if table is empty).
  const row = await db.getFirstAsync<{ max_version: number }>(
    'SELECT COALESCE(MAX(version), 0) AS max_version FROM schema_migrations;'
  );
  const currentVersion = row?.max_version ?? 0;

  // Find and run pending migrations in order.
  const pending = MIGRATIONS
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    console.log(`[DB] Running migration v${migration.version}: ${migration.description}`);

    // Each migration runs in its own transaction so a failure rolls back
    // only that migration, leaving previously applied ones intact.
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version) VALUES (?);',
        [migration.version]
      );
    });

    console.log(`[DB] Migration v${migration.version} applied.`);
  }
}
