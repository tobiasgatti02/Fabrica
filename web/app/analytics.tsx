'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';

// PostHog project tokens are public ingestion identifiers, not API secrets.
const PROJECT_TOKEN = 'phc_t7SSG3MwRpgR6s36pwF3UyNpaSeRjG6rq2WzwwBeYKcw';

if (typeof window !== 'undefined' && ['f4brica.app', 'www.f4brica.app'].includes(location.hostname)) {
  posthog.init(PROJECT_TOKEN, {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-06-25',
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    autocapture: true,
  });
}

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!['f4brica.app', 'www.f4brica.app'].includes(location.hostname)) return;
    posthog.capture('$pageview');
  }, [pathname]);
  return null;
}

export function AnalyticsIdentity({ userId, provider }: { userId: string | null; provider?: string }) {
  useEffect(() => {
    if (!['f4brica.app', 'www.f4brica.app'].includes(location.hostname)) return;
    if (userId) posthog.identify(userId, { provider });
  }, [userId, provider]);
  return null;
}
