/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** VAPID public key (application server key) for Web Push; public by design. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** "true" shows the AI setlist features; the Groq key is the `groq-chat` Edge Function's secret. */
  readonly VITE_AI_FEATURES?: string;
}
