/**
 * __tests__/tfidf.test.ts
 *
 * Unit tests for the TF-IDF engine.
 * These run in Node via Jest — no React Native or Expo dependencies.
 */

import { computeTf, computeIdf, computeTfidfWeights, cosineSimilarity, rankDocuments } from '../src/search/tfidf';
import { tokenize } from '../src/search/tokenizer';

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('lowercases and removes punctuation', () => {
    expect(tokenize('Hello, World!')).toEqual(expect.arrayContaining(['hello', 'world']));
  });

  it('removes stop words', () => {
    const tokens = tokenize('The dragon roared at the adventurers');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('at');
    expect(tokens).toContain('dragon');
  });

  it('returns empty array for blank input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeTf
// ---------------------------------------------------------------------------

describe('computeTf', () => {
  it('computes correct TF values', () => {
    const tokens = ['dragon', 'dragon', 'fire'];
    const tf = computeTf(tokens);
    expect(tf.get('dragon')).toBeCloseTo(2 / 3);
    expect(tf.get('fire')).toBeCloseTo(1 / 3);
  });

  it('returns empty map for empty token list', () => {
    expect(computeTf([])).toEqual(new Map());
  });
});

// ---------------------------------------------------------------------------
// computeIdf
// ---------------------------------------------------------------------------

describe('computeIdf', () => {
  it('gives higher IDF to rare terms', () => {
    const idfRare   = computeIdf(100, 1);
    const idfCommon = computeIdf(100, 90);
    expect(idfRare).toBeGreaterThan(idfCommon);
  });

  it('handles N = 0 gracefully', () => {
    expect(computeIdf(0, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = new Map([['a', 0.5], ['b', 0.5]]);
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Map([['apple', 1]]);
    const b = new Map([['dragon', 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('handles empty vectors', () => {
    expect(cosineSimilarity(new Map(), new Map([['x', 1]]))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rankDocuments
// ---------------------------------------------------------------------------

describe('rankDocuments', () => {
  it('ranks more relevant documents higher', () => {
    const candidates = [
      {
        phraseId: 'p1',
        termTf: new Map([['dragon', 0.8], ['fire', 0.2]]),
      },
      {
        phraseId: 'p2',
        termTf: new Map([['tavern', 0.9], ['ale', 0.1]]),
      },
    ];

    const dfMap = new Map([['dragon', 1], ['fire', 1], ['tavern', 1], ['ale', 1]]);
    const queryTokens = ['dragon'];

    const results = rankDocuments(queryTokens, candidates, 2, dfMap);

    expect(results[0].phraseId).toBe('p1');
    expect(results[0].score).toBeGreaterThan(0);
    // p2 should not appear (no shared terms)
    expect(results.find((r) => r.phraseId === 'p2')).toBeUndefined();
  });

  it('returns empty array for empty query', () => {
    expect(rankDocuments([], [], 0, new Map())).toEqual([]);
  });
});
