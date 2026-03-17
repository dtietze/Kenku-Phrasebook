/**
 * src/types/index.ts
 *
 * Central TypeScript type definitions for Kenku Phrasebook.
 * All domain models are defined here; database row types are kept
 * separate in src/db/schema.ts to allow the two to diverge if needed.
 *
 * Design principle: keep types plain data objects (no methods) so they
 * can be safely serialised, stored, and transmitted without ceremony.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Emotions that can be applied to a phrase.
 * Kept as a union type (not an enum) so values serialise directly to strings.
 */
export type Emotion =
  | 'neutral'
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'disgust'
  | 'surprise'
  | 'contempt'
  | 'excitement'
  | 'confusion';

// ---------------------------------------------------------------------------
// Core domain models
// ---------------------------------------------------------------------------

/** A coloured label that can be attached to any number of phrases. */
export interface Tag {
  id: string;        // uuid v4
  name: string;
  color: string;     // hex colour, e.g. "#8B5E3C"
  createdAt: string; // ISO-8601 datetime string
}

/**
 * A phrase that the Kenku character has heard and can now mimic.
 * Audio is optional — the phrase can be text-only.
 */
export interface Phrase {
  id: string;             // uuid v4
  text: string;           // The phrase text (either transcribed or manually entered)
  transcription?: string; // Raw STT output before the user edited it (for audit trail)
  emotion?: Emotion;      // Emotional colouring with which the phrase was said
  accent?: string;        // Free-form description, e.g. "Dwarven Scots", "Noble Elvish"
  speakerName?: string;   // Name of the NPC / player who said it
  speakerRole?: string;   // Role, e.g. "Barkeep", "BBEG", "Town Guard"
  speakerNotes?: string;  // Longer free-form notes about the speaker
  context?: string;       // Situation in which the phrase was heard
  audioPath?: string;     // Relative path under FileSystem.documentDirectory (native)
                          // OR a data: URI (web)
  audioDuration?: number; // Duration in seconds
  createdAt: string;      // ISO-8601 datetime string
  updatedAt: string;      // ISO-8601 datetime string
  tags: Tag[];            // Populated by join — not stored directly on the phrase row
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** A single phrase search result, augmented with a relevance score. */
export interface SearchResult {
  phrase: Phrase;
  score: number;    // 0–1, higher = more relevant
  matchType: 'vector' | 'fts' | 'combined';
}

/** The current query state driving a search. */
export interface SearchQuery {
  text: string;
  tagIds: string[];       // Filter: only phrases that have ALL of these tags
  emotions: Emotion[];    // Filter: only phrases with one of these emotions
  mode: 'smart' | 'exact'; // "smart" = TF-IDF ranked, "exact" = substring/FTS5
}

// ---------------------------------------------------------------------------
// Auto-suggestions (from STT transcription)
// ---------------------------------------------------------------------------

export interface AutoSuggestions {
  emotion: Emotion | null;
  tagNames: string[]; // Names of tags that appear to match the transcribed text
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

/**
 * The structure written to (and read from) the JSON export file.
 * The version field allows the importer to handle schema changes gracefully.
 */
export interface ExportBundle {
  version: number;         // Incremented whenever the export format changes
  exportedAt: string;      // ISO-8601 datetime string
  tags: Tag[];
  phrases: Omit<Phrase, 'tags'>[];  // Tags are excluded from each phrase …
  phraseTags: { phraseId: string; tagId: string }[]; // … and stored as a flat list
}

// ---------------------------------------------------------------------------
// Settings (persisted in a simple key-value table, not typed here beyond this)
// ---------------------------------------------------------------------------

export interface AppSettings {
  donationUrl: string;
}

// ---------------------------------------------------------------------------
// Audio / recording state
// ---------------------------------------------------------------------------

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';
export type PlaybackStatus  = 'idle' | 'playing'   | 'paused' | 'stopped';

export interface RecordingSession {
  status: RecordingStatus;
  durationMs: number;
  uri: string | null; // Available once recording has stopped
}
