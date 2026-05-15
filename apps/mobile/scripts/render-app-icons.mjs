/**
 * Rasterize assets/brand/logo-mark.svg into Expo app.json PNG assets.
 *
 * Full-bleed plates use OLED black (palette.mist) so icons match signup / fluorescent launch.
 * The mark carries mint–sky–pink rim + hub strokes; adaptive foreground stays transparent-backed.
 *
 * Requires: npm run generate:icons (sharp)
 */
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BRAND_DIR = path.join(ROOT, 'assets', 'brand');
const OUT_DIR = path.join(ROOT, 'assets', 'images');

/** Synced with palette.mist — Expo splash + adaptive background */
const OLED_PLATE_HEX = '#000000';

const oledPlateSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${OLED_PLATE_HEX}" />
</svg>`;

async function rasterPlatePng(px) {
  return sharp(Buffer.from(oledPlateSvg(px)), { density: 72 }).png().toBuffer();
}

async function main() {
  const svgBuf = await readFile(path.join(BRAND_DIR, 'logo-mark.svg'));

  await mkdir(OUT_DIR, { recursive: true });

  const plate1024 = await rasterPlatePng(1024);

  function rasterMark({ size }) {
    return sharp(svgBuf, { density: 576 }).resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 });
  }

  async function png1024OnOled(markSizePx) {
    const center = await rasterMark({ size: markSizePx }).png().toBuffer();
    return sharp(plate1024).composite([{ input: center, gravity: 'centre' }]).png();
  }

  async function png1024Transparent(markSizePx) {
    const center = await rasterMark({ size: markSizePx }).png().toBuffer();
    return sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: center, gravity: 'centre' }])
      .png();
  }

  const iconPipe = await png1024OnOled(790);
  await iconPipe.toFile(path.join(OUT_DIR, 'icon.png'));

  const splashPipe = await png1024OnOled(760);
  await splashPipe.toFile(path.join(OUT_DIR, 'splash-icon.png'));

  const adaptivePipe = await png1024Transparent(668);
  await adaptivePipe.toFile(path.join(OUT_DIR, 'adaptive-icon.png'));

  const favPlateBuf = await rasterPlatePng(96);
  const favFg = await rasterMark({ size: 72 }).png().toBuffer();
  await sharp(favPlateBuf).composite([{ input: favFg, gravity: 'centre' }]).png().toFile(path.join(OUT_DIR, 'favicon.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
