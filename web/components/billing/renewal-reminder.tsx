'use client';

import { useEffect, useState } from 'react';
import { hardNavigate } from '@/components/fabrica/hard-navigation';

type Status = { state: string; trialEnds: number; paidThrough: number | null; cancelAt: number | null; subscription: { nextChargeAt: number | null } | null };

export function RenewalReminder() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    void fetch('/api/billing/status', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<Status> : null)
      .then(setStatus).catch(() => {});
  }, []);
  if (!status || !['trialing', 'active', 'canceling'].includes(status.state)) return null;
  const due = status.state === 'trialing' ? status.trialEnds : status.cancelAt || status.subscription?.nextChargeAt || status.paidThrough;
  if (!due) return null;
  const days = Math.ceil((due - Date.now()) / 86_400_000);
  if (days < 0 || days > 3) return null;
  return <aside className="billing-reminder" role="status">
    <span>{status.state === 'trialing' ? 'Tu prueba' : status.state === 'canceling' ? 'Tu acceso' : 'Tu próximo cobro'} {days === 0 ? 'vence hoy' : `vence en ${days} ${days === 1 ? 'día' : 'días'}`}.</span>
    <a href="/estudio/facturacion" onClick={hardNavigate}>Ver facturación →</a>
  </aside>;
}
