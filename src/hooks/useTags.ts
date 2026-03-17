/**
 * src/hooks/useTags.ts
 *
 * React hook for reading and managing tags.
 */

import { useState, useEffect, useCallback } from 'react';
import { Tag } from '../types';
import { useDb } from '../context/DatabaseContext';
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
} from '../db/repositories/tags';
import { Colors } from '../constants/theme';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseTagsResult {
  tags:       Tag[];
  isLoading:  boolean;
  error:      Error | null;
  refresh:    () => Promise<void>;
  create:     (name: string, color?: string) => Promise<Tag>;
  update:     (id: string, data: Partial<Pick<Tag, 'name' | 'color'>>) => Promise<Tag | null>;
  remove:     (id: string) => Promise<void>;
  nextColor:  () => string; // Suggest the next colour from the palette
}

export function useTags(): UseTagsResult {
  const db = useDb();

  const [tags,      setTags]      = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTags(await getAllTags(db));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  /** Suggest the next palette colour, cycling through the preset list. */
  const nextColor = useCallback((): string => {
    const palette = Colors.tagPalette;
    return palette[tags.length % palette.length];
  }, [tags.length]);

  const create = useCallback(async (name: string, color?: string): Promise<Tag> => {
    const tag = await createTag(db, { name, color: color ?? nextColor() });
    await load();
    return tag;
  }, [db, load, nextColor]);

  const update = useCallback(async (
    id: string,
    data: Partial<Pick<Tag, 'name' | 'color'>>
  ): Promise<Tag | null> => {
    const tag = await updateTag(db, id, data);
    await load();
    return tag;
  }, [db, load]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteTag(db, id);
    await load();
  }, [db, load]);

  return { tags, isLoading, error, refresh: load, create, update, remove, nextColor };
}
