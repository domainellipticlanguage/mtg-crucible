import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData, ClassAbilities } from '../types';
import { PW_W, PW_H, CLASS_LAYOUT, ASSETS_DIR, FONT_HEIGHT_RATIO } from '../layout';
import { drawArt, drawCorners, drawSetSymbol, drawBottomInfo, drawManaCost, getTypeLine, frameColorCode, drawColorIndicator, drawFrame } from '../helpers';
import { drawSingleLineText, drawWrappedText, drawRichLine, wrapParagraphs, computeHeight } from '../text';

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

export async function renderClass(card: CardData): Promise<Buffer> {
  const cw = PW_W, ch = PW_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = CLASS_LAYOUT;
  const fc = frameColorCode(card.frameColor);
  const cls = card.structuredAbilities as ClassAbilities;
  const classLevels = cls.classLevels;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art (left side)
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame (with accent compositing for colored lands/artifacts)
  await drawFrame(ctx, 'class', card.frameColor, card.accentColor, cw, ch);

  // Header divider image
  const headerPath = path.join(ASSETS_DIR, 'frames', 'class', 'header.png');
  const headerImg = fs.existsSync(headerPath) ? await loadImage(headerPath) : null;

  // Layout constants — matching CardConjurer's packClass.js / versionClass.js
  const classX = 0.5014 * cw;            // header/divider x (card.class.x)
  const classW = 0.422 * cw;             // header/divider width (card.class.width)
  const levelX = L.level.x * cw;         // text x (0.5093)
  const levelW = L.level.w * cw;         // text width (0.404)
  const costW = 0.3967 * cw;             // cost/name width
  const startY = L.level.y;              // normalized start (0.1129)
  const maxY = L.maxY;                   // normalized end (0.8368)
  const headerGapN = L.headerGap;        // normalized header gap (0.0481)
  const costLabelOffset = 0.0361;        // cost/name sit this far above text y
  const textSize = L.level.size * ch;
  const costSize = L.levelCost.size * ch;
  const nameSize = L.levelName.size * ch;

  const levelCount = classLevels.length;
  const headerCount = levelCount - 1;

  // Calculate space taken by reminder text + bar in level 1 (if present)
  let reminderH = 0; // normalized
  const reminderSize = textSize * 0.8; // smaller than ability text
  const barHeight = 8; // pixels
  const barSpacing = textSize * 0.5; // pixels
  if (card.unstructuredAbilities) {
    const rh = measureTextHeight(ctx, card.unstructuredAbilities, levelW, reminderSize, 'MPlantin Italic');
    reminderH = (rh + barHeight + barSpacing * 2) / ch;
  }

  // Total normalized space consumed by headers and reminder
  const headerSpace = headerCount * headerGapN;
  const availableN = maxY - startY - headerSpace - reminderH;

  // Measure each level's natural text height at base size to determine proportional allocation
  const naturalHeights = classLevels.map(level =>
    measureTextHeight(ctx, level.text, levelW, textSize),
  );
  const totalNatural = naturalHeights.reduce((a, b) => a + b, 0);

  // Allocate height proportionally (normalized coordinates)
  const levelHeights = naturalHeights.map(h =>
    totalNatural > 0 ? (h / totalNatural) * availableN : availableN / levelCount,
  );

  // Walk through levels, positioning per CardConjurer's classEdited() algorithm
  let lastY = startY; // normalized

  for (let i = 0; i < levelCount; i++) {
    const level = classLevels[i];

    // Level 1: render reminder text + bar before the ability text
    if (i === 0 && card.unstructuredAbilities) {
      const reminderResult = drawWrappedText(
        ctx, card.unstructuredAbilities,
        levelX, lastY * ch, levelW, reminderH * ch,
        'MPlantin Italic', reminderSize,
        { fontFamily: 'MPlantin Italic' },
      );
      const reminderUsedH = reminderResult.usedHeight || measureTextHeight(ctx, card.unstructuredAbilities, levelW, reminderSize, 'MPlantin Italic');

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
      // Positioned at lastY - costLabelOffset
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
      // Last level fills remaining space to maxY
      boxH = Math.max((maxY - lastY) * ch, 0.05 * ch);
    } else {
      boxH = levelHeights[i] * ch;
    }

    // Draw ability text
    drawWrappedText(ctx, level.text, levelX, lastY * ch, levelW, boxH, 'MPlantin', textSize);

    // Advance: height + headerGap
    lastY += levelHeights[i] + headerGapN;
  }

  // Name, mana, type
  drawSingleLineText(ctx, card.name ?? '', L.name.x * cw, L.name.y * ch, L.name.w * cw, L.name.h * ch, L.name.font, L.name.size * ch);
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);
  const clsTypeX = L.type.x * cw, clsTypeY = L.type.y * ch, clsTypeH = L.type.h * ch;
  const clsIndOff = drawColorIndicator(ctx, card.colorIndicator, clsTypeX, clsTypeY, clsTypeH);
  drawSingleLineText(ctx, getTypeLine(card), clsTypeX + clsIndOff, clsTypeY, L.type.w * cw - clsIndOff, clsTypeH, L.type.font, L.type.size * ch);

  // Set symbol
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
