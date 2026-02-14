import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/text';
import { parseManaString } from '../src/symbols';

describe('tokenize', () => {
  it('returns plain text as a single token', () => {
    expect(tokenize('Hello world')).toEqual([
      { type: 'text', value: 'Hello world' },
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
      { type: 'text', value: ': Add ' },
      { type: 'symbol', value: 'C' },
      { type: 'symbol', value: 'C' },
      { type: 'text', value: '.' },
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
      { type: 'text', value: 'some ' },
      { type: 'text', value: '{broken' },
    ]);
  });

  it('handles text before and after symbols', () => {
    expect(tokenize('Pay {1}{G/P}, {T}, Sacrifice')).toEqual([
      { type: 'text', value: 'Pay ' },
      { type: 'symbol', value: '1' },
      { type: 'symbol', value: 'G/P' },
      { type: 'text', value: ', ' },
      { type: 'symbol', value: 'T' },
      { type: 'text', value: ', Sacrifice' },
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
