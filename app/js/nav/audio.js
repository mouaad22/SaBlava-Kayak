// nav/audio.js — Voice cues and alert chimes for navigation.
//
// Uses Web Speech API for voice and the Audio element for the T-0 chime.
// All strings are resolved via i18n.js so cues speak the user's language.
//
// iOS notes:
//   - SpeechSynthesis must be triggered in a user-gesture handler the FIRST
//     time it's called. prime() fires an empty utterance in the modal's
//     "Comença" tap so subsequent speak() calls work reliably.
//   - Catalan (ca-ES) TTS is absent on many devices; we fall back to es-ES
//     then en-US silently (console warning only).

import { t } from "../i18n.js";

const CHIME_SRC = "./assets/alert-chime.mp3";

const VOICE_LANG_FALLBACKS = {
  ca: ["ca-ES", "es-ES", "en-US"],
  es: ["es-ES", "en-US"],
  en: ["en-US", "en-GB"],
  fr: ["fr-FR", "fr-BE", "en-US"],
};

let primedLang = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fire an empty utterance to unlock iOS audio context on the user gesture.
 * Must be called inside a user-interaction handler (e.g. modal submit).
 * @param {string} lang — current i18n language code ("ca" | "es" | "en" | "fr")
 */
export function prime(lang) {
  if (!("speechSynthesis" in window)) return;
  primedLang = lang;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/**
 * Speak a translated string via the Web Speech API.
 * @param {string} key  — i18n key (e.g. "nav.voice.t30")
 * @param {string} lang — current language code
 * @param {...any} args — optional args passed to the i18n template function
 */
export function speak(key, lang, ...args) {
  if (!("speechSynthesis" in window)) return;
  const text = t(key, ...args);
  if (!text || text === key) return; // missing key — skip silently

  const u = new SpeechSynthesisUtterance(text);
  u.volume = 1;
  u.rate   = 0.95;

  // Try to pick a matching voice; fall back gracefully.
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
    const audio = new Audio(CHIME_SRC);
    audio.volume = 0.8;
    audio.play().catch(() => {
      // Autoplay blocked — silently ignore; the visual warning still shows.
    });
  } catch {
    // Audio API unavailable — no-op.
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const fallbacks = VOICE_LANG_FALLBACKS[lang] ?? ["en-US"];
  for (const langTag of fallbacks) {
    const v = voices.find((v) => v.lang === langTag)
           ?? voices.find((v) => v.lang.startsWith(langTag.split("-")[0]));
    if (v) return v;
  }
  return null;
}
