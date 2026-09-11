/// <reference types="vite/client" />
declare namespace Cloudflare {
  interface Env {
    DATABASE_URL: string;
    FILES: R2Bucket;
  }
}
