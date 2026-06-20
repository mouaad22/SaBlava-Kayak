// Convert referenced raster assets to WebP with Bun.Image.
//   • All .jpg/.jpeg under app/assets  -> WebP
//   • The two route illustration PNGs   -> WebP
//   • The WAVES/*.png swell illustrations -> WebP (2048px sources, never
//     shown larger than the ~708px weather panel before they become wave.riv)
//   • Skipped: PWA manifest icons, .svg/.riv vectors
// Photos cap at 1600px long edge (q80); illustrated maps at 2200px (q82) since
// they're pannable. Originals are deleted here but remain in git history.
import { readdir, stat, unlink } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = "app/assets";
const MAP_PREFIX = "app/assets/illustrations/mapa-ruta";
const KEEP_PNG = new Set(["app/assets/icon-192.png", "app/assets/icon-512.png"]);
const ROUTE_PNG_RE = /\/(ruta-sud|ruta-nord)\/(ruta-sud|ruta-nord)\.png$/;
const WAVES_PNG_RE = /\/illustrations\/WAVES\/[^/]+\.png$/;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function shouldConvert(norm) {
  const ext = extname(norm).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return true;
  if (ext === ".png") return !KEEP_PNG.has(norm) && (ROUTE_PNG_RE.test(norm) || WAVES_PNG_RE.test(norm));
  return false;
}

let before = 0, after = 0, count = 0;
for await (const raw of walk(ROOT)) {
  const norm = raw.replaceAll("\\", "/");
  if (!shouldConvert(norm)) continue;
  const isMap = norm.startsWith(MAP_PREFIX);
  const cap = isMap ? 2200 : 1600;
  const quality = isMap ? 82 : 80;
  const out = raw.replace(/\.(jpe?g|png)$/i, ".webp");
  const sz = (await stat(raw)).size;
  const wrote = await Bun.file(raw)
    .image()
    .resize(cap, cap, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .write(out);
  await unlink(raw);
  before += sz; after += wrote; count++;
  console.log(`${(sz / 1048576).toFixed(2)}MB -> ${(wrote / 1048576).toFixed(2)}MB  ${out}`);
}
console.log(`\n${count} images: ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB`);
