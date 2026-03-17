/**
 * app/phrase/new.tsx — New Phrase (Manual Entry) Screen
 *
 * Presented as a modal when the user taps the "+" FAB on the Phrasebook screen.
 * Pure text entry — no recording.  For recording use the Capture tab.
 */

import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { usePhrases } from '../../src/hooks/usePhrases';
import { useTags } from '../../src/hooks/useTags';
import { PhraseForm } from '../../src/components/phrase/PhraseForm';
import { CreatePhraseData } from '../../src/db/repositories/phrases';

export default function NewPhraseScreen(): React.JSX.Element {
  const { create } = usePhrases();
  const { tags }   = useTags();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async (data: CreatePhraseData & { tagIds: string[] }) => {
    setIsSaving(true);
    try {
      await create(data);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save phrase.');
    } finally {
      setIsSaving(false);
    }
  }, [create]);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  return (
    <PhraseForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      availableTags={tags}
      isLoading={isSaving}
    />
  );
}
