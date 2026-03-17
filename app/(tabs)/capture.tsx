/**
 * app/(tabs)/capture.tsx — Capture Screen
 *
 * The "quick capture" workflow for recording and adding a new phrase.
 *
 * Flow:
 *   1. User taps the big record button → recording starts + STT begins
 *   2. Live transcript appears in the text box (editable at any time)
 *   3. User taps stop → recording stops, auto-suggestions appear
 *   4. User edits text, selects emotion/tags, taps "Save"
 *   5. Phrase is saved, form resets
 *
 * Manual entry:
 *   The user can also just type the phrase text without recording.
 *   The "Record" button is optional — if they skip it, no audio is saved.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePhrases } from '../../src/hooks/usePhrases';
import { useTags } from '../../src/hooks/useTags';
import { useRecorder } from '../../src/hooks/useRecorder';
import { useSTT } from '../../src/hooks/useSTT';
import { RecordButton } from '../../src/components/audio/RecordButton';
import { PhraseForm } from '../../src/components/phrase/PhraseForm';
import { Button } from '../../src/components/ui/Button';
import { Colors, Typography, Spacing } from '../../src/constants/theme';
import { generateSuggestions } from '../../src/suggest/autoSuggest';
import { saveAudioFile } from '../../src/audio/fileManager';
import { generateId } from '../../src/utils/uuid';
import { formatDuration } from '../../src/utils/date';
import { AutoSuggestions } from '../../src/types';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CaptureScreen(): React.JSX.Element {
  const { create } = usePhrases();
  const { tags }   = useTags();
  const recorder   = useRecorder();
  const stt        = useSTT();

  // After a recording is stopped, we hold the result here until the phrase is saved
  const [capturedUri,      setCapturedUri]      = useState<string | null>(null);
  const [capturedDurationMs, setCapturedDurationMs] = useState(0);
  const [transcribedText,  setTranscribedText]  = useState('');
  const [suggestions,      setSuggestions]      = useState<AutoSuggestions | null>(null);
  const [isSaving,         setIsSaving]         = useState(false);
  const [showForm,         setShowForm]         = useState(false);

  // ---------------------------------------------------------------------------
  // Recording control
  // ---------------------------------------------------------------------------

  const handleRecordToggle = useCallback(async () => {
    if (recorder.status === 'recording') {
      // Stop recording
      await stt.stop();
      const result = await recorder.stop();

      if (result) {
        setCapturedUri(result.uri);
        setCapturedDurationMs(result.durationMs);
      }

      // Use STT transcript as the phrase text
      const text = stt.transcript.trim() || transcribedText;
      setTranscribedText(text);

      // Generate auto-suggestions
      if (text) {
        setSuggestions(generateSuggestions(text, tags));
      }

      setShowForm(true);
    } else {
      // Start recording + STT
      stt.clear();
      setTranscribedText('');
      setSuggestions(null);
      setCapturedUri(null);
      setShowForm(false);

      await recorder.start();
      if (stt.isAvailable) {
        await stt.start();
      }
    }
  }, [recorder, stt, transcribedText, tags]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async (formData: Parameters<typeof create>[0]) => {
    setIsSaving(true);
    try {
      // If we have a recording, copy it to permanent storage
      let audioPath = formData.audioPath;
      let audioDuration = formData.audioDuration;

      if (capturedUri) {
        const phraseId = generateId(); // Will be the phrase's final ID via createPhrase
        audioPath = await saveAudioFile(capturedUri, phraseId);
        audioDuration = capturedDurationMs / 1000;
      }

      await create({
        ...formData,
        audioPath,
        audioDuration,
        transcription: stt.transcript.trim() || undefined,
      });

      // Reset everything
      recorder.reset();
      stt.clear();
      setCapturedUri(null);
      setTranscribedText('');
      setSuggestions(null);
      setShowForm(false);

      Alert.alert('Saved!', 'The phrase has been added to your phrasebook.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save phrase.');
    } finally {
      setIsSaving(false);
    }
  }, [capturedUri, capturedDurationMs, stt, recorder, create]);

  const handleCancel = useCallback(() => {
    recorder.reset();
    stt.clear();
    setCapturedUri(null);
    setTranscribedText('');
    setSuggestions(null);
    setShowForm(false);
  }, [recorder, stt]);

  // ---------------------------------------------------------------------------
  // Render: recording stage
  // ---------------------------------------------------------------------------

  if (!showForm) {
    return (
      <View style={styles.container}>
        <View style={styles.recordingArea}>
          <Text style={styles.instruction}>
            {recorder.status === 'recording'
              ? 'Recording… tap to stop'
              : 'Tap to record a phrase you heard'}
          </Text>

          <RecordButton
            status={recorder.status}
            onPress={handleRecordToggle}
          />

          {recorder.status === 'recording' && (
            <Text style={styles.timer}>{formatDuration(recorder.durationMs)}</Text>
          )}

          {/* Live transcript */}
          {stt.isListening && stt.transcript !== '' && (
            <View style={styles.liveTranscript}>
              <Ionicons name="mic" size={14} color={Colors.gold} />
              <Text style={styles.liveTranscriptText} numberOfLines={4}>
                {stt.transcript}
              </Text>
            </View>
          )}

          {!stt.isAvailable && (
            <Text style={styles.sttNote}>
              Live transcription unavailable in Expo Go.{'\n'}
              Use a development build for transcription, or type manually.
            </Text>
          )}

          {recorder.error && (
            <Text style={styles.errorText}>{recorder.error}</Text>
          )}
        </View>

        {/* Skip recording — manual entry */}
        <Button
          label="Enter phrase manually"
          onPress={() => setShowForm(true)}
          variant="ghost"
          style={styles.manualButton}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: form stage
  // ---------------------------------------------------------------------------

  return (
    <PhraseForm
      initialValues={{
        text:          transcribedText,
        transcription: stt.transcript.trim(),
        audioPath:     capturedUri ?? undefined,
        audioDuration: capturedDurationMs / 1000,
      }}
      onSubmit={handleSave}
      onCancel={handleCancel}
      availableTags={tags}
      suggestions={suggestions ?? undefined}
      isLoading={isSaving}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  } as ViewStyle,

  recordingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  } as ViewStyle,

  instruction: {
    fontSize: Typography.size.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  } as TextStyle,

  timer: {
    fontSize: Typography.size.xl,
    color: Colors.danger,
    fontWeight: Typography.weight.bold,
    letterSpacing: 2,
  } as TextStyle,

  liveTranscript: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    maxWidth: '100%',
    gap: Spacing.xs,
  } as ViewStyle,
  liveTranscriptText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
    fontStyle: 'italic',
  } as TextStyle,

  sttNote: {
    fontSize: Typography.size.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.size.sm * 1.6,
    fontStyle: 'italic',
  } as TextStyle,

  errorText: {
    fontSize: Typography.size.sm,
    color: Colors.danger,
    textAlign: 'center',
  } as TextStyle,

  manualButton: {
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  } as ViewStyle,
});
