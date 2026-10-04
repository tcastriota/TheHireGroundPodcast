/// <reference types="vite/client" />

// NOTE: every VITE_* variable is bundled into the PUBLIC website JavaScript.
// Never put secret keys here. The Gemini key lives only on the server
// (GEMINI_API_KEY in Cloud Run, read by server.mjs).
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}