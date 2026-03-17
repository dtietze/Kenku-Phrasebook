/**
 * src/hooks/useSearch.ts
 *
 * Debounced search hook that drives both the Search screen and the
 * filter bar on the main Phrasebook screen.
 *
 * Debouncing: waits 300ms after the last keystroke before querying
 * SQLite.  This prevents a query per keypress and keeps the UI smooth.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchQuery, SearchResult, Emotion } from '../types';
import { search } from '../search/searchService';
import { useDb } from '../context/DatabaseContext';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSearchResult {
  query:      SearchQuery;
  results:    SearchResult[];
  isSearching: boolean;
  error:       Error | null;
  setQueryText:   (text: string) => void;
  toggleTag:      (tagId: string) => void;
  toggleEmotion:  (emotion: Emotion) => void;
  setMode:        (mode: 'smart' | 'exact') => void;
  clearFilters:   () => void;
}

const DEFAULT_QUERY: SearchQuery = {
  text:     '',
  tagIds:   [],
  emotions: [],
  mode:     'smart',
};

const DEBOUNCE_MS = 300;

export function useSearch(): UseSearchResult {
  const db = useDb();

  const [query,       setQuery]       = useState<SearchQuery>(DEFAULT_QUERY);
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error,       setError]       = useState<Error | null>(null);

  // Debounce timer ref
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run the search whenever the query changes (debounced)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const res = await search(db, query);
        setResults(res);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, query]);

  const setQueryText = useCallback((text: string) => {
    setQuery((prev) => ({ ...prev, text }));
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setQuery((prev) => {
      const has = prev.tagIds.includes(tagId);
      return {
        ...prev,
        tagIds: has
          ? prev.tagIds.filter((id) => id !== tagId)
          : [...prev.tagIds, tagId],
      };
    });
  }, []);

  const toggleEmotion = useCallback((emotion: Emotion) => {
    setQuery((prev) => {
      const has = prev.emotions.includes(emotion);
      return {
        ...prev,
        emotions: has
          ? prev.emotions.filter((e) => e !== emotion)
          : [...prev.emotions, emotion],
      };
    });
  }, []);

  const setMode = useCallback((mode: 'smart' | 'exact') => {
    setQuery((prev) => ({ ...prev, mode }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_QUERY);
  }, []);

  return {
    query,
    results,
    isSearching,
    error,
    setQueryText,
    toggleTag,
    toggleEmotion,
    setMode,
    clearFilters,
  };
}
