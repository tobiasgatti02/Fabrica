'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { BillingCardForm } from '@/components/billing/card-form';

type BillingData = {
  state: string;
  plan: string;
  trialEnds: number;
  paidThrough: number | null;
  graceEnds: number | null;
  rights: { projects: number; storageBytes: number; professionals: number; clients: number | null };
  usage: { projects: number; storageBytes: number; professionals: number; clients: number };
  lastCharge: { status: string; amountCents: number; currency: string } | null;
  subscription: { state: string; providerStatus: string | null; nextChargeAt: number | null } | null;
};
type Plan = { id: string; key: string; amountCents: number; currency: string; rights: BillingData['rights'] };
type PlansData = { plans: Plan[]; publicKey: string | null; testMode: boolean };

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const bytes = (value: number) => `${(value / 1024 ** 3).toFixed(value >= 1024 ** 3 ? 1 : 2)} GB`;

export default function BillingPage() {
  const [status, setStatus] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const refreshStatus = useCallback(() => {
    void fetch('/api/billing/status').then(async (response) => {
      if (!response.ok) throw new Error(response.status === 401
        ? 'Iniciá sesión para ver la facturación.' : 'No se pudo cargar la facturación.');
      return response.json() as Promise<BillingData>;
    }).then(setStatus).catch((error: Error) => setLoadError(error.message));
  }, []);
  useEffect(() => {
    void Promise.all([
      fetch('/api/billing/status').then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401
          ? 'Iniciá sesión para ver la facturación.' : 'No se pudo cargar la facturación.');
        return response.json() as Promise<BillingData>;
      }).then(setStatus),
      fetch('/api/billing/plans').then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los planes.');
        return response.json() as Promise<PlansData>;
      }).then((data) => {
        setPlans(data.plans || []); setPublicKey(data.publicKey); setTestMode(data.testMode);
      }),
    ]).catch((error: Error) => setLoadError(error.message));
  }, []);
  if (loadError) return <main className="billing-page"><p className="billing-alert">{loadError}</p><a href="/estudio">Ir al estudio</a></main>;
  if (!status) return <main className="billing-page"><p>Cargando facturación...</p></main>;
  const days = Math.max(0, Math.ceil((status.trialEnds - Date.now()) / 86400000));
  return <main className="billing-page">
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} />
    <header><p className="workspace-eyebrow">FACTURACIÓN</p><h1>Planes y membresía</h1><p>Estado real de tu estudio, límites y cobros.</p></header>
    <section className="billing-summary">
      <div><span>Estado</span><strong>{status.state}</strong></div>
      <div><span>Plan actual</span><strong>{status.plan}</strong></div>
      <div><span>Prueba</span><strong>{days ? `${days} días restantes` : 'Finalizada'}</strong></div>
      <div><span>Último pago</span><strong>{status.lastCharge ? `${status.lastCharge.status} · ${money.format(status.lastCharge.amountCents / 100)}` : 'Sin pagos'}</strong></div>
    </section>
    {(status.state === 'grace_period' || status.state === 'expired') && <p className="billing-alert">Tu estudio conserva la lectura, pero las nuevas operaciones están limitadas hasta regularizar el plan.</p>}
    <section><h2>Uso actual</h2><div className="billing-usage">
      <span>Proyectos <b>{status.usage.projects} / {status.rights.projects}</b></span>
      <span>Almacenamiento <b>{bytes(status.usage.storageBytes)} / {bytes(status.rights.storageBytes)}</b></span>
      <span>Profesionales <b>{status.usage.professionals} / {status.rights.professionals}</b></span>
      <span>Clientes <b>{status.usage.clients} / {status.rights.clients ?? 'Ilimitados'}</b></span>
    </div></section>
    <section><h2>Planes disponibles</h2><div className="billing-plans">{plans.map((plan) => <article key={plan.id}>
      <h3>{plan.key}</h3><strong>{money.format(plan.amountCents / 100)} <small>/ mes</small></strong>
      <p>{plan.rights.projects} proyectos · {bytes(plan.rights.storageBytes)} · {plan.rights.professionals} profesionales</p>
      <button type="button" disabled={plan.key === status.plan || !publicKey || changingPlan} onClick={() => { setSelectedPlan(plan); setMessage(''); }}>{plan.key === status.plan ? 'Plan actual' : 'Elegir plan'}</button>
    </article>)}</div></section>
    {selectedPlan && <section className="billing-checkout">
      <h2>{status.subscription && status.state === 'active' ? 'Cambiar' : 'Suscribirse'} a {selectedPlan.key}</h2>
      <p>{money.format(selectedPlan.amountCents / 100)} por mes.</p>
      {status.subscription && status.state === 'active'
        ? <button type="button" disabled={changingPlan} onClick={async () => {
          setChangingPlan(true);
          try {
            const response = await fetch('/api/billing/change-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: selectedPlan.key }) });
            const result = await response.json() as { error?: string };
            if (!response.ok) throw new Error(result.error || 'No se pudo cambiar el plan.');
            setMessage('El cambio de plan fue solicitado.');
            setSelectedPlan(null);
            refreshStatus();
          } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el plan.'); }
          finally { setChangingPlan(false); }
        }}>{changingPlan ? 'Actualizando…' : 'Confirmar cambio de plan'}</button>
        : <>{testMode && <p>Prueba: ingresá el correo de la cuenta compradora y una tarjeta de prueba.</p>}
          {sdkReady && publicKey
            ? <BillingCardForm key={selectedPlan.id} plan={selectedPlan.key} amountCents={selectedPlan.amountCents} publicKey={publicKey} onComplete={(value) => { setMessage(value); setSelectedPlan(null); refreshStatus(); }} />
            : <p>Cargando el formulario seguro…</p>}</>}
      <button type="button" onClick={() => setSelectedPlan(null)}>Volver a planes</button>
    </section>}
    {!publicKey && <p className="billing-alert">Los pagos todavía no están configurados en este entorno.</p>}
    {status.plan !== 'prueba' && <button className="billing-cancel" type="button" onClick={async () => {
      const response = await fetch('/api/billing/cancel', { method: 'POST' });
      const result = await response.json() as { error?: string };
      setMessage(response.ok ? 'La cancelación fue solicitada.' : result.error || 'No se pudo cancelar la suscripción.');
      if (response.ok) refreshStatus();
    }}>Cancelar al final del período</button>}
    {message && <p role="status">{message}</p>}
  </main>;
}
