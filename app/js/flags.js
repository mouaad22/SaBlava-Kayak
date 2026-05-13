// Minimal SVG flag swatches — render consistently across platforms.

export const FLAGS = {
  ca: `<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="28" height="20" fill="#FCDD09"/>
    <rect y="2.6" width="28" height="1.8" fill="#DA121A"/>
    <rect y="6.8" width="28" height="1.8" fill="#DA121A"/>
    <rect y="11" width="28" height="1.8" fill="#DA121A"/>
    <rect y="15.2" width="28" height="1.8" fill="#DA121A"/>
  </svg>`,
  es: `<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="28" height="20" fill="#C60B1E"/>
    <rect y="5" width="28" height="10" fill="#FFC400"/>
  </svg>`,
  en: `<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="28" height="20" fill="#012169"/>
    <path d="M0 0 L28 20 M28 0 L0 20" stroke="#fff" stroke-width="2.6"/>
    <path d="M0 0 L14 10 L0 20 M28 0 L14 10 L28 20" stroke="#C8102E" stroke-width="1.4"/>
    <rect x="11.5" width="5" height="20" fill="#fff"/>
    <rect y="7.5" width="28" height="5" fill="#fff"/>
    <rect x="13" width="2" height="20" fill="#C8102E"/>
    <rect y="9" width="28" height="2" fill="#C8102E"/>
  </svg>`,
  fr: `<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="9.33" height="20" fill="#0055A4"/>
    <rect x="9.33" width="9.34" height="20" fill="#FFFFFF"/>
    <rect x="18.67" width="9.33" height="20" fill="#EF4135"/>
  </svg>`,
};
