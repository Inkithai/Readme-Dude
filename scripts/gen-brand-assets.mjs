/**
 * Regenerates the raster brand assets from their SVG sources in `public/`.
 *
 *   public/mark.svg   → mark-192.png, mark-512.png, apple-touch-icon.png
 *   public/og.svg     → og-image.png          (README hero + social card)
 *
 * The PNGs are committed, so this script is only needed when the logo changes.
 * It is deliberately NOT a build step: it needs a rasteriser (librsvg via sharp)
 * and a real font file for `og.svg`'s <text>, which a CI image may not carry.
 *
 *   npm i --no-save sharp @expo-google-fonts/inter
 *   FONTCONFIG_FILE=<see below> node scripts/gen-brand-assets.mjs
 *
 * `og.svg` sets font-family="Inter"; without the font installed, librsvg renders
 * the text blank. Point fontconfig at a directory of TTFs to embed them (a glob cannot be written here because it would close this comment):
 *
 *   mkdir -p /tmp/fonts && cp node_modules/@expo-google-fonts/inter/<weight>/Inter_<weight>.ttf /tmp/fonts
 *   printf '<fontconfig><dir>/tmp/fonts</dir><cachedir>/tmp/fc</cachedir></fontconfig>' > /tmp/fc.conf
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("sharp is not installed — run: npm i --no-save sharp");
  process.exit(1);
}

/** Sizes the app actually links to; keep this list in sync with index.html + manifest. */
const MARK_SIZES = [
  ["mark-192.png", 192],
  ["mark-512.png", 512],
  ["apple-touch-icon.png", 180],
];

const mark = readFileSync(join(publicDir, "mark.svg"));
for (const [file, size] of MARK_SIZES) {
  await sharp(mark, { density: 600 }).resize(size, size).png().toFile(join(publicDir, file));
}

/**
 * Palette-quantised: the banner is flat colour plus one radial glow, so 256
 * colours with dithering halves the file with no visible banding. Full-colour
 * PNG costs ~330 kB for an image that ships in a README.
 */
await sharp(readFileSync(join(publicDir, "og.svg")), { density: 150 })
  .png({ palette: true, colors: 256, quality: 92, effort: 10 })
  .toFile(join(publicDir, "og-image.png"));

const kb = (f) => (readFileSync(join(publicDir, f)).byteLength / 1024).toFixed(1);
console.log(
  `brand assets → public/: ${[...MARK_SIZES.map(([f]) => f), "og-image.png"].map((f) => `${f} ${kb(f)}kB`).join("  ")}`,
);
