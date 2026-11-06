// Builds the logo files from the approved logo (docs/brand/logo-original.jpg, on black):
//   public/brand/logo-mark.png   the symbol (ribbon, capsule, cross) on a transparent background
//   public/icons/icon-192.png, icon-512.png, maskable-512.png, favicon-48.png
// Run: npm run icons
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = new URL('../docs/brand/logo-original.jpg', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const out = (p) => new URL(`../public/${p}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(out('brand'), { recursive: true });
mkdirSync(out('icons'), { recursive: true });

// The symbol sits above the lettering; the lettering starts below this line of the original.
const SYMBOL_BOTTOM = 690;
// Anything this bright or brighter is fully opaque; darker pixels fade into the black background.
const OPAQUE_AT = 80;
const ICON_BG = { r: 255, g: 255, b: 255, alpha: 1 };

/** Turns a logo on black into the same logo on transparent, recovering the edge colors. */
async function unBlack(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const a = Math.min(1, Math.max(r, g, b) / OPAQUE_AT);
    // On black, a pixel is color × alpha: divide to get the color back.
    rgba[j] = a ? Math.min(255, Math.round(r / a)) : 0;
    rgba[j + 1] = a ? Math.min(255, Math.round(g / a)) : 0;
    rgba[j + 2] = a ? Math.min(255, Math.round(b / a)) : 0;
    rgba[j + 3] = a < 0.06 ? 0 : Math.round(a * 255);
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

const meta = await sharp(SRC).metadata();
const symbolArea = await sharp(SRC).extract({ left: 0, top: 0, width: meta.width, height: SYMBOL_BOTTOM }).toBuffer();
const mark = await sharp(await (await unBlack(symbolArea)).toBuffer()).trim({ threshold: 1 }).png().toBuffer();

await sharp(mark).resize({ height: 192 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out('brand/logo-mark.png'));

/** The symbol centred on a white square, taking `share` of its width. */
const icon = (size, share) =>
  sharp(mark)
    .resize({ width: Math.round(size * share), height: Math.round(size * share), fit: 'inside' })
    .toBuffer()
    .then((m) => sharp({ create: { width: size, height: size, channels: 4, background: ICON_BG } }).composite([{ input: m, gravity: 'centre' }]).png({ compressionLevel: 9 }));

await (await icon(192, 0.8)).toFile(out('icons/icon-192.png'));
await (await icon(512, 0.8)).toFile(out('icons/icon-512.png'));
// Maskable icons are cropped to a circle by some phones: keep the symbol inside the safe zone.
await (await icon(512, 0.6)).toFile(out('icons/maskable-512.png'));
await sharp(mark).resize({ width: 48, height: 48, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out('icons/favicon-48.png'));

console.log('logo-mark.png and icons written from docs/brand/logo-original.jpg');
