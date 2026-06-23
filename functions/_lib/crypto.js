// functions/_lib/crypto.js — hashing + HMAC over the Web Crypto API
// (available in the Cloudflare Workers runtime as `crypto.subtle`).

const enc = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex of a string. Used to store device_token without the raw value. */
export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(input)));
  return toHex(digest);
}

/** HMAC-SHA256 hex of `data` keyed by `secret`. Used to sign the staff cookie. */
export async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}

/** Constant-time string compare to avoid timing leaks on token/passcode checks. */
export function timingSafeEqual(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}
