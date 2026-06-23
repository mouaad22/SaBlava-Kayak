// functions/_lib/db.js — thin D1 helpers shared by the API routes.
//
// Every Pages Function receives `context.env.DB` (the D1 binding from
// wrangler.toml). These wrappers keep the call sites readable.

/** Run a write (INSERT/UPDATE/DELETE). Returns the D1 result meta. */
export function run(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}

/** First matching row, or null. */
export function first(db, sql, params = []) {
  return db.prepare(sql).bind(...params).first();
}

/** All matching rows as an array. */
export async function all(db, sql, params = []) {
  const { results } = await db.prepare(sql).bind(...params).all();
  return results ?? [];
}

/** A small JSON Response helper with no-store so API replies are never cached. */
export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}
