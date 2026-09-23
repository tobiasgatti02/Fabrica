/// <reference types="vite/client" />
declare namespace Cloudflare {
  interface Env {
    DATABASE_URL: string;
    FILES: R2Bucket;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    APP_BASE_URL?: string;
    MERCADOPAGO_ACCESS_TOKEN?: string;
    MERCADOPAGO_PUBLIC_KEY?: string;
    MERCADOPAGO_WEBHOOK_SECRET?: string;
    MERCADOPAGO_TEST_MODE?: string;
    MERCADOPAGO_PLAN_INICIAL?: string;
    MERCADOPAGO_PLAN_ESTUDIO?: string;
    MERCADOPAGO_PLAN_EQUIPO?: string;
  }
}
