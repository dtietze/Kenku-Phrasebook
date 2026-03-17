/**
 * src/suggest/autoSuggest.ts
 *
 * Analyses transcribed text and suggests:
 *   - An emotion (from the emotion keyword map in constants/emotions.ts)
 *   - Tags that exist in the database and are semantically related to the text
 *
 * All processing is local and synchronous — no network calls.
 * Suggestions are hints only; the user always has the final say.
 */

import { Emotion, Tag, AutoSuggestions } from '../types';
import { EMOTION_META } from '../constants/emotions';
import { tokenize } from '../search/tokenizer';

// ---------------------------------------------------------------------------
// Emotion detection
// ---------------------------------------------------------------------------

/**
 * Score each emotion by counting how many of its keywords appear in the text.
 * Returns the highest-scoring emotion, or null if nothing stands out.
 *
 * @param text  Raw transcribed or manually entered phrase text
 */
export function detectEmotion(text: string): Emotion | null {
  const lowerText = text.toLowerCase();
  let bestEmotion: Emotion | null = null;
  let bestScore = 0;

  for (const [emotion, meta] of Object.entries(EMOTION_META) as [Emotion, typeof EMOTION_META[Emotion]][]) {
    let score = 0;
    for (const keyword of meta.keywords) {
      if (lowerText.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore  = score;
      bestEmotion = emotion;
    }
  }

  // Require at least one keyword match to suggest an emotion
  return bestScore > 0 ? bestEmotion : null;
}

// ---------------------------------------------------------------------------
// Tag suggestion
// ---------------------------------------------------------------------------

/**
 * Given the transcribed text and the user's existing tags, suggest tags
 * whose names appear (as stems) in the tokenised text.
 *
 * @param text         Transcribed phrase text
 * @param existingTags All tags from the database
 */
export function suggestTags(text: string, existingTags: Tag[]): Tag[] {
  const tokens = new Set(tokenize(text));
  if (tokens.size === 0) return [];

  return existingTags.filter((tag) => {
    // Tokenise the tag name and check if any of its tokens appear in the phrase
    const tagTokens = tokenize(tag.name);
    return tagTokens.some((t) => tokens.has(t));
  });
}

// ---------------------------------------------------------------------------
// Combined suggestion entry point
// ---------------------------------------------------------------------------

/**
 * Generate emotion and tag suggestions for a piece of transcribed text.
 *
 * @param text         The transcribed (or typed) phrase text
 * @param existingTags All tags currently in the user's database
 */
export function generateSuggestions(
  text: string,
  existingTags: Tag[]
): AutoSuggestions {
  return {
    emotion:  detectEmotion(text),
    tagNames: suggestTags(text, existingTags).map((t) => t.name),
  };
}
