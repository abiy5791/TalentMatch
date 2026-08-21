/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The API's origin, e.g. https://recruitment-api.vercel.app.
   *
   * Leave it unset to call the API on this same origin — the dev server proxies
   * /api, and the deployed site rewrites it. See src/lib/api.ts.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
