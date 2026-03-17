/**
 * src/components/ui/Button.tsx
 *
 * Fantasy-styled button with three visual variants:
 *   - "primary"   : gold filled — primary actions (Save, Create)
 *   - "secondary" : outlined gold — secondary actions (Cancel, Edit)
 *   - "danger"    : red outlined — destructive actions (Delete)
 *   - "ghost"     : no border — low-emphasis actions (links, small actions)
 */

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?:  Variant;
  size?:     Size;
  disabled?: boolean;
  loading?:  boolean;
  fullWidth?: boolean;
  icon?:     React.ReactNode; // Optional icon to the left of the label
  style?:    ViewStyle;
}

export function Button({
  label,
  onPress,
  variant  = 'primary',
  size     = 'md',
  disabled = false,
  loading  = false,
  fullWidth = false,
  icon,
  style,
}: Props): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles] as ViewStyle,
        fullWidth && styles.fullWidth,
        (pressed || isDisabled) && styles.pressed,
        style,
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.textInverse : Colors.gold}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.label, styles[`label_${variant}` as keyof typeof styles] as TextStyle]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  } as ViewStyle,

  // Variants
  primary: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  } as ViewStyle,
  secondary: {
    backgroundColor: 'transparent',
    borderColor: Colors.gold,
  } as ViewStyle,
  danger: {
    backgroundColor: 'transparent',
    borderColor: Colors.danger,
  } as ViewStyle,
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  } as ViewStyle,

  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  } as ViewStyle,
  size_md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  } as ViewStyle,
  size_lg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
  } as ViewStyle,

  fullWidth: { alignSelf: 'stretch' } as ViewStyle,

  pressed: { opacity: 0.6 } as ViewStyle,

  // Labels
  label: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
  } as TextStyle,
  label_primary: {
    color: Colors.textInverse,
  } as TextStyle,
  label_secondary: {
    color: Colors.gold,
  } as TextStyle,
  label_danger: {
    color: Colors.danger,
  } as TextStyle,
  label_ghost: {
    color: Colors.textSecondary,
  } as TextStyle,

  content: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  iconWrapper: {
    marginRight: Spacing.xs,
  } as ViewStyle,
});
