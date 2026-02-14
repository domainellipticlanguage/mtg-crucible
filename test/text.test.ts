import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';
import { computeHeight, wrapParagraphs, measureRichText } from '../src/text';

const ASSETS = path.resolve(__dirname, '..', 'assets');

beforeAll(() => {
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'mplantin.ttf'), 'MPlantin');
});

describe('computeHeight', () => {
  it('returns textSize for a single line', () => {
    expect(computeHeight([{ paraStart: false }], 24, 8)).toBe(24);
  });

  it('adds textSize per additional line', () => {
    const lines = [{ paraStart: false }, { paraStart: false }, { paraStart: false }];
    expect(computeHeight(lines, 24, 8)).toBe(72); // 24 + 24 + 24
  });

  it('adds paraSpacing for paragraph breaks', () => {
    const lines = [
      { paraStart: false },
      { paraStart: false },
      { paraStart: true },  // new paragraph
      { paraStart: false },
    ];
    expect(computeHeight(lines, 24, 8)).toBe(104); // 24 + 24 + (24+8) + 24
  });
});

describe('wrapParagraphs', () => {
  it('wraps long text into multiple lines', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px "MPlantin"';
    const lines = wrapParagraphs(ctx, ['This is a very long paragraph that should wrap onto multiple lines.'], 200, 24);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].paraStart).toBe(false);
  });

  it('marks paragraph starts correctly', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px "MPlantin"';
    const lines = wrapParagraphs(ctx, ['First paragraph.', 'Second paragraph.'], 400, 24);
    expect(lines.length).toBe(2);
    expect(lines[0].paraStart).toBe(false);
    expect(lines[1].paraStart).toBe(true);
  });

  it('handles single short paragraph', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px "MPlantin"';
    const lines = wrapParagraphs(ctx, ['Short.'], 400, 24);
    expect(lines).toEqual([{ text: 'Short.', paraStart: false }]);
  });
});

describe('measureRichText', () => {
  it('measures plain text same as measureText', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px "MPlantin"';
    const richWidth = measureRichText(ctx, 'Hello', 24);
    const plainWidth = ctx.measureText('Hello').width;
    expect(richWidth).toBe(plainWidth);
  });

  it('measures text with symbols wider than plain text alone', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px "MPlantin"';
    const withSymbol = measureRichText(ctx, '{T}: Add', 24);
    const withoutSymbol = measureRichText(ctx, ': Add', 24);
    expect(withSymbol).toBeGreaterThan(withoutSymbol);
  });
});
