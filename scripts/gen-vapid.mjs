// scripts/gen-vapid.mjs — generate a VAPID keypair for Web Push.
//
// Run:  npm run gen:vapid
//
// Prints the three env values the push backend needs. The PUBLIC key is not a
// secret (it's sent to every push service); the PRIVATE key MUST be kept secret.
// Generate ONCE and reuse — rotating it invalidates every existing subscription.
//
// Output format matches functions/_lib/webpush.js: public key = base64url of the
// raw uncompressed P-256 point; private key = base64url of the PKCS#8 export.

import { webcrypto as crypto } from "node:crypto";

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");

const kp = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
const privateKey = b64url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey)));

console.log(`
VAPID keypair generated. Set these on BOTH the Pages project (for /api/push/*)
and the cron Worker (wrangler-push). See docs/web-push.md.

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:ops@sablavakayaks.com
`);
