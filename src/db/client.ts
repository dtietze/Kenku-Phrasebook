/**
 * src/db/client.ts
 *
 * Opens the single SQLite database instance used by the whole app.
 * The handle is initialised once (in DatabaseContext) and then distributed
 * via React context.  All repository functions accept a `db` parameter
 * rather than importing a global, which makes them easy to test in isolation.
 *
 * Expo SQLite v15 uses an async API and OPFS on web.
 * WAL mode is enabled by default — do not call PRAGMA journal_mode=WAL again
 * or you will get a "cannot change journal mode" error after the first launch.
 */

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

/** The database filename. Change this requires a data migration. */
const DB_NAME = 'kenku-phrasebook.db';

/**
 * Opens (or creates) the database and runs all pending schema migrations.
 * Call this exactly once during app startup (see DatabaseContext.tsx).
 *
 * @returns The ready-to-use SQLiteDatabase handle.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable foreign-key enforcement for every connection.
  // SQLite disables foreign keys by default for backwards compatibility.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run any pending schema migrations before the app renders.
  await runMigrations(db);

  return db;
}
