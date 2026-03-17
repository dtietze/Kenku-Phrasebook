/**
 * src/constants/emotions.ts
 *
 * Metadata for each emotion value: display label, icon name (@expo/vector-icons Ionicons),
 * and the sets of keywords that can trigger auto-suggestion from transcribed text.
 *
 * When adding a new emotion:
 *   1. Add it to the Emotion union type in src/types/index.ts
 *   2. Add an entry here
 *   3. Add a colour in Colors.emotions in src/constants/theme.ts
 */

import { Emotion } from '../types';

export interface EmotionMeta {
  label: string;
  icon: string;    // Ionicons name
  keywords: string[]; // Lower-cased keywords that suggest this emotion
}

export const EMOTION_META: Record<Emotion, EmotionMeta> = {
  neutral: {
    label: 'Neutral',
    icon: 'remove-circle-outline',
    keywords: ['okay', 'fine', 'alright', 'sure', 'whatever'],
  },
  joy: {
    label: 'Joyful',
    icon: 'happy-outline',
    keywords: [
      'laugh', 'chuckle', 'grin', 'smile', 'happy', 'joy', 'celebrate',
      'wonderful', 'fantastic', 'great', 'haha', 'wonderful', 'pleased',
    ],
  },
  sadness: {
    label: 'Sad',
    icon: 'sad-outline',
    keywords: [
      'cry', 'weep', 'sob', 'mourn', 'grief', 'sorrow', 'lost', 'alone',
      'miss', 'goodbye', 'farewell', 'heart', 'broken',
    ],
  },
  anger: {
    label: 'Angry',
    icon: 'flame-outline',
    keywords: [
      'angry', 'rage', 'furious', 'curse', 'damn', 'hell', 'hate',
      'kill', 'destroy', 'never', 'how dare', 'outrage',
    ],
  },
  fear: {
    label: 'Fearful',
    icon: 'alert-circle-outline',
    keywords: [
      'afraid', 'scared', 'terror', 'flee', 'run', 'help', 'danger',
      'monster', 'dark', 'shadow', 'please', 'mercy', 'no please',
    ],
  },
  disgust: {
    label: 'Disgusted',
    icon: 'close-circle-outline',
    keywords: [
      'disgusting', 'vile', 'filth', 'rot', 'stench', 'foul', 'awful',
      'revolting', 'nasty', 'yuck', 'gross',
    ],
  },
  surprise: {
    label: 'Surprised',
    icon: 'radio-button-on-outline',
    keywords: [
      'what', 'impossible', 'unbelievable', 'no way', 'really', 'truly',
      'oh', 'ah', 'wow', 'shock', 'unexpected',
    ],
  },
  contempt: {
    label: 'Contemptuous',
    icon: 'eye-off-outline',
    keywords: [
      'fool', 'idiot', 'pathetic', 'worthless', 'beneath', 'lesser',
      'inferior', 'weak', 'peasant', 'commoner', 'pity',
    ],
  },
  excitement: {
    label: 'Excited',
    icon: 'star-outline',
    keywords: [
      'adventure', 'quest', 'treasure', 'battle', 'glory', 'victory',
      'yes', 'let us', 'onward', 'charge', 'ready',
    ],
  },
  confusion: {
    label: 'Confused',
    icon: 'help-circle-outline',
    keywords: [
      'what do you', 'I do not understand', 'unclear', 'confusing',
      'huh', 'pardon', 'excuse me', 'how', 'why', 'which',
    ],
  },
};

/** All emotion values in display order. */
export const ALL_EMOTIONS: Emotion[] = Object.keys(EMOTION_META) as Emotion[];
