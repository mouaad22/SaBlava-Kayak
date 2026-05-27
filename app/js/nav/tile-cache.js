// nav/tile-cache.js — Pre-cache Mapbox tiles for offline navigation.
//
// Enumerates XYZ tiles covering the route's bounding box at zoom levels
// TILE_CACHE_ZOOM_MIN..TILE_CACHE_ZOOM_MAX, fetches each tile URL,
// and stores responses in the Service Worker's Cache Storage.
//
// The Service Worker (app/sw.js) must be registered first; it intercepts
// api.mapbox.com requests and serves cached responses when offline.
//
// Mapbox standard terms allow ephemeral browser-side caching for a single
// user session. We are not redistributing tiles — this is local caching only.

import {
  MAPBOX_TOKEN,
  MAPBOX_STYLE,
  TILE_CACHE_ZOOM_MIN,
  TILE_CACHE_ZOOM_MAX,
} from "../config.js";

const CACHE_NAME = "sablava-tiles-v1";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pre-cache all Mapbox tiles for the given bounding box.
 *
 * @param {[number, number, number, number]} bbox — [minLon, minLat, maxLon, maxLat]
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{ total: number, cached: number }>}
 */
export async function precacheBbox(bbox, onProgress) {
  const urls = buildTileUrls(bbox, TILE_CACHE_ZOOM_MIN, TILE_CACHE_ZOOM_MAX);
  const total = urls.length;
  let done = 0;

  // Open (or create) the named cache.
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (e) {
    console.warn("[Sa Blava] Cache Storage unavailable — skipping tile pre-cache", e);
    return { total, cached: 0 };
  }

  // Fetch in batches of 8 to avoid overwhelming the network.
  const BATCH = 8;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (url) => {
        try {
          // Short-circuit if already in cache (idempotent).
          const existing = await cache.match(url);
          if (existing) {
            done++;
            onProgress?.(done, total);
            return;
          }
          const res = await fetch(url, { mode: "cors" });
          if (res.ok) {
            await cache.put(url, res.clone());
          }
        } catch {
          // Network error for individual tile — skip silently.
        }
        done++;
        onProgress?.(done, total);
      })
    );
  }

  return { total, cached: done };
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Build all tile URLs for a bounding box across a range of zoom levels.
 */
function buildTileUrls([minLon, minLat, maxLon, maxLat], zoomMin, zoomMax) {
  const urls = [];
  for (let z = zoomMin; z <= zoomMax; z++) {
    const [xMin, yMax] = lonLatToTile(minLon, minLat, z); // SW corner
    const [xMax, yMin] = lonLatToTile(maxLon, maxLat, z); // NE corner
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(tileUrl(z, x, y));
      }
    }
  }
  return urls;
}

/**
 * Convert lon/lat to slippy-map tile coordinates at a given zoom.
 * @returns {[number, number]} [x, y]
 */
function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return [x, y];
}

/**
 * Build the Mapbox raster tile URL for a given z/x/y.
 * Uses the vector tile endpoint; style derived from MAPBOX_STYLE.
 */
function tileUrl(z, x, y) {
  // Extract style ID from the mapbox:// URI (e.g. "mapbox/outdoors-v12").
  const styleId = MAPBOX_STYLE.replace("mapbox://styles/", "");
  // Mapbox Static Tiles API (raster):
  return `https://api.mapbox.com/styles/v1/${styleId}/tiles/256/${z}/${x}/${y}?access_token=${MAPBOX_TOKEN}`;
}
