/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" shows the offline download UI (PR 2.3; flag removed in 2.5). */
  readonly VITE_OFFLINE_DOWNLOADS?: string;
  /** "true" shows the push notification settings (band push notifications, Phase 1). */
  readonly VITE_PUSH_NOTIFICATIONS?: string;
  /** VAPID public key (application server key) for Web Push; public by design. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
