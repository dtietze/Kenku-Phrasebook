/**
 * src/components/phrase/PhraseForm.tsx
 *
 * Reusable form for creating or editing a phrase.
 * Used by both the "new phrase" screen and the edit mode of the detail screen.
 *
 * Props:
 *   - initialValues: Pre-fill the form (for editing an existing phrase)
 *   - onSubmit:      Called with the form data when the user saves
 *   - onCancel:      Called when the user cancels
 *   - availableTags: All existing tags (from useTags)
 *   - suggestions:   Auto-suggestions from STT transcription
 *   - isLoading:     Disable the form while saving
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Emotion, Tag, AutoSuggestions } from '../../types';
import { CreatePhraseData } from '../../db/repositories/phrases';
import { TagChip } from '../ui/TagChip';
import { Button } from '../ui/Button';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { EMOTION_META, ALL_EMOTIONS } from '../../constants/emotions';
import { SUGGESTED_ACCENTS } from '../../constants/accents';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EmotionSelectorProps {
  value?: Emotion;
  onChange: (emotion: Emotion | undefined) => void;
}

function EmotionSelector({ value, onChange }: EmotionSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emotionScroll}>
      {/* "None" option */}
      <Button
        label="—"
        onPress={() => onChange(undefined)}
        variant={value === undefined ? 'primary' : 'ghost'}
        size="sm"
        style={styles.emotionButton}
      />
      {ALL_EMOTIONS.map((emotion) => {
        const meta = EMOTION_META[emotion];
        const selected = value === emotion;
        return (
          <View key={emotion} style={[styles.emotionChip, selected && styles.emotionChipSelected]}>
            <Ionicons
              name={meta.icon as any}
              size={16}
              color={selected ? Colors.textInverse : Colors.emotions[emotion]}
              onPress={() => onChange(selected ? undefined : emotion)}
            />
            <Text
              style={[styles.emotionChipText, { color: selected ? Colors.textInverse : Colors.emotions[emotion] }]}
              onPress={() => onChange(selected ? undefined : emotion)}
            >
              {meta.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

interface TagSelectorProps {
  availableTags: Tag[];
  selectedIds:   string[];
  onToggle:      (id: string) => void;
}

function TagSelector({ availableTags, selectedIds, onToggle }: TagSelectorProps) {
  if (availableTags.length === 0) {
    return (
      <Text style={styles.emptyNote}>
        No tags yet. Create tags in the Settings screen.
      </Text>
    );
  }

  return (
    <View style={styles.tagGrid}>
      {availableTags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onPress={() => onToggle(tag.id)}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

interface FormValues {
  text:          string;
  emotion?:      Emotion;
  accent:        string;
  speakerName:   string;
  speakerRole:   string;
  speakerNotes:  string;
  context:       string;
  tagIds:        string[];
  transcription: string; // Read-only display of the raw STT output
}

interface Props {
  initialValues?:  Partial<FormValues & { audioPath?: string; audioDuration?: number }>;
  onSubmit:        (data: CreatePhraseData & { tagIds: string[] }) => Promise<void>;
  onCancel:        () => void;
  availableTags:   Tag[];
  suggestions?:    AutoSuggestions;
  isLoading?:      boolean;
}

export function PhraseForm({
  initialValues,
  onSubmit,
  onCancel,
  availableTags,
  suggestions,
  isLoading = false,
}: Props): React.JSX.Element {
  const [values, setValues] = useState<FormValues>({
    text:         initialValues?.text          ?? '',
    emotion:      initialValues?.emotion,
    accent:       initialValues?.accent        ?? '',
    speakerName:  initialValues?.speakerName   ?? '',
    speakerRole:  initialValues?.speakerRole   ?? '',
    speakerNotes: initialValues?.speakerNotes  ?? '',
    context:      initialValues?.context       ?? '',
    tagIds:       initialValues?.tagIds        ?? [],
    transcription: initialValues?.transcription ?? '',
  });

  // Apply a suggestion (dismiss it once applied)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const set = useCallback(<K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleTag = useCallback((id: string) => {
    setValues((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id)
        ? prev.tagIds.filter((t) => t !== id)
        : [...prev.tagIds, id],
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!values.text.trim()) {
      Alert.alert('Phrase required', 'Please enter the phrase text before saving.');
      return;
    }
    await onSubmit({
      text:          values.text.trim(),
      transcription: values.transcription || undefined,
      emotion:       values.emotion,
      accent:        values.accent.trim() || undefined,
      speakerName:   values.speakerName.trim() || undefined,
      speakerRole:   values.speakerRole.trim() || undefined,
      speakerNotes:  values.speakerNotes.trim() || undefined,
      context:       values.context.trim() || undefined,
      audioPath:     initialValues?.audioPath,
      audioDuration: initialValues?.audioDuration,
      tagIds:        values.tagIds,
    });
  }, [values, onSubmit, initialValues]);

  // Active suggestions (not yet dismissed)
  const activeSuggestions = suggestions
    ? {
        emotion:  suggestions.emotion && !dismissedSuggestions.has('emotion')
                    ? suggestions.emotion
                    : null,
        tagNames: suggestions.tagNames.filter(
          (n) => !dismissedSuggestions.has(`tag:${n}`)
        ),
      }
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* === Phrase text === */}
      <Text style={styles.label}>
        Phrase <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.textArea}
        value={values.text}
        onChangeText={(v) => set('text', v)}
        placeholder="Enter the phrase exactly as you heard it…"
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isLoading}
      />

      {/* Raw transcription (read-only, for reference) */}
      {values.transcription !== '' && values.transcription !== values.text && (
        <View style={styles.transcriptionBox}>
          <Text style={styles.transcriptionLabel}>Original transcription:</Text>
          <Text style={styles.transcriptionText}>{values.transcription}</Text>
        </View>
      )}

      {/* === Emotion === */}
      <Text style={styles.label}>Emotion</Text>

      {/* Suggestion pill */}
      {activeSuggestions?.emotion && (
        <View style={styles.suggestionRow}>
          <Text style={styles.suggestionHint}>Suggested:</Text>
          <Button
            label={EMOTION_META[activeSuggestions.emotion].label}
            onPress={() => {
              set('emotion', activeSuggestions.emotion!);
              setDismissedSuggestions((s) => new Set(s).add('emotion'));
            }}
            variant="secondary"
            size="sm"
          />
          <Button
            label="Dismiss"
            onPress={() => setDismissedSuggestions((s) => new Set(s).add('emotion'))}
            variant="ghost"
            size="sm"
          />
        </View>
      )}

      <EmotionSelector value={values.emotion} onChange={(e) => set('emotion', e)} />

      {/* === Accent === */}
      <Text style={styles.label}>Accent / Dialect</Text>
      <TextInput
        style={styles.input}
        value={values.accent}
        onChangeText={(v) => set('accent', v)}
        placeholder="e.g. Dwarven Scots, Noble Elvish…"
        placeholderTextColor={Colors.textMuted}
        editable={!isLoading}
      />
      {/* Quick-pick accent suggestions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accentScroll}>
        {SUGGESTED_ACCENTS.slice(0, 8).map((a) => (
          <Button
            key={a}
            label={a}
            onPress={() => set('accent', a)}
            variant="ghost"
            size="sm"
            style={styles.accentButton}
          />
        ))}
      </ScrollView>

      {/* === Speaker === */}
      <Text style={styles.label}>Speaker</Text>
      <TextInput
        style={styles.input}
        value={values.speakerName}
        onChangeText={(v) => set('speakerName', v)}
        placeholder="Name (e.g. Grimbolt the Innkeeper)"
        placeholderTextColor={Colors.textMuted}
        editable={!isLoading}
      />
      <TextInput
        style={styles.input}
        value={values.speakerRole}
        onChangeText={(v) => set('speakerRole', v)}
        placeholder="Role (e.g. Barkeep, BBEG, Town Guard)"
        placeholderTextColor={Colors.textMuted}
        editable={!isLoading}
      />
      <TextInput
        style={[styles.input, styles.inputSmall]}
        value={values.speakerNotes}
        onChangeText={(v) => set('speakerNotes', v)}
        placeholder="Notes about this speaker…"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
        editable={!isLoading}
      />

      {/* === Context === */}
      <Text style={styles.label}>Context</Text>
      <TextInput
        style={[styles.input, styles.inputSmall]}
        value={values.context}
        onChangeText={(v) => set('context', v)}
        placeholder="Situation in which this was said…"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
        editable={!isLoading}
      />

      {/* === Tags === */}
      <Text style={styles.label}>Tags</Text>

      {/* Tag suggestions */}
      {activeSuggestions && activeSuggestions.tagNames.length > 0 && (
        <View style={styles.suggestionRow}>
          <Text style={styles.suggestionHint}>Suggested:</Text>
          {activeSuggestions.tagNames.map((name) => {
            const tag = availableTags.find((t) => t.name === name);
            if (!tag) return null;
            return (
              <React.Fragment key={name}>
                <Button
                  label={name}
                  onPress={() => {
                    if (!values.tagIds.includes(tag.id)) toggleTag(tag.id);
                    setDismissedSuggestions((s) => new Set(s).add(`tag:${name}`));
                  }}
                  variant="secondary"
                  size="sm"
                />
              </React.Fragment>
            );
          })}
        </View>
      )}

      <TagSelector
        availableTags={availableTags}
        selectedIds={values.tagIds}
        onToggle={toggleTag}
      />

      {/* === Actions === */}
      <View style={styles.actions}>
        <Button label="Cancel" onPress={onCancel} variant="ghost" style={styles.actionBtn} />
        <Button
          label="Save Phrase"
          onPress={handleSubmit}
          loading={isLoading}
          style={styles.actionBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background } as ViewStyle,
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl } as ViewStyle,

  label: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as TextStyle,
  required: {
    color: Colors.danger,
  } as TextStyle,

  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
    padding: Spacing.sm,
    minHeight: 42,
  } as ViewStyle,
  inputSmall: {
    minHeight: 72,
  } as ViewStyle,
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold,
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontStyle: 'italic',
    padding: Spacing.sm,
    minHeight: 100,
    lineHeight: Typography.size.md * Typography.lineHeight.normal,
  } as ViewStyle,

  transcriptionBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: Colors.goldDim,
  } as ViewStyle,
  transcriptionLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  } as TextStyle,
  transcriptionText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  } as TextStyle,

  emotionScroll: { marginVertical: Spacing.xs } as ViewStyle,
  emotionButton: { marginRight: Spacing.xs } as ViewStyle,
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  } as ViewStyle,
  emotionChipSelected: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  } as ViewStyle,
  emotionChipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  } as TextStyle,

  accentScroll: { marginVertical: Spacing.xs } as ViewStyle,
  accentButton: { marginRight: Spacing.xs } as ViewStyle,

  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  } as ViewStyle,

  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  } as ViewStyle,
  suggestionHint: {
    fontSize: Typography.size.xs,
    color: Colors.gold,
    fontStyle: 'italic',
  } as TextStyle,

  emptyNote: {
    fontSize: Typography.size.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  } as TextStyle,

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  } as ViewStyle,
  actionBtn: { minWidth: 100 } as ViewStyle,
});
