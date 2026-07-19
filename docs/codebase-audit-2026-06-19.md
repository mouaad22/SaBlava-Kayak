# Codebase Audit & Remediation Plan — 2026-06-19

Review of security, compliance, correctness, and efficiency for the Sa Blava Kayak app.
Written so a future session can pick up with full context and execute the plan below.

---

## 0. Context (what this app is)

- **100% static client-side PWA.** Vanilla JS, hash router (`app/js/router.js`), service
  worker (`app/sw.js`), PWA manifest. No backend, no database, no server-side auth.
- `app/server.py` is **only a local dev server** and is frozen — not part of production.
  Production is served as static files (GitHub Pages today → Cloudflare Pages planned,
  see `DEPLOYMENT-CLOUDFLARE.md`).
- Weather: Open-Meteo (`app/js/weather.js`) — free, no key, no PII.
- Maps: Mapbox GL JS with a **public** token in `app/js/config.js`.
- Rental "auth": a 6-digit code validated **entirely client-side** (`app/js/nav/code.js`).
- Geolocation is used for navigation but **never transmitted** — stays on device.
- No analytics, no cookies, no first-party tracking.

**Security ceiling:** very small attack surface, but also **no server-side enforcement of
anything**. Confirmed there is **no XSS surface** — all ~25 `innerHTML` sites interpolate only
static data, i18n strings, or rounded weather numbers. User input is tightly sanitized
(`code-entry.js` strips to digits; `kayak.js:16-20` validates `?k=` against
`/^[A-Za-z0-9-]{1,8}$/`). Dev tooling (Tweakpane) is gated behind `localhost`
(`nav-tweakpane.js:4`).

---

## 1. Findings

Severity: 🔴 high / act soon · 🟡 compliance · 🟠 correctness bug · 🟢 efficiency/polish

### 🔴 SEC-1 — Mapbox token restriction: docs contradict each other
- `MAPBOX-TOKEN-SECURITY.md:3` says **"Status: TODO — not yet done."**
- `app/js/config.js:3-4` claims the token **is** URL-restricted to
  `routes.sablavakayaks.com`, `*.pages.dev`, `localhost:5173`.
- One is stale. If the dashboard restriction is **not** actually in place, the public token
  (`config.js:5`, also used in `tile-cache.js:116`) can be copied onto any site and billed to
  our Mapbox account.
- **Action:** verify in Mapbox dashboard → Account → Tokens. Then reconcile the docs (delete
  the stale claim). Needs dashboard access — **decision/credentials required from owner.**

### 🔴 SEC-2 — No security headers / CSP
- No `app/_headers` file for Cloudflare Pages. Shipping zero `Content-Security-Policy`,
  `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`.
- Highest-leverage hardening available for a geolocation PWA. ~15-line static file.
- **Action:** add `app/_headers` (Cloudflare Pages serves it automatically). Draft in §3.

### 🔴 SEC-3 — Third-party scripts loaded without SRI
- `app/index.html:37-38` loads `mapbox-gl.js` and **`@rive-app/canvas@2.30.0` from
  unpkg.com** with no `integrity=` hash. Compromised/mutable CDN response = arbitrary JS in
  users' browsers.
- **Action:** add SRI hashes (pin + `integrity` + `crossorigin`), or self-host (we already
  self-host `tweakpane.min.js` under `app/assets/vendor/`). Rive from unpkg is the looser of
  the two — prefer self-hosting it.

### 🔴 SEC-4 — Rental code is trivially forgeable (by design — make it a conscious choice)
- `app/js/nav/code.js`: code is `HH+MM+DD` where `MM`/`DD` = today's date and
  `HH ∈ {01,15,02,03}`. Anyone can compute a valid free-rental code in <4 guesses;
  validation is 100% client-side (code comment: "friction gate only").
- Gates **paid** rentals, so the revenue-leak exposure should be an explicit business
  decision. Real protection requires server-side validation.
- **Action:** owner decision only — no code change unless revenue protection is wanted. See
  `SESSION-TRACKING-DESIGN.md` for the planned session API.

### 🟡 COMP-1 — No privacy policy / GDPR-RGPD notice (commercial EU/Spain app)
- **Mapbox GL telemetry** fires to `events.mapbox.com` (SW special-cases it at `sw.js:77`) —
  third-party data collection from EU users, undisclosed, no consent path.
- **Google Fonts** (`index.html:18`) loads from `fonts.gstatic.com`, transferring user IP to
  Google — a documented GDPR issue (German court rulings). **Self-hosting DM Sans removes it
  entirely and is faster.**
- First-party `localStorage` (session/draft/weather/kayakId) is arguably "strictly
  necessary/functional" and likely consent-exempt — the Mapbox telemetry is not.
- **Action:** (a) self-host DM Sans; (b) add a short privacy notice page/section. A full
  consent banner is a larger product decision — flag to owner.

### 🟡 COMP-2 — Accessibility: pinch-zoom disabled
- `app/index.html:7` sets `maximum-scale=1`, blocking pinch-zoom — **WCAG 1.4.4 failure.**
- App is otherwise quite accessible (aria-labels, `aria-live`, `lang` attrs, decorative SVGs).
- **Action:** remove `maximum-scale=1` from the viewport meta.

### 🟠 BUG-1 — Offline map pre-caching is silently broken (cache-name version drift)
- `app/js/nav/tile-cache.js:20` writes pre-fetched tiles into `"sablava-tiles-v1"`.
- `app/sw.js:25` declares `TILE_CACHE = "sablava-tiles-v2"`, and `sw.js:56-66` (activate)
  **deletes every cache not named v2.** So pre-cached tiles are purged on next activation;
  the SW serves from v2 (which it populates itself).
- The explicit pre-cache does real network work that's thrown away. Offline navigation (a
  headline Phase 2 feature) is effectively non-functional.
- **Action:** one-line fix — make `tile-cache.js` use the same constant as the SW (import or
  align to `"sablava-tiles-v2"`). Verify offline behavior afterward.

### 🟢 EFF-1 — SW precache comment overstates offline-first
- `sw.js:28-36` pre-caches only `app.js` of the JS, but the comment claims "boots offline even
  on first run." Screen/nav modules are network-first, so a true cold offline first-load of
  deep features won't work.
- **Action:** either correct the comment, or add the module graph to `SHELL_ASSETS`.

### 🟢 EFF-2 — No build step (minify/bundle)
- ES modules ship raw and unminified. Functionally fine (Cloudflare auto-minifies; HTTP/2
  softens many-small-files). For weak on-water connectivity a bundling pass would cut
  round-trips. Low priority.

### 🟢 EFF-3 — i18n ships all 4 languages up front
- `app/js/i18n.js` (~28 KB) loads all languages eagerly. Fine at this size; lazy-load per
  language is a possible future trim.

### 🟢 EFF-4 — Static asset cache-busting relies on filename changes
- `sw.js:38` cache-first with no content hashing; busting requires renaming files. Workable
  but fragile — a content-hash naming scheme would be more robust if a build step is added.

---

## 2. Remediation plan (recommended order)

| # | Finding | Effort | Blocked on | Type |
|---|---------|--------|------------|------|
| 1 | **SEC-1** verify Mapbox token restriction + fix docs | S | owner (dashboard access) | verify + docs |
| 2 | **BUG-1** fix tile-cache version mismatch | XS | none | code (1 line) |
| 3 | **SEC-2** add `app/_headers` with CSP | S | none | code |
| 4 | **SEC-3** SRI / self-host CDN scripts | S–M | none | code |
| 5 | **COMP-2** remove `maximum-scale=1` | XS | none | code (1 line) |
| 6 | **COMP-1a** self-host DM Sans | M | none | code + asset |
| 7 | **COMP-1b** add privacy notice | M | owner (content/consent decision) | content |
| 8 | **SEC-4** server-side code validation | L | owner (business decision) | architecture |
| 9 | **EFF-1** fix/clarify SW precache | XS | none | code/comment |

**Quick, safe, self-contained (can do in one pass): #2, #3, #4, #5, #9.**
**Need owner decision/credentials: #1, #7, #8.**

---

## 3. Reference: draft `app/_headers` (Cloudflare Pages)

CSP must allow: self, Mapbox (`api.mapbox.com`, `events.mapbox.com`), Open-Meteo
(`api.open-meteo.com`, `marine-api.open-meteo.com`), Google Fonts (until self-hosted), and
unpkg (until Rive is self-hosted). Tighten as scripts/fonts get self-hosted.

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(self), camera=(), microphone=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://api.mapbox.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com; img-src 'self' data: blob: https://api.mapbox.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://api.open-meteo.com https://marine-api.open-meteo.com; worker-src 'self' blob:; frame-ancestors 'none'
```
Notes:
- `style-src 'unsafe-inline'` is currently required (Mapbox GL + inline SVG styles). Removing
  it later needs nonces/hashes — out of scope for the first pass.
- After self-hosting Rive: drop `https://unpkg.com` from `script-src`.
- After self-hosting DM Sans: drop the Google Fonts origins.
- Verify nothing else inline-loads before shipping (would break under CSP).

---

## 4. What was checked and found OK (don't re-investigate)

- **No XSS:** all `innerHTML` sites use static/i18n/numeric data only.
- **Input sanitization:** `code-entry.js` (digits only), `kayak.js` (`?k=` regex-gated).
- **Dev tooling** (`nav-tweakpane.js`, `dev/sim.js`) gated behind `localhost`.
- **Geolocation** is client-side only; never sent anywhere.
- **No analytics / cookies / first-party tracking.**
- **Weather API** carries no PII.

---

## 5. Pointers

- Token security: `MAPBOX-TOKEN-SECURITY.md`, token in `app/js/config.js:5`
- Deployment: `DEPLOYMENT-CLOUDFLARE.md`
- Session/auth design: `SESSION-TRACKING-DESIGN.md`
- Service worker: `app/sw.js` · tile cache: `app/js/nav/tile-cache.js`
- Entry HTML (CDN scripts, viewport): `app/index.html`
