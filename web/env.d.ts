/// <reference types="vite/client" />
declare namespace Cloudflare {
  interface Env {
    DATABASE_URL: string;
    FILES: R2Bucket;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
  }
}
