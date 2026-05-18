// Circular flag SVGs (32px), matching the Paper design. clipPath ids are
// suffixed per code so multiple flags can coexist in one document.

export const FLAGS = {
  ca: `<svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="flag-ca"><circle cx="20" cy="20" r="20"/></clipPath></defs>
    <g clip-path="url(#flag-ca)">
      <rect width="40" height="40" fill="#FCDD09"/>
      <rect y="4.4" width="40" height="4.4" fill="#DA121A"/>
      <rect y="13.3" width="40" height="4.4" fill="#DA121A"/>
      <rect y="22.2" width="40" height="4.4" fill="#DA121A"/>
      <rect y="31.1" width="40" height="4.4" fill="#DA121A"/>
    </g>
  </svg>`,
  es: `<svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="flag-es"><circle cx="20" cy="20" r="20"/></clipPath></defs>
    <g clip-path="url(#flag-es)">
      <rect width="40" height="10" fill="#AA151B"/>
      <rect y="10" width="40" height="20" fill="#F1BF00"/>
      <rect y="30" width="40" height="10" fill="#AA151B"/>
    </g>
  </svg>`,
  en: `<svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="flag-en"><circle cx="20" cy="20" r="20"/></clipPath></defs>
    <g clip-path="url(#flag-en)">
      <rect width="40" height="40" fill="#012169"/>
      <path d="M0,0 L40,40 M40,0 L0,40" stroke="#FFFFFF" stroke-width="7"/>
      <path d="M0,0 L40,40 M40,0 L0,40" stroke="#C8102E" stroke-width="3"/>
      <rect x="17" width="6" height="40" fill="#FFFFFF"/>
      <rect y="17" width="40" height="6" fill="#FFFFFF"/>
      <rect x="18.5" width="3" height="40" fill="#C8102E"/>
      <rect y="18.5" width="40" height="3" fill="#C8102E"/>
    </g>
  </svg>`,
  fr: `<svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="flag-fr"><circle cx="20" cy="20" r="20"/></clipPath></defs>
    <g clip-path="url(#flag-fr)">
      <rect width="13.33" height="40" fill="#002395"/>
      <rect x="13.33" width="13.33" height="40" fill="#FFFFFF"/>
      <rect x="26.66" width="13.34" height="40" fill="#ED2939"/>
    </g>
  </svg>`,
};
