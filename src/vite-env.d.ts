/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_AIRI_API_BASE_URL?: string;
    readonly VITE_AIRI_UPLOAD_PATH?: string;
    readonly VITE_AIRI_API_KEY?: string;
    readonly VITE_AIRI_PROJECT_ID?: string;
    readonly VITE_AIRI_PROJECT_NAME?: string;
    readonly VITE_AIRI_TEAM_ID?: string;
    readonly VITE_AIRI_AUTH_TOKEN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
