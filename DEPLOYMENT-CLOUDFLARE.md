# Deployment Guide — Cloudflare Pages (subdomain)

How to move this site from GitHub Pages to **Cloudflare Pages**, served on a **subdomain** of the client's Wix-registered domain. The main Wix site stays untouched.

## Why this is the easy case

- **The site is 100% static.** No backend, no build step, no serverless. Weather comes from Open-Meteo directly in the browser; the map uses a public Mapbox token. Cloudflare just serves files.
- **Routing is hash-based** (`#/route/sud`, `#/route/nord`, etc. — see [`app/js/router.js`](app/js/router.js)). The server never sees anything after the `#`, so **no SPA fallback / rewrite rules are needed.** One deployed site answers every QR link.
- **The app lives in the `app/` folder**, so the only non-default setting is telling Cloudflare to serve `app/` as the site root.

---

## Prerequisites

- [ ] A Cloudflare account (free) — sign up at https://dash.cloudflare.com.
- [ ] Access to the GitHub repo (`SaBlava-Kayak`) to authorize Cloudflare.
- [ ] Access to the **Wix DNS settings** for the client's domain (to add one CNAME record). This is in Wix under **Domains → (the domain) → Manage DNS Records** / Advanced.
- [ ] Decide the subdomain name. Recommended: `routes.sablavakayaks.com` or `kayak.sablavakayaks.com`. (Examples below use `routes.sablavakayaks.com` — substitute the real one.)

---

## Part A — Connect the repo to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize Cloudflare to access GitHub, then select the **`SaBlava-Kayak`** repository.
3. Set the production branch to **`main`**.

## Part B — Build settings (the one important screen)

Because there's no build step and the site lives in `app/`, use:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | **`app`** |
| Root directory | *(leave as `/`)* |

> The key line is **Build output directory = `app`**. That makes `app/index.html` the site root, so the relative paths (`./styles/…`, `./assets/…`, `./js/…`) and the hash routes all resolve correctly.

4. Click **Save and Deploy**.

## Part C — First deploy + smoke test

5. Cloudflare builds and gives you a free URL like `https://sablava-kayak.pages.dev`. Open it.
6. Quick checks:
   - [ ] Splash → language selection loads.
   - [ ] Routes browser loads; open a route (`#/route/sud`).
   - [ ] **Map renders** (this confirms Mapbox works from the `.pages.dev` domain — see Part F note).
   - [ ] Weather panel populates (confirms Open-Meteo fetch works).
7. From now on, **every push to `main` auto-deploys.** No manual step.

---

## Part D — Point the subdomain at it (Wix DNS + Cloudflare)

The domain registration **stays at Wix.** We only add one DNS record there and claim the domain in Cloudflare.

### D1 — In Cloudflare Pages
1. Open the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter the subdomain, e.g. `routes.sablavakayaks.com` → **Continue**.
3. Cloudflare shows the DNS record it wants — a **CNAME** like:
   - **Name/Host:** `routes`
   - **Target/Value:** `sablava-kayak.pages.dev`
   Keep this tab open.

### D2 — In Wix DNS
4. Wix dashboard → **Domains** → select the domain → **Manage DNS Records** (under Advanced).
5. **Add a record:**
   - Type: **CNAME**
   - Host name: `routes`
   - Value / Points to: `sablava-kayak.pages.dev`
   - TTL: default (1 hour is fine)
6. Save.

### D3 — Back in Cloudflare
7. Cloudflare detects the CNAME (can take a few minutes up to ~an hour) and **auto-provisions HTTPS**. When the custom domain shows **Active**, `https://routes.sablavakayaks.com` is live with a valid SSL certificate.

> The client's existing Wix website (on the root domain `sablavakayaks.com`) is **not affected** — we only added a subdomain record.

---

## Part E — QR link structure

Because routing is hash-based, **all QR codes point to the same deployed site**; the part after `#` selects what loads. Examples on the new subdomain:

| QR | Link | Lands on |
|---|---|---|
| **Kiosk / main** (info, no purchase) | `https://routes.sablavakayaks.com/` | Language select → routes browser (general info) |
| Kayak → South route | `https://routes.sablavakayaks.com/#/route/sud` | South route detail |
| Kayak → North route | `https://routes.sablavakayaks.com/#/route/nord` | North route detail |

> **Per-kayak dedicated links:** today the deepest the router goes is per-*route* (`#/route/:id`) and per-POI (`#/route/:id/poi/:i`). If you want each individual kayak to have its *own* distinct URL (e.g. for analytics on "which kayak got scanned"), that's a small app change — either a query param (`?kayak=k12`) or per-kayak hash. Flag it if you want it; it doesn't affect hosting, and all such links still resolve to this one deployment.

When generating QR codes, point them at the **subdomain** URLs above, not the `.pages.dev` URL.

---

## Part F — Post-migration checklist

- [ ] **Update the Mapbox token URL restriction** to include the new domain. Add `https://routes.sablavakayaks.com/*` (and keep `https://*.pages.dev/*` while testing). See [`MAPBOX-TOKEN-SECURITY.md`](MAPBOX-TOKEN-SECURITY.md). Without this, the map may stop loading on the new domain once the token is locked down.
- [ ] **Generate the QR codes** against the subdomain URLs (Part E).
- [ ] **Decommission GitHub Pages** once the Cloudflare subdomain is verified working — Repo → **Settings → Pages → Source: None**. (Optional: keep it live a few days as a fallback first.)
- [ ] Decide whether to remove the old GitHub Pages URL from the Mapbox allowed-URLs list after decommissioning.

---

## Rollback

If anything goes wrong, the old GitHub Pages site is unaffected until you disable it in Part F — so the existing QR codes keep working. To revert the subdomain, just delete the CNAME record in Wix (D2). No data is lost; Cloudflare Pages keeps every previous deployment and you can roll back to any of them from the Pages dashboard.

---

## TL;DR

1. Cloudflare Pages → connect `SaBlava-Kayak` repo, **output dir = `app`**, deploy.
2. Add a **CNAME** `routes` → `sablava-kayak.pages.dev` in **Wix DNS**.
3. Add the custom domain in Cloudflare Pages; HTTPS auto-provisions.
4. Update the **Mapbox token** allowed-URLs to the new subdomain.
5. Generate QR codes against `https://routes.sablavakayaks.com/…`.
6. Turn off GitHub Pages once verified.
