/**
 * Rasterize assets/brand/logo-mark.svg into Expo app.json PNG assets.
 *
 * Launcher + splash composites use the same accent bloom gradient edge-to-edge; the SVG
 * leaves transparent corners so the backdrop shows through (no charcoal “tile” halo).
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

/* Keep synced with palette.accent / palette.accentBloom in constants/theme.ts */
const ACCENT_HEX = '#4f76c2';
const ACCENT_BLOOM_HEX = '#4da89b';

const gradientPlateSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="si_plate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ACCENT_HEX}" />
      <stop offset="100%" stop-color="${ACCENT_BLOOM_HEX}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#si_plate)" />
</svg>`;

async function rasterPlatePng(px) {
  return sharp(Buffer.from(gradientPlateSvg(px)), { density: 72 }).png().toBuffer();
}

async function main() {
  const svgBuf = await readFile(path.join(BRAND_DIR, 'logo-mark.svg'));

  await mkdir(OUT_DIR, { recursive: true });

  const gradient1024 = await rasterPlatePng(1024);

  function rasterMark({ size }) {
    return sharp(svgBuf, { density: 576 }).resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 });
  }

  async function png1024OnBrandGradient(markSizePx) {
    const center = await rasterMark({ size: markSizePx }).png().toBuffer();
    return sharp(gradient1024).composite([{ input: center, gravity: 'centre' }]).png();
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

  const iconPipe = await png1024OnBrandGradient(790);
  await iconPipe.toFile(path.join(OUT_DIR, 'icon.png'));

  const splashPipe = await png1024OnBrandGradient(760);
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
