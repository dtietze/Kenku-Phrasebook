/**
 * src/hooks/usePhrases.ts
 *
 * React hook for reading and mutating the phrase list.
 *
 * State management strategy: keep the source of truth in SQLite and
 * maintain a local React state mirror that is refreshed after each write.
 * This avoids the complexity of a global state library while keeping the
 * UI in sync after creates, updates, and deletes.
 *
 * For full-text / vector search, use useSearch instead.
 */

import { useState, useEffect, useCallback } from 'react';
import { Phrase, Emotion } from '../types';
import { useDb } from '../context/DatabaseContext';
import {
  listPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
  deleteAllData,
  CreatePhraseData,
  UpdatePhraseData,
  ListPhrasesOptions,
} from '../db/repositories/phrases';
import { deleteAudioFile } from '../audio/fileManager';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePhrasesOptions {
  tagIds?:    string[];
  emotions?:  Emotion[];
  limit?:     number;
}

interface UsePhrasesResult {
  phrases:  Phrase[];
  isLoading: boolean;
  error:     Error | null;
  refresh:   () => Promise<void>;
  create:    (data: CreatePhraseData) => Promise<Phrase>;
  update:    (id: string, data: UpdatePhraseData) => Promise<Phrase | null>;
  remove:    (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
}

/**
 * Fetch and manage the phrase list, with optional tag/emotion filters.
 *
 * @param options  Optional filters applied to the list query.
 */
export function usePhrases(options: UsePhrasesOptions = {}): UsePhrasesResult {
  const db = useDb();

  const [phrases,   setPhrases]   = useState<Phrase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<Error | null>(null);

  // Stable filter references for the dependency array
  const tagIdsKey   = (options.tagIds   ?? []).slice().sort().join(',');
  const emotionsKey = (options.emotions ?? []).slice().sort().join(',');
  const limit       = options.limit ?? 200;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListPhrasesOptions = {
        tagIds:   options.tagIds   ?? [],
        emotions: options.emotions ?? [],
        limit,
      };
      const data = await listPhrases(db, listOptions);
      setPhrases(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [db, tagIdsKey, emotionsKey, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (data: CreatePhraseData): Promise<Phrase> => {
    const phrase = await createPhrase(db, data);
    await load(); // Refresh the list
    return phrase;
  }, [db, load]);

  const update = useCallback(async (
    id: string,
    data: UpdatePhraseData
  ): Promise<Phrase | null> => {
    const updated = await updatePhrase(db, id, data);
    await load();
    return updated;
  }, [db, load]);

  const remove = useCallback(async (id: string): Promise<void> => {
    const { audioPath } = await deletePhrase(db, id);
    if (audioPath) await deleteAudioFile(audioPath);
    await load();
  }, [db, load]);

  const removeAll = useCallback(async (): Promise<void> => {
    // Read all audio paths before deleting
    const audioPaths = phrases
      .map((p) => p.audioPath)
      .filter((p): p is string => Boolean(p));

    await deleteAllData(db);

    // Clean up audio files
    await Promise.allSettled(audioPaths.map(deleteAudioFile));

    await load();
  }, [db, phrases, load]);

  return {
    phrases,
    isLoading,
    error,
    refresh: load,
    create,
    update,
    remove,
    removeAll,
  };
}
