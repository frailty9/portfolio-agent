/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_LLM_PROVIDER?: string
  readonly VITE_LLM_MODEL?: string
  readonly VITE_GITHUB_USERNAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
