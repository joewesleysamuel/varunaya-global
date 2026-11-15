/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "sequence" enables the pre-rendered image sequence (needs /public/sequence/manifest.json). */
  readonly VITE_BOTTLE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
