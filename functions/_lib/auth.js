// functions/_lib/auth.js — shared staff passcode + signed-cookie auth.
//
// v1 auth (SESSION-TRACKING-DESIGN.md §5): a single shared staff passcode held
// as the Cloudflare secret STAFF_PASSCODE. On success we set an HttpOnly cookie
// holding `issuedAtMs.<hmac>` signed with PANEL_SECRET; panel endpoints verify
// it. Low-stakes internal tool — upgrade path is Cloudflare Access later.

import { hmacHex, timingSafeEqual } from "./crypto.js";
import { json } from "./db.js";

const COOKIE = "sb_staff";
const MAX_AGE_S = 12 * 60 * 60; // 12 h — a working day-ish

async function sign(secret, issuedAtMs) {
  const sig = await hmacHex(secret, `staff.${issuedAtMs}`);
  return `${issuedAtMs}.${sig}`;
}

/** Build the Set-Cookie header value for a freshly-issued staff session. */
export async function makeSessionCookie(env, url) {
  const value = await sign(env.PANEL_SECRET, Date.now());
  const secure = url.protocol === "https:" ? " Secure;" : "";
  return `${COOKIE}=${value}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${MAX_AGE_S}`;
}

export function clearSessionCookie(url) {
  const secure = url.protocol === "https:" ? " Secure;" : "";
  return `${COOKIE}=; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=0`;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Verify the staff cookie. Returns true if valid and not expired. */
export async function isStaff(request, env) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot < 0) return false;
  const issuedAtMs = Number(raw.slice(0, dot));
  if (!Number.isFinite(issuedAtMs)) return false;
  if (Date.now() - issuedAtMs > MAX_AGE_S * 1000) return false;
  const expected = await sign(env.PANEL_SECRET, issuedAtMs);
  return timingSafeEqual(raw, expected);
}

/** Guard for panel endpoints: returns a 401 Response if not staff, else null. */
export async function requireStaff(request, env) {
  return (await isStaff(request, env)) ? null : json({ error: "unauthorized" }, { status: 401 });
}

/** Constant-time passcode check against the configured secret. */
export function checkPasscode(env, passcode) {
  if (!env.STAFF_PASSCODE) return false;
  return timingSafeEqual(String(passcode ?? ""), env.STAFF_PASSCODE);
}
