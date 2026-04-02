import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData, ClassAbilities } from '../types';
import { FONT_HEIGHT_RATIO } from '../layout';
import { ASSETS_DIR } from '../assets-dir';
import { drawWrappedText, drawRichLine, wrapParagraphs, computeHeight } from '../text';
import { getParsedAbilities } from '../parser';

/** Measure how tall text would be at a given size without drawing. */
function measureTextHeight(
  ctx: SKRSContext2D,
  text: string, boxW: number, textSize: number, font = 'MPlantin',
): number {
  ctx.font = `${textSize}px "${font}"`;
  const paragraphs = text.split('\n').filter(p => p.trim());
  const lines = wrapParagraphs(ctx, paragraphs, boxW, textSize);
  return computeHeight(lines, textSize, textSize * 0.35);
}

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const pa = getParsedAbilities(card);
  const cls = pa.structuredAbilities as ClassAbilities;
  const classLevels = cls.classLevels;

  // Header divider image
  const headerPath = path.join(ASSETS_DIR, 'frames', 'class', 'header.png');
  const headerImg = fs.existsSync(headerPath) ? await loadImage(headerPath) : null;

  // Layout constants — matching CardConjurer's packClass.js / versionClass.js
  const classX = 0.5014 * cw;
  const classW = 0.422 * cw;
  const levelX = L.level.x * cw;
  const levelW = L.level.w * cw;
  const costW = 0.3967 * cw;
  const startY = L.level.y;
  const maxY = L.maxY;
  const headerGapN = L.headerGap;
  const costLabelOffset = 0.0361;
  const textSize = L.level.size * ch;
  const costSize = L.levelCost.size * ch;
  const nameSize = L.levelName.size * ch;

  const levelCount = classLevels.length;
  const headerCount = levelCount - 1;

  // Calculate space taken by reminder text + bar in level 1 (if present)
  let reminderH = 0;
  const reminderSize = textSize * 0.8;
  const barHeight = 8;
  const barSpacing = textSize * 0.5;
  const reminderText = pa.unstructuredAbilities?.join('\n');
  if (reminderText) {
    const rh = measureTextHeight(ctx, reminderText, levelW, reminderSize, 'MPlantin');
    reminderH = (rh + barHeight + barSpacing * 2) / ch;
  }

  // Total normalized space consumed by headers and reminder
  const headerSpace = headerCount * headerGapN;
  const availableN = maxY - startY - headerSpace - reminderH;

  // Measure each level's natural text height
  const naturalHeights = classLevels.map(level =>
    measureTextHeight(ctx, level.text, levelW, textSize),
  );
  const totalNatural = naturalHeights.reduce((a, b) => a + b, 0);

  // Allocate height proportionally
  const levelHeights = naturalHeights.map(h =>
    totalNatural > 0 ? (h / totalNatural) * availableN : availableN / levelCount,
  );

  // Walk through levels
  let lastY = startY;

  for (let i = 0; i < levelCount; i++) {
    const level = classLevels[i];

    // Level 1: render unstructured abilities (reminder text in italic, rest in regular) + bar
    if (i === 0 && reminderText) {
      const reminderResult = drawWrappedText(
        ctx, reminderText,
        levelX, lastY * ch, levelW, reminderH * ch,
        'MPlantin', reminderSize,
      );
      const reminderUsedH = reminderResult.usedHeight || measureTextHeight(ctx, reminderText, levelW, reminderSize, 'MPlantin');

      // Horizontal bar separator
      const barY = lastY * ch + reminderUsedH + barSpacing;
      const barW = levelW * 0.85;
      const barX = levelX + (levelW - barW) / 2;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY);
      ctx.lineTo(barX + barW, barY);
      ctx.stroke();
      ctx.restore();

      lastY += reminderH;
    }

    if (i > 0) {
      // Draw header divider image above this level's text box
      if (headerImg) {
        ctx.drawImage(headerImg, classX, lastY * ch - headerGapN * ch, classW, headerGapN * ch);
      }

      // Cost label (left-aligned) and level name (right-aligned)
      const labelBaselineY = (lastY - costLabelOffset) * ch + costSize * FONT_HEIGHT_RATIO;

      // Cost — use drawRichLine so {1}{R} renders mana symbols
      ctx.font = `${costSize}px "Beleren Bold"`;
      ctx.fillStyle = 'black';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      drawRichLine(ctx, level.cost + ':', levelX, labelBaselineY, costSize);

      // Level name (right-aligned)
      const levelName = `Level ${level.level}`;
      ctx.font = `${nameSize}px "Beleren Bold"`;
      ctx.fillStyle = 'black';
      ctx.textBaseline = 'alphabetic';
      const nameW = ctx.measureText(levelName).width;
      ctx.textAlign = 'left';
      drawRichLine(ctx, levelName, levelX + costW - nameW, labelBaselineY, nameSize);
    }

    // Determine this level's text box height
    let boxH: number;
    if (i === levelCount - 1) {
      boxH = Math.max((maxY - lastY) * ch, 0.05 * ch);
    } else {
      boxH = levelHeights[i] * ch;
    }

    // Draw ability text
    drawWrappedText(ctx, level.text, levelX, lastY * ch, levelW, boxH, 'MPlantin', textSize);

    // Advance
    lastY += levelHeights[i] + headerGapN;
  }
}

export const classHooks = { body };
