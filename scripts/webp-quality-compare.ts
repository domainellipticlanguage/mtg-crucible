import * as fs from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderCard } from '../src';

(async () => {
  const r = await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.',
    power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
    artist: 'James Ryman',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }, { quality: 'high', format: 'png' });

  const img = await loadImage(r.frontFace);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);

  const out = '/tmp/webp-cmp';
  fs.mkdirSync(out, { recursive: true });
  for (const q of [70, 80, 90, 100]) {
    const buf = c.toBuffer('image/webp' as any, q);
    const path = `${out}/avacyn-q${q}.webp`;
    fs.writeFileSync(path, buf);
    console.log(`q=${q}: ${(buf.length / 1024).toFixed(1)} KB → ${path}`);
  }

  // Low-quality render with default webp encoder
  const low = await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.',
    power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
    artist: 'James Ryman',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }, { quality: 'low', format: 'webp' });
  const lowPath = `${out}/avacyn-low-default.webp`;
  fs.writeFileSync(lowPath, low.frontFace);
  console.log(`low quality (webp default): ${(low.frontFace.length / 1024).toFixed(1)} KB → ${lowPath}`);

  // Low rendering quality re-encoded at webp q=60
  const lowPng = await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.',
    power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
    artist: 'James Ryman',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }, { quality: 'low', format: 'png' });
  const lowImg = await loadImage(lowPng.frontFace);
  const lowC = createCanvas(lowImg.width, lowImg.height);
  lowC.getContext('2d').drawImage(lowImg, 0, 0);
  const lowQ60 = lowC.toBuffer('image/webp' as any, 60);
  const lowQ60Path = `${out}/avacyn-low-q60.webp`;
  fs.writeFileSync(lowQ60Path, lowQ60);
  console.log(`low quality (webp q=60): ${(lowQ60.length / 1024).toFixed(1)} KB → ${lowQ60Path}`);
})();
