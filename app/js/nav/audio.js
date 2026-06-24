// nav/audio.js — Voice cues and alert chimes for navigation.
//
// Uses Web Speech API for voice and the Audio element for chimes.
// All strings are resolved via i18n.js so cues speak the user's language.
//
// Arrival moment (announceArrival):
//   chime rings → once it finishes, a warm "you've arrived at <POI>" line is
//   spoken. The two beats never overlap, which is what makes it feel like a
//   friendly guide rather than a robot reading coordinates.
//
// Alert delivery (Phase 2.1, session-4):
//   Voice + chime + an in-app banner only reach a paddler who is LOOKING at the
//   screen. To also reach a hidden/pocketed phone we add two best-effort
//   channels alongside (never instead of) the foreground ones:
//     - notify(): a system notification, preferring registration.showNotification
//       so it survives a backgrounded/locked page where a service worker is
//       active. Permission is asked ONCE, on the start gesture (prime()).
//     - vibrate(): a tactile buzz for the alerts that matter most.
//   Both no-op gracefully where unsupported — notably iOS Safari (non-PWA) has
//   no Web Notifications and may ignore vibrate; those limits are documented for
//   the user via the trip-start advisory in navigate.js.
//
// iOS notes:
//   - SpeechSynthesis must be triggered in a user-gesture handler the FIRST
//     time it's called. prime() fires a silent utterance in the start-tap.
//   - HTMLAudio likewise needs a gesture-initiated play() before it will fire
//     on its own later, so prime() also unlocks the chime element (muted).
//   - iOS drops the audio/TTS unlock after a screen-lock or long inactivity, so
//     prime() is idempotent and navigate.js re-invokes it on visibilitychange.
//   - Catalan (ca-ES) TTS is absent on many devices; we fall back to es-ES
//     then en-US silently (console warning only).

import { t } from "../i18n.js";

const ARRIVAL_CHIME_SRC = "./assets/sounds/arrived-at-poi.mp3";
const ALERT_CHIME_SRC   = "./assets/sounds/arrived-at-poi.mp3"; // T-0 reuses the same cue

const VOICE_LANG_FALLBACKS = {
  ca: ["ca-ES", "es-ES", "en-US"],
  es: ["es-ES", "en-US"],
  en: ["en-US", "en-GB"],
  fr: ["fr-FR", "fr-BE", "en-US"],
};

// Name fragments that mark a higher-quality / neural voice across platforms
// (iOS "Enhanced/Premium", Android/Chrome "Google", desktop "Natural" etc.).
const PREMIUM_VOICE_HINTS = [
  "neural", "natural", "premium", "enhanced", "google", "siri",
  // Named macOS/iOS Siri-quality voices for our four languages:
  "mónica", "monica", "paulina", "jorge", "marisol",   // es
  "montserrat", "núria", "nuria",                       // ca
  "amélie", "amelie", "thomas", "audrey", "aurelie",    // fr
  "samantha", "ava", "allison", "daniel", "serena",     // en
];

let primedLang = null;
let arrivalAudio = null; // reused element so the iOS unlock persists
let notifPermissionAsked = false; // request the Notification permission only once

// Warm up the voice list early — getVoices() is often empty until this fires.
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Unlock audio on the user gesture (start tap). Fires a silent utterance to
 * prime SpeechSynthesis and a muted chime play to prime HTMLAudio, so both can
 * fire autonomously later out on the water. Also asks for Notification
 * permission once (the start tap is a valid user gesture for the prompt).
 *
 * Idempotent and safe to re-invoke: navigate.js calls it again on
 * visibilitychange because iOS drops the audio/TTS unlock after a lock. The
 * Notification permission is only ever requested once (notifPermissionAsked).
 *
 * @param {string} lang — current i18n language code ("ca" | "es" | "en" | "fr")
 */
export function prime(lang) {
  if (lang) primedLang = lang;

  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  // Prime the chime element silently so a later .play() isn't autoplay-blocked.
  try {
    const a = getArrivalAudio();
    a.muted = true;
    a.play()
      .then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
      .catch(() => { a.muted = false; });
  } catch {
    // Audio unavailable — no-op.
  }

  requestNotificationPermission();
}

/**
 * Ask for Notification permission, at most once per page life. Called from the
 * start gesture inside prime() so the native prompt has a valid user gesture.
 * No-ops where Notifications are unsupported (iOS Safari non-PWA) or already
 * decided. Handles both the modern promise form and Safari's legacy callback.
 */
function requestNotificationPermission() {
  if (notifPermissionAsked) return;
  if (!("Notification" in window)) return;
  notifPermissionAsked = true;
  if (Notification.permission !== "default") return; // already granted/denied
  try {
    const r = Notification.requestPermission();
    if (r && typeof r.then === "function") r.catch(() => {});
  } catch {
    // Older callback-only signature or a security error — ignore.
  }
}

/**
 * Arrival cue: ring the chime, then once it finishes speak the warm,
 * localized "you've arrived at <name>" line. The voice never talks over the
 * chime — it waits for `ended` (with a timeout fallback if playback is blocked).
 * @param {string} name — POI display name, already in the user's language
 * @param {string} lang — current language code
 */
export function announceArrival(name, lang) {
  let spoken = false;
  const speakName = () => {
    if (spoken) return;
    spoken = true;
    // Warm, unhurried delivery with a touch of lift for a friendly tone.
    speak("nav.voice.arrival", lang, name, { rate: 0.92, pitch: 1.05 });
  };

  try {
    const audio = getArrivalAudio();
    audio.currentTime = 0;
    audio.volume = 0.85;
    // Fallback: if the chime can't play (blocked / unsupported), still speak.
    const fallback = setTimeout(speakName, 2200);
    audio.onended = () => { clearTimeout(fallback); speakName(); };
    audio.play().catch(() => { clearTimeout(fallback); speakName(); });
  } catch {
    speakName();
  }
}

/**
 * Speak a translated string via the Web Speech API.
 * @param {string} key  — i18n key (e.g. "nav.voice.t30")
 * @param {string} lang — current language code
 * @param {...any} args — i18n template args; a trailing { rate, pitch } object
 *                        is treated as delivery options, not a template arg.
 */
export function speak(key, lang, ...args) {
  if (!("speechSynthesis" in window)) return;

  // Pull an optional trailing options object off the args.
  let opts = {};
  if (args.length && typeof args[args.length - 1] === "object" && args[args.length - 1] !== null) {
    opts = args.pop();
  }

  const text = t(key, ...args);
  if (!text || text === key) return; // missing key — skip silently

  const u = new SpeechSynthesisUtterance(text);
  u.volume = 1;
  u.rate   = opts.rate ?? 0.95;
  u.pitch  = opts.pitch ?? 1;

  // Try to pick the best matching voice; fall back gracefully.
  const voice = pickVoice(lang);
  if (voice) {
    u.voice = voice;
    u.lang  = voice.lang;
  } else {
    const fallbacks = VOICE_LANG_FALLBACKS[lang] ?? ["en-US"];
    u.lang = fallbacks[0];
    if (!window.__sablavaVoiceWarned) {
      console.warn(`[Sa Blava] No TTS voice for lang "${lang}"; using ${u.lang}`);
      window.__sablavaVoiceWarned = true;
    }
  }

  window.speechSynthesis.cancel(); // cancel any in-flight utterance first
  window.speechSynthesis.speak(u);
}

/**
 * Play the short alert chime (used at T-0).
 */
export function chime() {
  try {
    const audio = new Audio(ALERT_CHIME_SRC);
    audio.volume = 0.8;
    audio.play().catch(() => {
      // Autoplay blocked — silently ignore; the visual warning still shows.
    });
  } catch {
    // Audio API unavailable — no-op.
  }
}

/**
 * Raise a system notification so an alert reaches a hidden/locked page. Prefers
 * the active service worker's showNotification (the only form that survives a
 * backgrounded page); falls back to the page-scoped Notification constructor.
 * No-op (returns false) when Notifications are unsupported or not granted —
 * the foreground voice/chime/banner always fire regardless, so a denial just
 * means "no background reach", never a missed alert on a visible screen.
 *
 * @param {{ title: string, body?: string, tag?: string, vibrate?: number[] }} opts
 * @returns {boolean} whether a notification was dispatched
 */
export function notify({ title, body = "", tag, vibrate: vibratePattern } = {}) {
  if (!title) return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const options = { body, tag, lang: primedLang ?? undefined, renotify: !!tag };
  // showNotification (SW) honours a vibrate pattern; the page Notification
  // constructor ignores it, so we also call navigator.vibrate at the call site.
  if (vibratePattern) options.vibrate = vibratePattern;

  try {
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => fallbackNotification(title, options));
      return true;
    }
    return fallbackNotification(title, options);
  } catch {
    return false;
  }
}

/**
 * Tactile fallback for a pocketed phone. Pattern is a navigator.vibrate
 * argument (ms, or an on/off array). No-op where unsupported (most iOS).
 * @param {number | number[]} pattern
 * @returns {boolean}
 */
export function vibrate(pattern) {
  try {
    if ("vibrate" in navigator) return navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture — ignore.
  }
  return false;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function fallbackNotification(title, options) {
  try {
    new Notification(title, options);
    return true;
  } catch {
    // Some browsers only allow showNotification (SW) and throw on the
    // constructor — degrade silently to the foreground channels.
    return false;
  }
}

function getArrivalAudio() {
  if (!arrivalAudio) {
    arrivalAudio = new Audio(ARRIVAL_CHIME_SRC);
    arrivalAudio.preload = "auto";
  }
  return arrivalAudio;
}

/**
 * Pick the most natural available voice for a language, biased toward offline
 * (localService) neural voices so it still sounds human with no signal on the
 * water. Scores candidates rather than taking the first match.
 */
function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const fallbacks = VOICE_LANG_FALLBACKS[lang] ?? ["en-US"];

  for (const langTag of fallbacks) {
    const base = langTag.split("-")[0];
    const candidates = voices.filter(
      (v) => v.lang === langTag || v.lang.replace("_", "-").startsWith(base)
    );
    if (!candidates.length) continue;

    let best = null;
    let bestScore = -Infinity;
    for (const v of candidates) {
      const name = v.name.toLowerCase();
      let score = 0;
      if (v.lang === langTag) score += 4;                    // exact regional match
      if (PREMIUM_VOICE_HINTS.some((h) => name.includes(h))) score += 3; // neural/premium
      if (v.localService) score += 2;                        // works offline
      if (v.default) score += 1;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (best) return best;
  }
  return null;
}
