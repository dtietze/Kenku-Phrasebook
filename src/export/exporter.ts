/**
 * src/export/exporter.ts
 *
 * Serialises the user's entire phrasebook to a JSON file or a ZIP archive
 * (JSON + audio files).
 *
 * JSON export:
 *   A single .json file with the ExportBundle structure defined in src/types.
 *   Suitable for backup, cloud sync, or import into another device.
 *
 * ZIP export:
 *   A .zip file containing:
 *     - phrasebook.json  (the same ExportBundle)
 *     - audio/           directory with all .m4a recordings
 *   Uses the `fflate` library (pure-JS, no native modules).
 *
 * On native, the finished file is placed in the cache directory and then
 * shared via expo-sharing's share sheet.  On web, a download is triggered.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { strToU8, zip as fflateZip, Zippable } from 'fflate';

import * as SQLite from 'expo-sqlite';
import { ExportBundle, Phrase, Tag } from '../types';
import { listPhrases } from '../db/repositories/phrases';
import { getAllTags } from '../db/repositories/tags';
import { readAudioAsBase64 } from '../audio/fileManager';

// ---------------------------------------------------------------------------
// Export bundle version
// Increment this when the ExportBundle structure changes.
// ---------------------------------------------------------------------------

const EXPORT_VERSION = 1;

// ---------------------------------------------------------------------------
// Build the export bundle
// ---------------------------------------------------------------------------

async function buildBundle(db: SQLite.SQLiteDatabase): Promise<ExportBundle> {
  const [phrases, tags] = await Promise.all([
    listPhrases(db, { limit: 99999 }),
    getAllTags(db),
  ]);

  // Flatten phrase → tag associations
  const phraseTags = phrases.flatMap((p) =>
    p.tags.map((t) => ({ phraseId: p.id, tagId: t.id }))
  );

  // Remove tags array from each phrase (stored separately)
  const phrasesWithoutTags: Omit<Phrase, 'tags'>[] = phrases.map(
    ({ tags: _tags, ...rest }) => rest
  );

  return {
    version:    EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tags,
    phrases:    phrasesWithoutTags,
    phraseTags,
  };
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

/**
 * Export all phrases and tags to a JSON file and share / download it.
 *
 * @param db  The database handle.
 */
export async function exportAsJson(db: SQLite.SQLiteDatabase): Promise<void> {
  const bundle = await buildBundle(db);
  const json   = JSON.stringify(bundle, null, 2);

  if (Platform.OS === 'web') {
    // Trigger a browser download
    downloadOnWeb(json, 'kenku-phrasebook-export.json', 'application/json');
    return;
  }

  const path = `${FileSystem.cacheDirectory}kenku-phrasebook-export.json`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
  }
}

// ---------------------------------------------------------------------------
// ZIP export
// ---------------------------------------------------------------------------

/**
 * Export all phrases, tags, and audio files to a ZIP archive.
 *
 * @param db  The database handle.
 */
export async function exportAsZip(db: SQLite.SQLiteDatabase): Promise<void> {
  const bundle  = await buildBundle(db);
  const jsonStr = JSON.stringify(bundle, null, 2);

  // Build the fflate zip file object
  const zipEntries: Zippable = {
    'phrasebook.json': strToU8(jsonStr),
  };

  // Add audio files
  if (Platform.OS !== 'web') {
    for (const phrase of bundle.phrases) {
      if (phrase.audioPath) {
        const base64 = await readAudioAsBase64(phrase.audioPath);
        if (base64) {
          const filename = `audio/${phrase.id}.m4a`;
          // Convert base64 to Uint8Array
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          zipEntries[filename] = bytes;
        }
      }
    }
  }

  // Compress
  const zipData = await new Promise<Uint8Array>((resolve, reject) => {
    fflateZip(zipEntries, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  if (Platform.OS === 'web') {
    const blob = new Blob([zipData], { type: 'application/zip' });
    const url  = URL.createObjectURL(blob);
    downloadOnWeb(url, 'kenku-phrasebook-export.zip', 'application/zip', true);
    return;
  }

  const path = `${FileSystem.cacheDirectory}kenku-phrasebook-export.zip`;

  // Write Uint8Array as base64
  const base64 = btoa(String.fromCharCode(...zipData));
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
    });
  }
}

// ---------------------------------------------------------------------------
// Web download helper
// ---------------------------------------------------------------------------

/**
 * Trigger a file download in the browser.
 *
 * @param content   String content or object URL
 * @param filename  Suggested download filename
 * @param mimeType  MIME type for string content (ignored when isUrl = true)
 * @param isUrl     True if `content` is already a blob/object URL
 */
function downloadOnWeb(
  content: string,
  filename: string,
  mimeType: string,
  isUrl = false
): void {
  const url = isUrl
    ? content
    : URL.createObjectURL(new Blob([content], { type: mimeType }));

  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (!isUrl) URL.revokeObjectURL(url);
}
