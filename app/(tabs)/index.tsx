/**
 * app/(tabs)/index.tsx — Phrasebook Screen
 *
 * The main list of all captured phrases.
 * Features:
 *   - Search bar (toggles between FTS5 "exact" and TF-IDF "smart" mode)
 *   - Horizontal tag filter chips
 *   - Vertical phrase card list
 *   - FAB (floating action button) to navigate to the Capture tab
 *   - Pull-to-refresh
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePhrases } from '../../src/hooks/usePhrases';
import { useTags } from '../../src/hooks/useTags';
import { useSearch } from '../../src/hooks/useSearch';
import { PhraseCard } from '../../src/components/phrase/PhraseCard';
import { TagChip } from '../../src/components/ui/TagChip';
import { Colors, Typography, Spacing, Radius } from '../../src/constants/theme';
import { Phrase, SearchResult } from '../../src/types';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PhrasebookScreen(): React.JSX.Element {
  const { phrases, isLoading, refresh, remove } = usePhrases();
  const { tags } = useTags();
  const {
    query,
    results,
    isSearching,
    setQueryText,
    toggleTag,
    setMode,
    clearFilters,
  } = useSearch();

  const [isSearchMode, setIsSearchMode] = useState(false);

  // Decide which data to show: search results or the plain list
  const isActiveSearch = isSearchMode && (query.text.trim().length > 0 || query.tagIds.length > 0);
  const displayPhrases: { phrase: Phrase; score?: number }[] = isActiveSearch
    ? results.map((r: SearchResult) => ({ phrase: r.phrase, score: r.score }))
    : phrases.map((p) => ({ phrase: p }));

  const handleDeletePhrase = useCallback((id: string) => {
    Alert.alert('Delete phrase?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove(id),
      },
    ]);
  }, [remove]);

  const renderItem = useCallback(({ item }: { item: { phrase: Phrase; score?: number } }) => (
    <PhraseCard
      phrase={item.phrase}
      searchScore={item.score}
      onPress={() => router.push(`/phrase/${item.phrase.id}` as any)}
      onLongPress={() => handleDeletePhrase(item.phrase.id)}
    />
  ), [handleDeletePhrase]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>
        {isActiveSearch ? 'No phrases match your search' : 'No phrases yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isActiveSearch
          ? 'Try different words or clear the filters'
          : 'Tap the Capture tab to record your first phrase'}
      </Text>
    </View>
  ), [isActiveSearch]);

  return (
    <View style={styles.container}>
      {/* === Search bar === */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query.text}
            onChangeText={(text) => {
              setQueryText(text);
              setIsSearchMode(text.length > 0);
            }}
            placeholder="Search phrases…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        {/* Smart / Exact mode toggle */}
        <Pressable
          onPress={() => setMode(query.mode === 'smart' ? 'exact' : 'smart')}
          style={[styles.modeToggle, query.mode === 'smart' && styles.modeToggleActive]}
          accessibilityLabel={`Search mode: ${query.mode}`}
        >
          <Ionicons
            name={query.mode === 'smart' ? 'sparkles' : 'text'}
            size={18}
            color={query.mode === 'smart' ? Colors.gold : Colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* === Tag filter chips === */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagScroll}
          contentContainerStyle={styles.tagScrollContent}
        >
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              selected={query.tagIds.includes(tag.id)}
              onPress={() => {
                toggleTag(tag.id);
                setIsSearchMode(true);
              }}
              style={styles.filterChip}
            />
          ))}
          {query.tagIds.length > 0 && (
            <Pressable onPress={clearFilters} style={styles.clearChip}>
              <Text style={styles.clearChipText}>Clear ×</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* === Phrase list === */}
      <FlatList
        data={displayPhrases}
        keyExtractor={(item) => item.phrase.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isSearching}
            onRefresh={refresh}
            tintColor={Colors.gold}
            colors={[Colors.gold]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          displayPhrases.length === 0 && styles.listContentEmpty,
        ]}
      />

      {/* === FAB === */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/phrase/new' as any)}
        accessibilityLabel="Add new phrase"
      >
        <Ionicons name="add" size={28} color={Colors.textInverse} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background } as ViewStyle,

  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  } as ViewStyle,
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  } as ViewStyle,
  searchIcon: { marginRight: Spacing.xs } as ViewStyle,
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
    paddingVertical: Spacing.sm - 2,
  } as TextStyle,
  modeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  modeToggleActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldBg,
  } as ViewStyle,

  // Tag filter
  tagScroll: { maxHeight: 44 } as ViewStyle,
  tagScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  filterChip: { marginRight: 0 } as ViewStyle,
  clearChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  } as ViewStyle,
  clearChipText: {
    color: Colors.textMuted,
    fontSize: Typography.size.xs,
  } as TextStyle,

  // List
  listContent: { paddingBottom: Spacing.xxl + 20 } as ViewStyle,
  listContentEmpty: { flex: 1 } as ViewStyle,

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  } as ViewStyle,
  emptyTitle: {
    fontSize: Typography.size.lg,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
    marginTop: Spacing.md,
    textAlign: 'center',
  } as TextStyle,
  emptySubtitle: {
    fontSize: Typography.size.base,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: Typography.size.base * Typography.lineHeight.loose,
    fontStyle: 'italic',
  } as TextStyle,

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  } as ViewStyle,
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  } as ViewStyle,
});
