#!/usr/bin/env node
// Generates a VAPID key pair for Web Push (docs/setup/push-notifications.md).
//
// Prints the two values to set, and nothing else is stored:
//   VAPID_KEYS            → Edge Function secret (private: `supabase secrets set`)
//   VITE_VAPID_PUBLIC_KEY → app build env (public by design: the browser needs it
//                           as `applicationServerKey` to subscribe)
//
// The JWK pair is the format `jsr:@negrel/webpush` imports
// (send-push-notifications). Run once per project: rotating the keys
// invalidates every existing subscription.

const { subtle } = globalThis.crypto;

const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const vapidKeys = {
  publicKey: await subtle.exportKey("jwk", pair.publicKey),
  privateKey: await subtle.exportKey("jwk", pair.privateKey),
};
const applicationServerKey = Buffer.from(await subtle.exportKey("raw", pair.publicKey)).toString(
  "base64url"
);

console.log("# Edge Function secret (keep private):");
console.log(`supabase secrets set VAPID_KEYS='${JSON.stringify(vapidKeys)}'`);
console.log("");
console.log("# App env (.env / Vercel), public:");
console.log(`VITE_VAPID_PUBLIC_KEY=${applicationServerKey}`);
