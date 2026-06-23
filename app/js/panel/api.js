// app/js/panel/api.js — thin client for the staff panel endpoints.
// Same-origin, so the signed staff cookie rides along automatically; we still
// pass credentials:"include" to be explicit. No caching (the SW skips /api/).

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  return { ok: res.ok, status: res.status, data };
}

export function checkAuth() {
  return request("/api/panel/login", { method: "GET" });
}

export function login(passcode) {
  return request("/api/panel/login", { method: "POST", body: JSON.stringify({ passcode }) });
}

export function logout() {
  return request("/api/panel/login", { method: "DELETE" });
}

export function getBoard() {
  return request("/api/panel/board", { method: "GET" });
}

export function finishTrip(kayakId) {
  return request("/api/panel/finish", { method: "POST", body: JSON.stringify({ kayak_id: kayakId }) });
}
