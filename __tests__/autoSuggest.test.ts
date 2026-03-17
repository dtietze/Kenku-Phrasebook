/**
 * __tests__/autoSuggest.test.ts
 *
 * Unit tests for the auto-suggestion engine.
 */

import { detectEmotion, suggestTags } from '../src/suggest/autoSuggest';
import { Tag } from '../src/types';

const mockTags: Tag[] = [
  { id: '1', name: 'dragon', color: '#red', createdAt: '' },
  { id: '2', name: 'tavern', color: '#blue', createdAt: '' },
  { id: '3', name: 'combat', color: '#green', createdAt: '' },
];

describe('detectEmotion', () => {
  it('detects anger from angry words', () => {
    expect(detectEmotion('How dare you enter my domain!')).toBe('anger');
  });

  it('detects joy from happy words', () => {
    expect(detectEmotion('Haha, let us celebrate our victory!')).toBe('joy');
  });

  it('returns null for neutral text', () => {
    const result = detectEmotion('The door is over there.');
    // Neutral text should return null or neutral — not a strong emotion
    expect(['neutral', null]).toContain(result);
  });
});

describe('suggestTags', () => {
  it('suggests tags whose names appear in the text', () => {
    const result = suggestTags('Watch out for the dragon in the cave!', mockTags);
    expect(result.map((t) => t.name)).toContain('dragon');
  });

  it('does not suggest unrelated tags', () => {
    const result = suggestTags('The barkeep poured another round.', mockTags);
    expect(result.map((t) => t.name)).not.toContain('combat');
  });

  it('returns empty array for empty text', () => {
    expect(suggestTags('', mockTags)).toEqual([]);
  });
});
