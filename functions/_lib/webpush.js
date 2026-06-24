// functions/_lib/webpush.js — Web Push (RFC 8030/8291/8292) over Web Crypto only.
//
// The `web-push` npm library leans on Node's crypto and does NOT run in the
// Cloudflare Workers runtime. Everything here is built on `crypto.subtle`, which
// IS available both in Workers and in Node ≥18 — so the same code signs the VAPID
// token, encrypts the payload, and POSTs it to the push service, with no deps.
//
// Two pieces, per the specs:
//   • VAPID (RFC 8292): an ES256 JWT proving the app server's identity, plus the
//     `k=` application-server public key. Apple's push service (iOS Safari Web
//     Push) REQUIRES this; the others accept it.
//   • Payload encryption (RFC 8291 + RFC 8188 "aes128gcm"): ECDH against the
//     subscription's public key → HKDF → AES-128-GCM, so only the subscriber's
//     browser can read the message body.
//
// The crypto path is validated end-to-end by _lib/webpush.test.mjs, which plays
// the browser's role (decrypts what we encrypt) and verifies the JWT signature.

// ── base64url ───────────────────────────────────────────────────────────────────

/** base64url string → Uint8Array. Tolerates missing padding. */
export function b64urlToBytes(s) {
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Uint8Array (or ArrayBuffer) → unpadded base64url string. */
export function bytesToB64url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const enc = new TextEncoder();

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ── VAPID (RFC 8292) ────────────────────────────────────────────────────────────

/**
 * Sign a VAPID JWT (ES256) for one push endpoint.
 * @param {string} audience    — origin of the push endpoint (e.g. "https://fcm.googleapis.com")
 * @param {string} subject     — contact "mailto:" or "https:" URL
 * @param {CryptoKey} privateKey — imported ECDSA P-256 private key (see importVapidPrivateKey)
 * @param {number} [ttlSec]     — token lifetime; spec caps at 24 h
 * @returns {Promise<string>} the compact JWT
 */
export async function signVapidJwt(audience, subject, privateKey, ttlSec = 12 * 3600) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    sub: subject,
  };
  const signingInput =
    bytesToB64url(enc.encode(JSON.stringify(header))) +
    "." +
    bytesToB64url(enc.encode(JSON.stringify(payload)));

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(signingInput),
  );
  // WebCrypto ECDSA already returns the IEEE-P1363 r‖s form JOSE wants.
  return signingInput + "." + bytesToB64url(sig);
}

/** Import the VAPID private key from its base64url PKCS#8 form (gen-vapid output). */
export function importVapidPrivateKey(pkcs8B64url) {
  return crypto.subtle.importKey(
    "pkcs8",
    b64urlToBytes(pkcs8B64url),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// ── Payload encryption (RFC 8291, "aes128gcm") ───────────────────────────────────

const RECORD_SIZE = 4096; // plenty for our short notification bodies

/**
 * Encrypt a payload for a subscription, producing the aes128gcm message body.
 * @param {{ p256dh: string, auth: string }} keys — subscription keys (base64url)
 * @param {Uint8Array} plaintext
 * @returns {Promise<Uint8Array>} the full `Content-Encoding: aes128gcm` body
 */
export async function encryptPayload(keys, plaintext) {
  const uaPublic = b64urlToBytes(keys.p256dh); // 65-byte uncompressed point
  const authSecret = b64urlToBytes(keys.auth); // 16 bytes

  // Ephemeral application-server ECDH keypair (fresh per message).
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    asKeyPair.privateKey,
    256,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await deriveKeys(new Uint8Array(ecdhBits), authSecret, uaPublic, asPublic, salt);

  // One record: plaintext followed by the 0x02 last-record delimiter (RFC 8188).
  const record = concatBytes(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record),
  );

  // aes128gcm header: salt(16) ‖ rs(uint32 BE) ‖ idlen(uint8) ‖ keyid(as_public).
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concatBytes(header, ciphertext);
}

/**
 * RFC 8291 key schedule → AES-128-GCM content-encryption key + nonce.
 * Exported so the test can replay the receiver side.
 */
export async function deriveKeys(ecdhSecret, authSecret, uaPublic, asPublic, salt) {
  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info\0"‖ua‖as)
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ecdhKey = await crypto.subtle.importKey("raw", ecdhSecret, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: keyInfo },
      ecdhKey,
      256,
    ),
  );

  // CEK / NONCE = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0" | "...nonce\0")
  const prk = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") },
      prk,
      128,
    ),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") },
      prk,
      96,
    ),
  );
  return { cek, nonce };
}

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * Encrypt + POST one notification to a subscription's endpoint.
 * @param {{ endpoint: string, p256dh: string, auth: string }} sub
 * @param {object} payload — JSON message the service worker will render
 * @param {{ privateKey: CryptoKey, publicKey: string, subject: string }} vapid
 * @returns {Promise<number>} the push service HTTP status (404/410 ⇒ prune the sub)
 */
export async function sendPush(sub, payload, vapid) {
  const body = await encryptPayload(
    { p256dh: sub.p256dh, auth: sub.auth },
    enc.encode(JSON.stringify(payload)),
  );

  const audience = new URL(sub.endpoint).origin;
  const jwt = await signVapidJwt(audience, vapid.subject, vapid.privateKey);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "120",
      Urgency: "high",
    },
    body,
  });
  return res.status;
}
