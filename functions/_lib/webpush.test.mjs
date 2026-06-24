// _lib/webpush.test.mjs — validates the Web Push crypto without a push service.
//
// Run:  node --test functions/_lib/webpush.test.mjs
//
// We can't hit a real endpoint here, so the test plays the BROWSER's role: it
// generates a subscription keypair, lets webpush.js encrypt to it, then decrypts
// with the matching private key and asserts the plaintext round-trips. That
// exercises the whole RFC 8291 schedule (ECDH → HKDF → AES-128-GCM) and the
// aes128gcm record framing. A separate test signs a VAPID JWT and verifies it.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  b64urlToBytes,
  bytesToB64url,
  deriveKeys,
  encryptPayload,
  importVapidPrivateKey,
  signVapidJwt,
} from "./webpush.js";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

// Stand in for a browser subscription: an ECDH P-256 keypair + a 16-byte auth.
async function fakeSubscriptionKeys() {
  const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const p256dhRaw = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    privateKey: kp.privateKey,
    p256dhRaw,
    keys: { p256dh: bytesToB64url(p256dhRaw), auth: bytesToB64url(auth) },
    authSecret: auth,
  };
}

// The receiver side of RFC 8291: undo what encryptPayload did.
async function browserDecrypt(body, ua) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);

  const asPubKey = await subtle.importKey(
    "raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const ecdhBits = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: asPubKey }, ua.privateKey, 256),
  );
  const { cek, nonce } = await deriveKeys(ecdhBits, ua.authSecret, ua.p256dhRaw, asPublic, salt);

  const aesKey = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(
    await subtle.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, ciphertext),
  );
  // Strip the trailing 0x02 last-record delimiter.
  return dec.decode(record.subarray(0, record.length - 1));
}

test("aes128gcm payload round-trips to the subscription keypair", async () => {
  const ua = await fakeSubscriptionKeys();
  const message = JSON.stringify({ title: "Sa Blava", body: "Queden 5 min · torna a la base" });

  const body = await encryptPayload(ua.keys, enc.encode(message));
  const decrypted = await browserDecrypt(body, ua);

  assert.equal(decrypted, message);
});

test("each encryption uses a fresh ephemeral key + salt (non-deterministic)", async () => {
  const ua = await fakeSubscriptionKeys();
  const a = await encryptPayload(ua.keys, enc.encode("hi"));
  const b = await encryptPayload(ua.keys, enc.encode("hi"));
  assert.notDeepEqual([...a.subarray(0, 16)], [...b.subarray(0, 16)]); // different salt
  assert.equal(await browserDecrypt(a, ua), "hi");
  assert.equal(await browserDecrypt(b, ua), "hi");
});

test("VAPID JWT is a valid ES256 token over {aud,exp,sub}", async () => {
  // A throwaway VAPID keypair, exported the way scripts/gen-vapid.mjs stores it.
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = bytesToB64url(new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey)));

  const priv = await importVapidPrivateKey(pkcs8);
  const jwt = await signVapidJwt("https://fcm.googleapis.com", "mailto:ops@sablavakayaks.com", priv);

  const [h, p, s] = jwt.split(".");
  const verified = await subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    kp.publicKey,
    b64urlToBytes(s),
    enc.encode(`${h}.${p}`),
  );
  assert.ok(verified, "signature must verify against the public key");

  const header = JSON.parse(dec.decode(b64urlToBytes(h)));
  const claims = JSON.parse(dec.decode(b64urlToBytes(p)));
  assert.equal(header.alg, "ES256");
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "mailto:ops@sablavakayaks.com");
  assert.ok(claims.exp > Math.floor(Date.now() / 1000), "exp must be in the future");
});
