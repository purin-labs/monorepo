/// <reference types="vite/client" />

// Project-specific env typings for Vite. Keep the keys in sync with the root
// .env.local and the company site deploy.
interface ImportMetaEnv {
  readonly VITE_SITE_ORIGIN?: string;
  readonly VITE_WALLET_SITE_ORIGIN?: string;
  readonly VITE_DOCS_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
