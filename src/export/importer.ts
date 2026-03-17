/**
 * src/export/importer.ts
 *
 * Imports a previously exported JSON or ZIP bundle back into the database.
 *
 * Import strategy: UPSERT
 *   - Tags are merged by name (same name → same tag).
 *   - Phrases are inserted by ID; if an ID already exists it is skipped
 *     (the local copy is kept so the user doesn't lose local edits).
 *   - Audio files are written to the audio directory.
 *
 * The importer validates the bundle version before proceeding.
 * Unknown bundle versions are rejected with a clear error message.
 */

import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { unzip as fflateUnzip } from 'fflate';

import * as SQLite from 'expo-sqlite';
import { ExportBundle, Tag } from '../types';
import { createTag, getAllTags } from '../db/repositories/tags';
import { createPhrase, getPhraseById } from '../db/repositories/phrases';
import { writeAudioFromBase64 } from '../audio/fileManager';

// ---------------------------------------------------------------------------
// Supported export bundle versions
// ---------------------------------------------------------------------------

const SUPPORTED_VERSIONS = [1];

// ---------------------------------------------------------------------------
// Parse and validate the bundle
// ---------------------------------------------------------------------------

function validateBundle(obj: unknown): ExportBundle {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Invalid export file: not a JSON object.');
  }

  const bundle = obj as Record<string, unknown>;

  if (!SUPPORTED_VERSIONS.includes(bundle.version as number)) {
    throw new Error(
      `Unsupported export version: ${bundle.version}. ` +
      `Supported versions: ${SUPPORTED_VERSIONS.join(', ')}.`
    );
  }

  if (!Array.isArray(bundle.phrases) || !Array.isArray(bundle.tags)) {
    throw new Error('Invalid export file: missing phrases or tags array.');
  }

  return bundle as unknown as ExportBundle;
}

// ---------------------------------------------------------------------------
// Apply the bundle to the database
// ---------------------------------------------------------------------------

export interface ImportResult {
  tagsImported:    number;
  phrasesImported: number;
  phrasesSkipped:  number;
  audioRestored:   number;
}

async function applyBundle(
  db: SQLite.SQLiteDatabase,
  bundle: ExportBundle,
  audioFiles: Map<string, string> = new Map() // phraseId → base64 audio
): Promise<ImportResult> {
  let tagsImported    = 0;
  let phrasesImported = 0;
  let phrasesSkipped  = 0;
  let audioRestored   = 0;

  // 1. Merge tags by name (preserve existing colours, import new ones)
  const existingTags = await getAllTags(db);
  const tagNameToId  = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));
  const importIdToLocalId = new Map<string, string>(); // export tag ID → local tag ID

  for (const tag of bundle.tags) {
    const existingId = tagNameToId.get(tag.name.toLowerCase());
    if (existingId) {
      // Already exists — map the import ID to the existing local ID
      importIdToLocalId.set(tag.id, existingId);
    } else {
      // Create new tag
      const created = await createTag(db, { name: tag.name, color: tag.color });
      importIdToLocalId.set(tag.id, created.id);
      tagNameToId.set(tag.name.toLowerCase(), created.id);
      tagsImported++;
    }
  }

  // 2. Build phrase→tag map from the bundle's flat list
  const phraseTagMap = new Map<string, string[]>(); // phraseId → [tagId, ...]
  for (const pt of bundle.phraseTags ?? []) {
    if (!phraseTagMap.has(pt.phraseId)) phraseTagMap.set(pt.phraseId, []);
    const localTagId = importIdToLocalId.get(pt.tagId);
    if (localTagId) phraseTagMap.get(pt.phraseId)!.push(localTagId);
  }

  // 3. Import phrases
  for (const phrase of bundle.phrases) {
    // Skip if this phrase ID already exists locally
    const existing = await getPhraseById(db, phrase.id);
    if (existing) {
      phrasesSkipped++;
      continue;
    }

    // Restore audio file if provided
    let audioPath: string | undefined;
    if (audioFiles.has(phrase.id)) {
      const base64 = audioFiles.get(phrase.id)!;
      audioPath = await writeAudioFromBase64(phrase.id, base64);
      audioRestored++;
    }

    const tagIds = phraseTagMap.get(phrase.id) ?? [];

    await createPhrase(db, {
      text:          phrase.text,
      transcription: phrase.transcription,
      emotion:       phrase.emotion,
      accent:        phrase.accent,
      speakerName:   phrase.speakerName,
      speakerRole:   phrase.speakerRole,
      speakerNotes:  phrase.speakerNotes,
      context:       phrase.context,
      audioPath:     audioPath ?? phrase.audioPath, // Fallback to stored path
      audioDuration: phrase.audioDuration,
      tagIds,
    });

    phrasesImported++;
  }

  return { tagsImported, phrasesImported, phrasesSkipped, audioRestored };
}

// ---------------------------------------------------------------------------
// Pick file and import
// ---------------------------------------------------------------------------

/**
 * Open the system file picker, let the user choose a .json or .zip file,
 * then import it into the database.
 *
 * @param db  The database handle.
 * @returns   Import result statistics, or null if the user cancelled.
 */
export async function importFromFile(
  db: SQLite.SQLiteDatabase
): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/zip', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const uri   = asset.uri;
  const name  = asset.name ?? '';

  if (name.endsWith('.zip')) {
    return importFromZip(db, uri);
  } else {
    return importFromJson(db, uri);
  }
}

// ---------------------------------------------------------------------------
// JSON import
// ---------------------------------------------------------------------------

async function importFromJson(
  db: SQLite.SQLiteDatabase,
  uri: string
): Promise<ImportResult> {
  let json: string;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    json = await response.text();
  } else {
    json = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  const bundle = validateBundle(JSON.parse(json));
  return applyBundle(db, bundle);
}

// ---------------------------------------------------------------------------
// ZIP import
// ---------------------------------------------------------------------------

async function importFromZip(
  db: SQLite.SQLiteDatabase,
  uri: string
): Promise<ImportResult> {
  // Read zip as base64 then convert to Uint8Array
  let zipData: Uint8Array;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const buffer   = await response.arrayBuffer();
    zipData = new Uint8Array(buffer);
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = atob(base64);
    zipData = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      zipData[i] = binary.charCodeAt(i);
    }
  }

  // Unzip
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    fflateUnzip(zipData, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  // Extract phrasebook.json
  const jsonBytes = files['phrasebook.json'];
  if (!jsonBytes) throw new Error('ZIP does not contain phrasebook.json');

  const json   = new TextDecoder().decode(jsonBytes);
  const bundle = validateBundle(JSON.parse(json));

  // Extract audio files (audio/{phraseId}.m4a → base64)
  const audioFiles = new Map<string, string>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('audio/') && path.endsWith('.m4a')) {
      const phraseId = path.slice('audio/'.length, -'.m4a'.length);
      const binary   = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
      audioFiles.set(phraseId, btoa(binary));
    }
  }

  return applyBundle(db, bundle, audioFiles);
}
