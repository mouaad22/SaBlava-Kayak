// Wave illustration state for the language-screen "Onatge" (swell) tab.
//
// Maps the live significant wave height (metres, from the marine API) to one of
// three watercolour illustrations. The thresholds deliberately keep the
// "very rough" image rare — it only shows in genuinely rough conditions, so the
// swell tab never needlessly discourages bookings.
//
// FUTURE — worker control panel: staff will be able to pin the image by hand.
// That choice flows through `resolveWaveState(height, override)`: pass the
// stored state and it wins over the live reading; pass null/undefined for auto.
// Today the override is read from localStorage so the seam is already wired —
// swap `getWaveOverride()` for a backend/config read when the panel ships.

export const WAVE_STATES = ["calm", "moderate", "rough"];

export const WAVE_IMAGES = {
  calm:     "./assets/illustrations/WAVES/calmat.webp",
  moderate: "./assets/illustrations/WAVES/mogut.webp",
  rough:    "./assets/illustrations/WAVES/molt-mogut.webp",
};

// Significant wave height cut-offs, in metres. Below `moderate` → calm; at or
// above `rough` → very rough. Tuned for recreational sea kayaking on the Costa
// Brava, where calm summer days sit around 0.2–0.5 m.
export const WAVE_THRESHOLDS = {
  moderate: 0.6, // calmat below this — the encouraging default
  rough:    1.2, // mogut below this; molt-mogut at or above (kept rare)
};

export function waveStateFromHeight(height) {
  if (typeof height !== "number" || Number.isNaN(height)) return "calm";
  if (height >= WAVE_THRESHOLDS.rough)    return "rough";
  if (height >= WAVE_THRESHOLDS.moderate) return "moderate";
  return "calm";
}

// A valid manual override wins; anything else falls back to the live reading.
export function resolveWaveState(height, override) {
  if (typeof override === "string" && WAVE_STATES.includes(override)) {
    return override;
  }
  return waveStateFromHeight(height);
}

export function waveImageFor(height, override) {
  return WAVE_IMAGES[resolveWaveState(height, override)];
}

// Manual-override seam for the future worker control panel.
const OVERRIDE_KEY = "sa-blava.wave.override";

export function getWaveOverride() {
  try {
    return localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}
