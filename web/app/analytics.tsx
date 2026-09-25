'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

// PostHog project tokens are public ingestion identifiers, not API secrets.
const PROJECT_TOKEN = 'phc_t7SSG3MwRpgR6s36pwF3UyNpaSeRjG6rq2WzwwBeYKcw';

if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  posthog.init(PROJECT_TOKEN, {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-06-25',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_exceptions: true,
    autocapture: true,
  });
}

export function Analytics() {
  return null;
}

export function AnalyticsIdentity({ userId, provider }: { userId: string | null; provider?: string }) {
  useEffect(() => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    if (userId) posthog.identify(userId, { provider });
  }, [userId, provider]);
  return null;
}
