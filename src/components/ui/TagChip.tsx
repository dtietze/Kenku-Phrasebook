/**
 * src/components/ui/TagChip.tsx
 *
 * A small coloured pill that displays a tag's name.
 * Supports optional press and long-press interactions for filter/edit.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Tag } from '../../types';
import { Spacing, Radius, Typography } from '../../constants/theme';

interface Props {
  tag: Tag;
  onPress?:      () => void;
  onLongPress?:  () => void;
  selected?:     boolean;
  size?:         'sm' | 'md';
  style?:        ViewStyle;
}

export function TagChip({ tag, onPress, onLongPress, selected, size = 'md', style }: Props): React.JSX.Element {
  const isSmall = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.chip,
        isSmall && styles.small,
        { backgroundColor: tag.color + (selected ? 'ff' : '40') },
        { borderColor: tag.color },
        pressed && { opacity: 0.7 },
        style,
      ]}
      accessibilityLabel={`Tag: ${tag.name}`}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.text,
          isSmall && styles.textSmall,
          { color: selected ? '#fff' : tag.color },
        ]}
        numberOfLines={1}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  } as ViewStyle,
  small: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: Spacing.xxs,
  } as ViewStyle,
  text: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  } as TextStyle,
  textSmall: {
    fontSize: Typography.size.xs,
  } as TextStyle,
});
