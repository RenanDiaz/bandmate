// Generates Bandmate app icons (Concept A — Pick + Monograma) from SVG.
// Run with: node scripts/generate-icons.mjs   (requires `sharp`)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const PICK = 'M32 7 C47 7 55 16 55 28 C55 43 40 53 32 57 C24 53 9 43 9 28 C9 16 17 7 32 7 Z';

// App-icon treatment: full-bleed dark gradient background with the purple pick +
// white "B" centered at ~62% (inside the maskable safe zone).
function appIconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d1d22"/>
      <stop offset="1" stop-color="#0a0a0b"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#bg)"/>
  <g transform="translate(32 32) scale(0.62) translate(-32 -32)">
    <path d="${PICK}" fill="#8B5CF6"/>
    <text x="32" y="43" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="30" fill="#FFFFFF">B</text>
  </g>
</svg>`;
}

const targets = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of targets) {
  const svg = Buffer.from(appIconSVG(size));
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(publicDir, name));
  console.log(`wrote public/${name} (${size}x${size})`);
}
