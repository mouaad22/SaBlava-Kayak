// wrangler-push/src/index.js — cron entry for the timed-push dispatcher.
//
// The actual logic lives in the shared functions/_lib/push.js so the Pages
// backend and this Worker stay in lockstep; wrangler bundles the imports.

import { dispatchDuePushes } from "../../functions/_lib/push.js";

export default {
  // Fires every minute (see [triggers] crons in wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchDuePushes(env.DB, env));
  },

  // Manual trigger for testing without waiting for the cron, e.g.
  //   curl "https://sablava-push-cron.<subdomain>.workers.dev/dispatch?secret=…"
  // Guarded by CRON_SECRET; everything else returns a plain liveness string.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/dispatch") {
      if (!env.CRON_SECRET || url.searchParams.get("secret") !== env.CRON_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const result = await dispatchDuePushes(env.DB, env);
      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("sablava push cron — ok", { status: 200 });
  },
};
