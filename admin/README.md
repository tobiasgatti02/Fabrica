# Founder dashboard

Private Cloudflare Worker at `admin.f4brica.app`. Neon provides account, billing, project, and activity metrics. PostHog provides product analytics when a scoped personal API key is configured.

## Local development

Create `admin/.dev.vars` with `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`, `ADMIN_SESSION_SECRET`, and optionally `POSTHOG_PERSONAL_API_KEY`. The password hash is base64url encoded PBKDF2-SHA256 with 100,000 iterations over the UTF-8 salt (Cloudflare Workers' maximum). Run `npm ci && npm run dev`.

## Deployment

The GitHub workflow deploys the Worker from `admin/` and sets runtime secrets from GitHub Actions secrets. The PostHog API key is optional; if added, use the `query:read` scope and configure it directly as a Cloudflare Worker secret named `POSTHOG_PERSONAL_API_KEY`. The project token in `web/app/analytics.tsx` is public and only permits event ingestion.

The dashboard is read-only. Its API requires a signed, 12-hour, HttpOnly session cookie. Never commit `.dev.vars` or password material.
