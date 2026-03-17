/**
 * app/(tabs)/settings.tsx — Settings Screen
 *
 * A single-screen settings view with sections for:
 *   - Tag management (create, rename, delete tags)
 *   - Data export (JSON and ZIP)
 *   - Data import (from file)
 *   - Danger zone (delete all data)
 *   - Donation link (unobtrusive, at the bottom)
 *   - App version info
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Linking,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTags } from '../../src/hooks/useTags';
import { useDb } from '../../src/context/DatabaseContext';
import { usePhrases } from '../../src/hooks/usePhrases';
import { Button } from '../../src/components/ui/Button';
import { TagChip } from '../../src/components/ui/TagChip';
import { exportAsJson, exportAsZip } from '../../src/export/exporter';
import { importFromFile } from '../../src/export/importer';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Tag } from '../../src/types';

// ---------------------------------------------------------------------------
// Donation URL — change this to your preferred platform
// ---------------------------------------------------------------------------

const DONATION_URL = 'https://ko-fi.com/'; // Replace with your actual link

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

// ---------------------------------------------------------------------------
// Tag Manager Modal
// ---------------------------------------------------------------------------

interface TagManagerProps {
  visible: boolean;
  onClose: () => void;
}

function TagManager({ visible, onClose }: TagManagerProps): React.JSX.Element {
  const { tags, create, update, remove, nextColor } = useTags();
  const [newName, setNewName] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await create(name);
      setNewName('');
    } catch (e) {
      Alert.alert('Error', 'A tag with that name already exists.');
    }
  }, [newName, create]);

  const handleDelete = useCallback((tag: Tag) => {
    Alert.alert(
      `Delete tag "${tag.name}"?`,
      'This will remove the tag from all phrases.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(tag.id) },
      ]
    );
  }, [remove]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTag || !editName.trim()) return;
    await update(editingTag.id, { name: editName.trim() });
    setEditingTag(null);
    setEditName('');
  }, [editingTag, editName, update]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Manage Tags</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* Create new tag */}
        <View style={styles.newTagRow}>
          <TextInput
            style={styles.newTagInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="New tag name…"
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <Button label="Add" onPress={handleCreate} size="sm" />
        </View>

        <FlatList
          data={tags}
          keyExtractor={(t) => t.id}
          style={styles.tagList}
          renderItem={({ item }) => (
            editingTag?.id === item.id ? (
              <View style={styles.tagRow}>
                <TextInput
                  style={[styles.newTagInput, { flex: 1 }]}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                />
                <Button label="Save" onPress={handleSaveEdit} size="sm" />
                <Button label="✕" onPress={() => setEditingTag(null)} variant="ghost" size="sm" />
              </View>
            ) : (
              <View style={styles.tagRow}>
                <TagChip tag={item} style={{ flex: 0 }} />
                <View style={styles.tagActions}>
                  <Pressable onPress={() => { setEditingTag(item); setEditName(item.name); }}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </Pressable>
                </View>
              </View>
            )
          )}
          ListEmptyComponent={
            <Text style={styles.emptyNote}>No tags yet. Create one above.</Text>
          }
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen(): React.JSX.Element {
  const db             = useDb();
  const { removeAll }  = usePhrases();
  const { tags }       = useTags();
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);
  const [isImporting,  setIsImporting]  = useState(false);

  const handleExportJson = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportAsJson(db);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setIsExporting(false);
    }
  }, [db]);

  const handleExportZip = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportAsZip(db);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setIsExporting(false);
    }
  }, [db]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const result = await importFromFile(db);
      if (!result) return; // User cancelled
      Alert.alert(
        'Import complete',
        `${result.phrasesImported} phrase(s) imported, ${result.tagsImported} tag(s) added.\n` +
        (result.phrasesSkipped > 0 ? `${result.phrasesSkipped} phrase(s) already existed (skipped).\n` : '') +
        (result.audioRestored > 0 ? `${result.audioRestored} audio file(s) restored.` : '')
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
    }
  }, [db]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete all data?',
      'This will permanently delete ALL phrases, tags, and audio recordings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAll();
              Alert.alert('Done', 'All data has been deleted.');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }, [removeAll]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* === Tags === */}
      <SectionHeader title="Tags" />
      <View style={styles.card}>
        <View style={styles.tagPreview}>
          {tags.slice(0, 6).map((t) => <TagChip key={t.id} tag={t} size="sm" />)}
          {tags.length > 6 && (
            <Text style={styles.moreText}>+{tags.length - 6} more</Text>
          )}
          {tags.length === 0 && (
            <Text style={styles.emptyNote}>No tags yet</Text>
          )}
        </View>
        <Button
          label="Manage Tags"
          onPress={() => setTagModalOpen(true)}
          variant="secondary"
          fullWidth
        />
      </View>

      <Divider />

      {/* === Export === */}
      <SectionHeader title="Export Data" />
      <View style={styles.card}>
        <Text style={styles.cardDescription}>
          Back up your phrasebook to a file. JSON exports the phrase list only;
          ZIP includes audio recordings.
        </Text>
        <View style={styles.buttonRow}>
          <Button
            label="Export JSON"
            onPress={handleExportJson}
            loading={isExporting}
            variant="secondary"
            style={styles.halfButton}
          />
          <Button
            label="Export ZIP"
            onPress={handleExportZip}
            loading={isExporting}
            variant="secondary"
            style={styles.halfButton}
          />
        </View>
      </View>

      <Divider />

      {/* === Import === */}
      <SectionHeader title="Import Data" />
      <View style={styles.card}>
        <Text style={styles.cardDescription}>
          Import from a .json or .zip file previously exported from Kenku Phrasebook.
          Existing phrases are kept; only new ones are added.
        </Text>
        <Button
          label="Import from file…"
          onPress={handleImport}
          loading={isImporting}
          variant="secondary"
          fullWidth
        />
      </View>

      <Divider />

      {/* === Danger zone === */}
      <SectionHeader title="Danger Zone" />
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.cardDescription}>
          Permanently delete all phrases, tags, and audio recordings.
          Consider exporting first.
        </Text>
        <Button
          label="Delete all data"
          onPress={handleDeleteAll}
          variant="danger"
          fullWidth
        />
      </View>

      <Divider />

      {/* === About === */}
      <SectionHeader title="About" />
      <View style={styles.card}>
        <Text style={styles.aboutText}>Kenku Phrasebook v1.0.0</Text>
        <Text style={styles.aboutSubtext}>
          A tool for D&D Kenku players to collect and search phrases they've heard.
          All data stays on your device.
        </Text>
      </View>

      <Divider />

      {/* === Donation (unobtrusive, bottom of page) === */}
      <View style={styles.donationSection}>
        <Pressable onPress={() => Linking.openURL(DONATION_URL)} style={styles.donationLink}>
          <Ionicons name="heart-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.donationText}>Support this project</Text>
        </Pressable>
      </View>

      <TagManager visible={tagModalOpen} onClose={() => setTagModalOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background } as ViewStyle,
  content: { paddingBottom: Spacing.xxl } as ViewStyle,

  sectionHeader: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  } as ViewStyle,

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadow.sm,
  } as ViewStyle,
  dangerCard: {
    borderColor: Colors.danger + '44',
  } as ViewStyle,

  cardDescription: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.size.sm * Typography.lineHeight.normal,
  } as TextStyle,

  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as ViewStyle,
  halfButton: { flex: 1 } as ViewStyle,

  tagPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    minHeight: 28,
  } as ViewStyle,
  moreText: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    alignSelf: 'center',
  } as TextStyle,
  emptyNote: {
    fontSize: Typography.size.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  } as TextStyle,

  aboutText: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  } as TextStyle,
  aboutSubtext: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.size.sm * Typography.lineHeight.normal,
  } as TextStyle,

  // Donation section
  donationSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  } as ViewStyle,
  donationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  } as ViewStyle,
  donationText: {
    fontSize: Typography.size.sm,
    color: Colors.textMuted,
  } as TextStyle,

  // Tag manager modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
  } as ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  } as ViewStyle,
  modalTitle: {
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.bold,
  } as TextStyle,
  newTagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  } as ViewStyle,
  newTagInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
    padding: Spacing.sm,
    minHeight: 42,
  } as ViewStyle,
  tagList: { flex: 1 } as ViewStyle,
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  } as ViewStyle,
  tagActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  } as ViewStyle,
});
