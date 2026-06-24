# Web Push — timed return-to-base alerts

Server-sent push so the rental's time warnings (**30 / 15 / 5 / 0 min** before
expiry) reach a **backgrounded or locked phone**, which the in-app timer can't
do — a hidden page is frozen by the browser. These alerts are a pure function of
the wall clock and the session's `expires_at`, so the server can fire them with
no help from the phone.

**POI-arrival cues are intentionally NOT pushed.** Detecting that a kayak
physically reached a point of interest needs its live GPS, and the web platform
has **no background geolocation** (a service worker can't read GPS; `watchPosition`
is frozen with the page; iOS Safari has no background location at all). So POI
cues stay foreground-only, alongside the wake-lock that keeps the screen on.

## How it fits together

```
Phone (trip start, perm granted)        Cloudflare
  nav/push.js ──POST /api/push/subscribe──►  functions/api/push/subscribe.js
     │  (endpoint + keys, scoped to the         └─► D1 push_subscriptions
     │   kayak's open session)
     ▼
  sw.js  push handler ◄─encrypted push──── wrangler-push (cron, every 1 min)
     renders Notification                   └─► functions/_lib/push.js
                                                  dispatchDuePushes()
                                                  ├ pickDuePush() per open session
                                                  ├ functions/_lib/webpush.js
                                                  │   VAPID JWT + aes128gcm encrypt
                                                  └ D1 push_sent (send-once guard)
```

- **`functions/_lib/webpush.js`** — VAPID (ES256 JWT) + RFC 8291 payload
  encryption, built only on Web Crypto so it runs in the Workers runtime. Proven
  by `webpush.test.mjs` (decrypts what it encrypts; verifies the JWT).
- **`functions/_lib/push.js`** — `pickDuePush()` (pure, backlog-collapsing,
  tested in `push.test.mjs`) + `dispatchDuePushes()` (the D1 reads/writes/send).
- **`wrangler-push/`** — the standalone cron Worker. Pages Functions can't run
  cron, so this is a separate deployable bound to the **same** D1.

## One-time setup

### 1. Generate the VAPID keypair (once, ever)

```bash
npm run gen:vapid
```

Copy the three values. Rotating the key later invalidates every existing
subscription, so keep the private key safe and reuse it.

### 2. Configure the Pages project (serves `/api/push/*`)

Dashboard → the Pages project → Settings → Functions → Variables & Secrets, **or**:

```bash
wrangler pages secret put VAPID_PRIVATE_KEY      # secret
# VAPID_PUBLIC_KEY and VAPID_SUBJECT can be plain vars (public key isn't secret):
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_SUBJECT
```

For local dev, put the same three in `.dev.vars` (gitignored).

### 3. Apply the D1 migration (adds `push_subscriptions`, `push_sent`)

```bash
npm run db:migrate:push:remote   # production
npm run db:migrate:push          # local
```

### 4. Deploy the cron Worker (its own secrets)

```bash
wrangler secret put VAPID_PRIVATE_KEY --config wrangler-push/wrangler.toml
wrangler secret put VAPID_PUBLIC_KEY  --config wrangler-push/wrangler.toml
wrangler secret put VAPID_SUBJECT     --config wrangler-push/wrangler.toml
wrangler secret put CRON_SECRET       --config wrangler-push/wrangler.toml   # optional, for /dispatch test
npm run deploy:push
```

The Worker binds the same D1 database (id already copied into
`wrangler-push/wrangler.toml`). Re-run `npm run deploy:push` after any change to
`functions/_lib/push.js` or `webpush.js` — it is **not** part of the Pages
auto-build.

## Testing

- **Unit:** `npm run test:push` (crypto round-trip + threshold logic, no network).
- **End-to-end:** start a short rental from a real phone, grant notifications,
  lock the screen, and wait for a threshold. Or trigger the dispatch by hand:

  ```bash
  curl "https://sablava-push-cron.<your-subdomain>.workers.dev/dispatch?secret=$CRON_SECRET"
  # → {"ok":true,"sessions":N,"sent":M,"pruned":K}
  ```

## Platform caveat — iOS

iOS supports Web Push only for a site **added to the Home Screen** (installed
PWA), iOS 16.4+. In plain mobile Safari there is no Web Push; those users keep
the foreground voice/chime/banner and the keep-screen-on advisory. Everything
degrades silently — a phone that can't subscribe simply never registers, and the
dispatcher only ever sees phones that can receive.
