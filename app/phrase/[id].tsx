/**
 * app/phrase/[id].tsx — Phrase Detail / Edit Screen
 *
 * Shows the full phrase detail in view mode.
 * An "Edit" button switches to edit mode (reusing PhraseForm).
 * A "Delete" button (with confirmation) removes the phrase.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useDb } from '../../src/context/DatabaseContext';
import { useTags } from '../../src/hooks/useTags';
import { getPhraseById, updatePhrase, deletePhrase } from '../../src/db/repositories/phrases';
import { deleteAudioFile } from '../../src/audio/fileManager';
import { PhraseForm } from '../../src/components/phrase/PhraseForm';
import { TagChip } from '../../src/components/ui/TagChip';
import { AudioPlayer } from '../../src/components/audio/AudioPlayer';
import { Button } from '../../src/components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { EMOTION_META } from '../../src/constants/emotions';
import { formatDate, formatDurationSecs } from '../../src/utils/date';
import { Phrase } from '../../src/types';

// ---------------------------------------------------------------------------
// Detail view (read mode)
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value?: string }): React.JSX.Element | null {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PhraseDetail({ phrase, onEdit, onDelete }: {
  phrase: Phrase;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const emotion = phrase.emotion ? EMOTION_META[phrase.emotion] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      {/* Phrase text */}
      <View style={styles.phraseTextCard}>
        <Text style={styles.phraseText}>"{phrase.text}"</Text>
      </View>

      {/* Audio player */}
      {phrase.audioPath && (
        <AudioPlayer
          uri={phrase.audioPath}
          durationSeconds={phrase.audioDuration}
        />
      )}

      {/* Metadata */}
      <View style={styles.metaCard}>
        {emotion && (
          <View style={styles.emotionRow}>
            <Ionicons name={emotion.icon as any} size={16} color={Colors.emotions[phrase.emotion!]} />
            <Text style={[styles.emotionText, { color: Colors.emotions[phrase.emotion!] }]}>
              {emotion.label}
            </Text>
          </View>
        )}
        <DetailRow label="Accent"       value={phrase.accent} />
        <DetailRow label="Speaker"      value={phrase.speakerName} />
        <DetailRow label="Role"         value={phrase.speakerRole} />
        <DetailRow label="Speaker notes" value={phrase.speakerNotes} />
        <DetailRow label="Context"      value={phrase.context} />
        {phrase.audioDuration && (
          <DetailRow label="Duration" value={formatDurationSecs(phrase.audioDuration)} />
        )}
        <DetailRow label="Added"        value={formatDate(phrase.createdAt)} />
        {phrase.updatedAt !== phrase.createdAt && (
          <DetailRow label="Updated"    value={formatDate(phrase.updatedAt)} />
        )}
      </View>

      {/* Tags */}
      {phrase.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {phrase.tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}
        </View>
      )}

      {/* Raw transcription (if different from edited text) */}
      {phrase.transcription && phrase.transcription !== phrase.text && (
        <View style={styles.transcriptionBox}>
          <Text style={styles.transcriptionLabel}>Original transcription:</Text>
          <Text style={styles.transcriptionText}>{phrase.transcription}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button label="Edit" onPress={onEdit} variant="secondary" style={styles.actionBtn} />
        <Button label="Delete" onPress={onDelete} variant="danger" style={styles.actionBtn} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PhraseDetailScreen(): React.JSX.Element {
  const { id }       = useLocalSearchParams<{ id: string }>();
  const db           = useDb();
  const { tags }     = useTags();
  const navigation   = useNavigation();

  const [phrase,    setPhrase]    = useState<Phrase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Load the phrase
  useEffect(() => {
    if (!id) return;
    (async () => {
      const p = await getPhraseById(db, id);
      setPhrase(p);
      setIsLoading(false);
    })();
  }, [id, db]);

  // Set nav header title when phrase loads
  useEffect(() => {
    if (phrase) {
      navigation.setOptions({ title: phrase.text.substring(0, 40) + (phrase.text.length > 40 ? '…' : '') });
    }
  }, [phrase, navigation]);

  const handleSave = useCallback(async (data: Parameters<typeof updatePhrase>[2]) => {
    if (!id) return;
    setIsSaving(true);
    try {
      const updated = await updatePhrase(db, id, data ?? {});
      setPhrase(updated);
      setIsEditing(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }, [db, id]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete this phrase?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const { audioPath } = await deletePhrase(db, id);
          if (audioPath) await deleteAudioFile(audioPath);
          router.back();
        },
      },
    ]);
  }, [db, id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (error || !phrase) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Phrase not found.'}</Text>
        <Button label="Go back" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  if (isEditing) {
    return (
      <PhraseForm
        initialValues={{
          text:          phrase.text,
          transcription: phrase.transcription,
          emotion:       phrase.emotion,
          accent:        phrase.accent,
          speakerName:   phrase.speakerName,
          speakerRole:   phrase.speakerRole,
          speakerNotes:  phrase.speakerNotes,
          context:       phrase.context,
          audioPath:     phrase.audioPath,
          audioDuration: phrase.audioDuration,
          tagIds:        phrase.tags.map((t) => t.id),
        }}
        onSubmit={handleSave as any}
        onCancel={() => setIsEditing(false)}
        availableTags={tags}
        isLoading={isSaving}
      />
    );
  }

  return (
    <PhraseDetail
      phrase={phrase}
      onEdit={() => setIsEditing(true)}
      onDelete={handleDelete}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background } as ViewStyle,
  detailContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl } as ViewStyle,
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  } as ViewStyle,

  phraseTextCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gold + '44',
    ...Shadow.md,
  } as ViewStyle,
  phraseText: {
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: Typography.size.xl * Typography.lineHeight.normal,
    textAlign: 'center',
  } as TextStyle,

  metaCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  } as ViewStyle,
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  } as ViewStyle,
  emotionText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
  } as TextStyle,

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  } as ViewStyle,
  detailLabel: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
    flex: 1,
  } as TextStyle,
  detailValue: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  } as TextStyle,

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  } as ViewStyle,

  transcriptionBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
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

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  } as ViewStyle,
  actionBtn: { minWidth: 80 } as ViewStyle,

  errorText: {
    color: Colors.danger,
    fontSize: Typography.size.base,
    marginBottom: Spacing.md,
    textAlign: 'center',
  } as TextStyle,
});
