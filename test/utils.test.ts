import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/text';
import { parseManaString } from '../src/symbols';

describe('tokenize', () => {
  it('returns plain text as a single token', () => {
    expect(tokenize('Hello world')).toEqual([
      { type: 'text', value: 'Hello world', italic: false },
    ]);
  });

  it('parses a single symbol', () => {
    expect(tokenize('{T}')).toEqual([
      { type: 'symbol', value: 'T' },
    ]);
  });

  it('parses text with inline symbols', () => {
    expect(tokenize('{T}: Add {C}{C}.')).toEqual([
      { type: 'symbol', value: 'T' },
      { type: 'text', value: ': Add ', italic: false },
      { type: 'symbol', value: 'C' },
      { type: 'symbol', value: 'C' },
      { type: 'text', value: '.', italic: false },
    ]);
  });

  it('parses hybrid/phyrexian mana symbols', () => {
    expect(tokenize('{G/P}')).toEqual([
      { type: 'symbol', value: 'G/P' },
    ]);
  });

  it('handles empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('handles unclosed brace as text', () => {
    expect(tokenize('some {broken')).toEqual([
      { type: 'text', value: 'some ', italic: false },
      { type: 'text', value: '{broken', italic: false },
    ]);
  });

  it('handles text before and after symbols', () => {
    expect(tokenize('Pay {1}{G/P}, {T}, Sacrifice')).toEqual([
      { type: 'text', value: 'Pay ', italic: false },
      { type: 'symbol', value: '1' },
      { type: 'symbol', value: 'G/P' },
      { type: 'text', value: ', ', italic: false },
      { type: 'symbol', value: 'T' },
      { type: 'text', value: ', Sacrifice', italic: false },
    ]);
  });

  it('marks parenthesized text as italic', () => {
    expect(tokenize('Flying (This creature can fly.)')).toEqual([
      { type: 'text', value: 'Flying ', italic: false },
      { type: 'text', value: '(This creature can fly.)', italic: true },
    ]);
  });

  it('handles symbols inside parenthesized text', () => {
    expect(tokenize('(Pay {2}.)')).toEqual([
      { type: 'text', value: '(Pay ', italic: true },
      { type: 'symbol', value: '2' },
      { type: 'text', value: '.)', italic: true },
    ]);
  });
});

describe('parseManaString', () => {
  it('parses simple mana cost', () => {
    expect(parseManaString('{R}')).toEqual(['R']);
  });

  it('parses multi-symbol mana cost', () => {
    expect(parseManaString('{2}{W}{W}')).toEqual(['2', 'W', 'W']);
  });

  it('parses hybrid mana', () => {
    expect(parseManaString('{3}{G/P}')).toEqual(['3', 'G/P']);
  });

  it('returns empty array for no mana', () => {
    expect(parseManaString('')).toEqual([]);
  });

  it('returns empty array for text without braces', () => {
    expect(parseManaString('no mana here')).toEqual([]);
  });

  it('parses large mana cost', () => {
    expect(parseManaString('{5}{U}{R}{G}')).toEqual(['5', 'U', 'R', 'G']);
  });
});
