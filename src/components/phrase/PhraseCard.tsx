/**
 * src/components/phrase/PhraseCard.tsx
 *
 * A list-view card displaying a phrase's key info:
 *   - The phrase text (truncated to 3 lines)
 *   - Emotion badge
 *   - First 3 tags
 *   - Accent and speaker name (if set)
 *   - Creation date
 *   - Audio indicator (if recording exists)
 *
 * Press → navigate to the phrase detail screen.
 * Long-press → show a quick-action menu (delete).
 */

import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Phrase } from '../../types';
import { TagChip } from '../ui/TagChip';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';
import { EMOTION_META } from '../../constants/emotions';
import { formatRelativeDate } from '../../utils/date';

interface Props {
  phrase:       Phrase;
  onPress?:     () => void;
  onLongPress?: () => void;
  searchScore?: number; // 0–1 relevance score (shown when searching)
}

const MAX_VISIBLE_TAGS = 3;

export function PhraseCard({ phrase, onPress, onLongPress, searchScore }: Props): React.JSX.Element {
  const emotion = phrase.emotion ? EMOTION_META[phrase.emotion] : null;
  const visibleTags  = phrase.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount  = phrase.tags.length - MAX_VISIBLE_TAGS;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Phrase: ${phrase.text}`}
      accessibilityRole="button"
    >
      {/* Top row: emotion + audio indicator + relevance */}
      <View style={styles.topRow}>
        {emotion && (
          <View style={[styles.emotionBadge, { backgroundColor: Colors.emotions[phrase.emotion!] + '33' }]}>
            <Ionicons name={emotion.icon as any} size={12} color={Colors.emotions[phrase.emotion!]} />
            <Text style={[styles.emotionText, { color: Colors.emotions[phrase.emotion!] }]}>
              {emotion.label}
            </Text>
          </View>
        )}
        <View style={styles.topRowRight}>
          {phrase.audioPath && (
            <Ionicons name="mic" size={14} color={Colors.gold} style={styles.micIcon} />
          )}
          {searchScore !== undefined && (
            <Text style={styles.scoreText}>{Math.round(searchScore * 100)}%</Text>
          )}
        </View>
      </View>

      {/* Phrase text */}
      <Text style={styles.phraseText} numberOfLines={3}>
        {phrase.text}
      </Text>

      {/* Accent / speaker meta */}
      {(phrase.accent || phrase.speakerName) && (
        <Text style={styles.metaText} numberOfLines={1}>
          {[phrase.speakerName, phrase.accent].filter(Boolean).join(' · ')}
        </Text>
      )}

      {/* Tags row */}
      {phrase.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {visibleTags.map((tag) => (
            <TagChip key={tag.id} tag={tag} size="sm" style={styles.tagChip} />
          ))}
          {hiddenCount > 0 && (
            <Text style={styles.moreText}>+{hiddenCount}</Text>
          )}
        </View>
      )}

      {/* Footer: date */}
      <Text style={styles.dateText}>{formatRelativeDate(phrase.createdAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  } as ViewStyle,
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  } as ViewStyle,

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    justifyContent: 'space-between',
  } as ViewStyle,
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  } as ViewStyle,
  emotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radius.full,
    gap: 4,
  } as ViewStyle,
  emotionText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  } as TextStyle,
  micIcon: {
    marginLeft: Spacing.xs,
  },
  scoreText: {
    fontSize: Typography.size.xs,
    color: Colors.gold,
    fontWeight: Typography.weight.medium,
  } as TextStyle,

  phraseText: {
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
    lineHeight: Typography.size.md * Typography.lineHeight.normal,
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
  } as TextStyle,

  metaText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  } as TextStyle,

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  } as ViewStyle,
  tagChip: {
    marginRight: 0, // gap handles spacing
  } as ViewStyle,
  moreText: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    alignSelf: 'center',
  } as TextStyle,

  dateText: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  } as TextStyle,
});
