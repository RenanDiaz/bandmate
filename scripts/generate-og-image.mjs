// Generates the 1200x630 social card used by og:image / twitter:image.
// Run with: npm run og   (requires `sharp`)
//
// Declaring `twitter:card=summary_large_image` without an image is what makes
// link previews collapse to the small card, so this asset is not optional.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const WIDTH = 1200;
const HEIGHT = 630;

const PICK = 'M32 7 C47 7 55 16 55 28 C55 43 40 53 32 57 C24 53 9 43 9 28 C9 16 17 7 32 7 Z';
const SANS = "'Space Grotesk', 'DejaVu Sans', 'Helvetica', sans-serif";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#18181B"/>
      <stop offset="1" stop-color="#0A0A0B"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.12" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
    <mask id="monogram">
      <rect x="0" y="0" width="64" height="64" fill="#fff"/>
      <text x="32" y="43" text-anchor="middle" font-family="${SANS}"
            font-weight="700" font-size="30" fill="#000">B</text>
    </mask>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <!-- Brand lockup -->
  <g transform="translate(80 72)">
    <g transform="scale(1.15)">
      <path d="${PICK}" fill="#8B5CF6" mask="url(#monogram)"/>
    </g>
    <text x="96" y="52" font-family="${SANS}" font-weight="700" font-size="42" fill="#FAFAFA"
          letter-spacing="-1">Bandmate</text>
  </g>

  <!-- Headline -->
  <text x="80" y="320" font-family="${SANS}" font-weight="700" font-size="66" fill="#FAFAFA"
        letter-spacing="-2">The setlist stops living</text>
  <text x="80" y="396" font-family="${SANS}" font-weight="700" font-size="66" fill="#FAFAFA"
        letter-spacing="-2">in the group chat.</text>

  <!-- Supporting line -->
  <text x="80" y="466" font-family="${SANS}" font-weight="500" font-size="30" fill="#A1A1AA">
    Repertoire · Setlists · Rehearsals · Shows
  </text>

  <!-- Footer rule + domain -->
  <rect x="80" y="524" width="120" height="4" rx="2" fill="#8B5CF6"/>
  <text x="80" y="576" font-family="${SANS}" font-weight="500" font-size="26" fill="#71717A">
    bandmate.space
  </text>
</svg>`;

await sharp(Buffer.from(svg), { density: 144 })
  .resize(WIDTH, HEIGHT)
  .flatten({ background: '#0a0a0b' })
  .png()
  .toFile(join(publicDir, 'og-image.png'));

console.log(`wrote public/og-image.png (${WIDTH}x${HEIGHT})`);
