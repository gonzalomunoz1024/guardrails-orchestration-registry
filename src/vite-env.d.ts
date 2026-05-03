/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_REDIRECT_URI: string;
  readonly VITE_GITHUB_REPO_OWNER: string;
  readonly VITE_GITHUB_REPO_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
