/**
 * src/audio/fileManager.ts
 *
 * Manages the lifecycle of audio files on the device's file system.
 *
 * All audio files are stored under:
 *   {FileSystem.documentDirectory}/audio/{phraseId}.m4a
 *
 * This directory persists across app updates and is included in device backups.
 * On web, FileSystem.documentDirectory is not available, so audio is handled
 * as a blob URL or data URI instead — the platform check is explicit.
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Relative path (from documentDirectory) where audio files are stored. */
const AUDIO_DIR = 'audio';

/** Extension used for all recorded audio files. */
const AUDIO_EXT = '.m4a';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Full path to the audio directory on native platforms. */
function audioDirectory(): string {
  return `${FileSystem.documentDirectory}${AUDIO_DIR}/`;
}

/** Full path to an audio file for a given phrase ID. */
export function audioPathForPhrase(phraseId: string): string {
  if (Platform.OS === 'web') {
    // On web we don't use file paths — caller should use the blob URI directly.
    return phraseId;
  }
  return `${audioDirectory()}${phraseId}${AUDIO_EXT}`;
}

/** Ensure the audio directory exists. Call once on app startup. */
export async function ensureAudioDirectory(): Promise<void> {
  if (Platform.OS === 'web') return;

  const info = await FileSystem.getInfoAsync(audioDirectory());
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(audioDirectory(), { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * Copy a temporary recording URI to the permanent audio directory,
 * named after the phrase ID.
 *
 * @param tempUri   The URI returned by PhraseRecorder.stop()
 * @param phraseId  The phrase this recording belongs to
 * @returns         The permanent file path (relative to documentDirectory)
 */
export async function saveAudioFile(
  tempUri: string,
  phraseId: string
): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, the "URI" is already a blob URL — return it directly.
    // The caller is responsible for storing it in the phrase row.
    return tempUri;
  }

  await ensureAudioDirectory();

  const dest = audioPathForPhrase(phraseId);
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

/**
 * Delete the audio file for a phrase, if it exists.
 * Safe to call even if the file does not exist.
 */
export async function deleteAudioFile(path: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch (e) {
    console.warn('[fileManager] Failed to delete audio file:', path, e);
  }
}

/**
 * Read an audio file as a base64-encoded string.
 * Used by the ZIP exporter to bundle audio files.
 */
export async function readAudioAsBase64(path: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;

    return FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

/**
 * Write a base64-encoded audio file to the audio directory.
 * Used by the importer to restore audio from a ZIP bundle.
 */
export async function writeAudioFromBase64(
  phraseId: string,
  base64: string
): Promise<string> {
  await ensureAudioDirectory();
  const dest = audioPathForPhrase(phraseId);
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}

/**
 * Check whether an audio file exists for a given path.
 */
export async function audioFileExists(path: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}
