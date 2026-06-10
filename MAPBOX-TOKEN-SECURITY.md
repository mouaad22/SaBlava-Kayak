# Mapbox Token — Restrict It Before Forgetting

**Status: TODO — not yet done.** The site is already live on GitHub Pages, so this is a live concern, not a future one.

## The short version

Our Mapbox token lives in [`app/js/config.js`](app/js/config.js) and ships to every visitor's browser. **It is public and visible to anyone** who views the page source — that's unavoidable for a browser map, and it's normal. Public tokens (`pk.…`) are designed to be exposed.

The risk: the token is tied to **our Mapbox account and bill**. Anyone can copy it and paste it into **their own website**, and their map loads would count against **our** free quota — once exceeded, **we get charged for their traffic** (or our own map stops loading).

The fix: add a **URL restriction** in the Mapbox dashboard so the token only works on our domain(s) and gets rejected everywhere else. No code change needed.

## How to fix it (≈5 minutes)

1. Go to the Mapbox dashboard → **Account → Tokens**.
2. Click the token (the `pk.eyJ1IjoibW91YWFkMjI…` one).
3. Find **URL restrictions** (aka "Allowed URLs" / token scopes).
4. Add the URL(s) the map is allowed to load on:
   - Current live URL — GitHub Pages: `https://mouaad22.github.io/*`
   - Future custom domain (when the client's domain is wired up): `https://*.sablavakayaks.com/*`
5. Save.

That's it. The token stays public in the code — it just stops being useful to anyone else.

## Notes

- **A new token WAS required.** The original token in `config.js` was Mapbox's **default public token**, and Mapbox does not allow URL restrictions on default tokens ("URL restrictions are not supported for default tokens"). So on 2026-06-10 a new restricted public token was created and swapped into `config.js`, restricted to: `https://routes.sablavakayaks.com/*`, `https://*.pages.dev/*` (testing), and `http://localhost:5173/*` (local dev). Keep this URL list in sync with wherever the app is served.
- Update the allowed-URL list whenever the hosting URL or domain changes.
- This is independent of *where* we host. Whether the site stays on GitHub Pages or moves to Cloudflare Pages, the token restriction is set in the Mapbox dashboard, not in our hosting config.

## Related

- Token location: [`app/js/config.js`](app/js/config.js)
- Map setup uses this token client-side (browser), which is why it can't be hidden.
