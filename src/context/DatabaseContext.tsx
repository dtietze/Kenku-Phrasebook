/**
 * src/context/DatabaseContext.tsx
 *
 * Provides the single SQLiteDatabase handle to the entire React tree.
 *
 * The database is opened and all pending migrations are run during the
 * app's splash screen window (before the first render).  Components that
 * need the database access it via the `useDb` hook.
 *
 * If the database fails to open, an error screen is shown instead of
 * crashing silently.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SQLite from 'expo-sqlite';
import { openDatabase } from '../db/client';
import { ensureAudioDirectory } from '../audio/fileManager';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface DatabaseContextValue {
  /** The open database handle.  Null while still initialising. */
  db: SQLite.SQLiteDatabase | null;
  /** True once the database is ready for queries. */
  isReady: boolean;
  /** Any error that occurred during initialisation. */
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db:      null,
  isReady: false,
  error:   null,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
  /** Called once the database is ready (allows hiding the splash screen). */
  onReady?: () => void;
}

export function DatabaseProvider({ children, onReady }: Props): React.JSX.Element {
  const [db,      setDb]      = useState<SQLite.SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error,   setError]   = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const database = await openDatabase();
        await ensureAudioDirectory();

        if (!cancelled) {
          setDb(database);
          setIsReady(true);
          onReady?.();
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[DatabaseProvider] Failed to open database:', e);
          setError(e instanceof Error ? e : new Error(String(e)));
          onReady?.(); // Still call onReady so the splash screen hides
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);  // Run once on mount

  return (
    <DatabaseContext.Provider value={{ db, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the database handle inside any component under DatabaseProvider.
 * Throws if called outside the provider or if the database is not yet ready.
 *
 * @example
 *   const db = useDb();
 *   const tags = await getAllTags(db);
 */
export function useDb(): SQLite.SQLiteDatabase {
  const { db, isReady, error } = useContext(DatabaseContext);

  if (error) throw error; // Propagates to the nearest error boundary
  if (!isReady || !db) throw new Error('Database is not yet ready.');

  return db;
}

/** Access the full context value (useful for checking isReady state). */
export function useDatabaseContext(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
