/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" shows the offline download UI (PR 2.3; flag removed in 2.5). */
  readonly VITE_OFFLINE_DOWNLOADS?: string;
}
