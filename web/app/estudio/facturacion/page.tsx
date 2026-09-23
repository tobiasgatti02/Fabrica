'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { ArrowRight, Check, CheckCircle2, Clock3, HardDrive, UsersRound, X } from 'lucide-react';
import { BillingCardForm } from '@/components/billing/card-form';

type Rights = { projects: number; storageBytes: number; professionals: number; clients: number | null; teamPermissions?: boolean; advancedAdmin?: boolean; prioritySupport?: boolean };
type BillingData = {
  state: string; plan: string; trialEnds: number; paidThrough: number | null; cancelAt: number | null;
  rights: Rights; usage: { projects: number; storageBytes: number; professionals: number; clients: number };
  lastCharge: { status: string; amountCents: number; currency: string; occurredAt: number } | null;
  subscription: { state: string; providerStatus: string | null; nextChargeAt: number | null; amountCents: number; currency: string; created: number; plan: string | null } | null;
};
type Plan = { id: string; key: string; amountCents: number; currency: string; rights: Rights };
type PlansData = { plans: Plan[]; publicKey: string | null; testMode: boolean };
const names: Record<string, string> = { prueba: 'Prueba', inicial: 'Inicial', estudio: 'Estudio', equipo: 'Equipo' };
const states: Record<string, string> = { trialing: 'Período de prueba', pending: 'Verificando pago', active: 'Activo', grace_period: 'Período de gracia', paused: 'Pausado', canceling: 'Finaliza al cierre del período', canceled: 'Cancelado', expired: 'Vencido' };
const money = (amount: number, currency = 'ARS') => new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
const bytes = (value: number) => value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 0 : 1)} GB` : `${Math.round(value / 1024 ** 2)} MB`;
const date = (value: number) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(value);
const daysUntil = (value: number) => Math.max(0, Math.ceil((value - Date.now()) / 86_400_000));

async function readStatus(): Promise<BillingData> {
  const response = await fetch('/api/billing/status', { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Iniciá sesión para ver tu facturación.' : 'No pudimos cargar la facturación.');
  return response.json() as Promise<BillingData>;
}

function Usage({ label, used, limit, formatted }: { label: string; used: number; limit: number | null; formatted?: boolean }) {
  const percent = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
  return <div className="billing-meter">
    <div className="billing-meter-label"><span>{label}</span><strong>{formatted ? bytes(used) : used} <small>/ {limit === null ? 'sin límite' : formatted ? bytes(limit) : limit}</small></strong></div>
    <div className="billing-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit ?? Math.max(1, used)} aria-valuenow={used}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const refreshStatus = useCallback(async () => { const data = await readStatus(); setStatus(data); return data; }, []);

  useEffect(() => {
    void Promise.all([refreshStatus(), fetch('/api/billing/plans').then(async (response) => {
      if (!response.ok) throw new Error('No pudimos cargar los planes.');
      return response.json() as Promise<PlansData>;
    })]).then(([initial, data]) => {
      setPlans(data.plans || []); setPublicKey(data.publicKey); setTestMode(data.testMode);
      const chosen = new URLSearchParams(window.location.search).get('plan');
      if (chosen) setSelectedPlan(data.plans.find((plan) => plan.key === chosen) || null);
      setPendingPayment(sessionStorage.getItem('fabrica-payment-pending') === '1');
      if (initial.state === 'active' && initial.lastCharge?.status === 'approved' &&
        Date.now() - initial.lastCharge.occurredAt < 15 * 60_000 &&
        sessionStorage.getItem(`fabrica-success-shown-${initial.lastCharge.occurredAt}`) !== '1') {
        sessionStorage.setItem(`fabrica-success-shown-${initial.lastCharge.occurredAt}`, '1');
        setSuccessOpen(true);
      }
    }).catch((error: Error) => setLoadError(error.message));
  }, [refreshStatus]);

  useEffect(() => {
    if (!pendingPayment && status?.subscription?.state !== 'pending') return;
    let active = true;
    const check = async () => {
      try {
        const next = await refreshStatus();
        if (!active) return;
        if (pendingPayment && next.state === 'active' && next.lastCharge?.status === 'approved') {
          sessionStorage.removeItem('fabrica-payment-pending');
          sessionStorage.setItem(`fabrica-success-shown-${next.lastCharge.occurredAt}`, '1');
          setPendingPayment(false); setSelectedPlan(null); setSuccessOpen(true); setMessage('');
        } else if (next.state === 'active') {
          setSelectedPlan(null);
        } else if (pendingPayment && next.subscription?.state !== 'pending' && next.state !== 'active') {
          sessionStorage.removeItem('fabrica-payment-pending');
          setPendingPayment(false); setMessage('El pago no se confirmó. Revisá el estado e intentá nuevamente.');
        }
      } catch { /* Preserve the last confirmed state. */ }
    };
    const timer = window.setInterval(() => void check(), 3000);
    void check();
    return () => { active = false; window.clearInterval(timer); };
  }, [pendingPayment, refreshStatus, status?.subscription?.state]);

  const onPaymentSubmitted = useCallback(() => {
    sessionStorage.setItem('fabrica-payment-pending', '1');
    setPendingPayment(true); setSelectedPlan(null);
    setMessage('Mercado Pago recibió la solicitud. Estamos verificando la acreditación.');
    void refreshStatus();
  }, [refreshStatus]);

  if (loadError) return <main className="billing-page"><div className="billing-empty" role="alert"><h1>No pudimos abrir facturación</h1><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Reintentar</button></div></main>;
  if (!status) return <main className="billing-page"><div className="billing-empty">Cargando tu facturación…</div></main>;

  const expiry = status.state === 'trialing' ? status.trialEnds : status.cancelAt || status.subscription?.nextChargeAt || status.paidThrough;
  const warning = expiry && ['trialing', 'active', 'canceling'].includes(status.state) && daysUntil(expiry) <= 3;
  const active = Boolean(status.subscription && status.state === 'active');
  const verifying = status.subscription?.state === 'pending';
  const changePlan = async () => {
    if (!selectedPlan) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/billing/change-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: selectedPlan.key }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo cambiar el plan.');
      setSelectedPlan(null); setMessage('Tu plan se actualizó. Los nuevos límites ya están disponibles.');
      await refreshStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el plan.'); }
    finally { setBusy(false); }
  };

  return <main className="billing-page">
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} />
    <nav className="billing-back"><Link href="/estudio">← Volver al estudio</Link><span>Cuenta / Facturación</span></nav>
    <header className="billing-hero"><div><p className="workspace-eyebrow">TU MEMBRESÍA</p><h1>Un estudio que crece<br /><em>con tus proyectos.</em></h1><p>Revisá tu capacidad, los próximos cobros y tu plan en un solo lugar.</p></div><div className="billing-status-card"><span>PLAN ACTUAL</span><strong>{names[status.plan] || status.plan}</strong><p><i className={`billing-dot billing-dot--${status.state}`} />{states[status.state] || status.state}</p>{expiry && <small>{status.state === 'trialing' ? 'Prueba hasta el ' : 'Próxima fecha: '}{date(expiry)}</small>}</div></header>
    {warning && <div className="billing-notice" role="status"><Clock3 size={20} /><p>{status.state === 'trialing' ? 'Tu prueba' : status.state === 'canceling' ? 'Tu acceso' : 'Tu próximo cobro'} {daysUntil(expiry) === 0 ? 'vence hoy' : `vence en ${daysUntil(expiry)} ${daysUntil(expiry) === 1 ? 'día' : 'días'}`}. {status.state === 'trialing' ? 'Elegí un plan para seguir trabajando.' : status.state === 'canceling' ? 'Podés volver a suscribirte para continuar.' : 'Verificá tu medio de pago para evitar interrupciones.'}</p></div>}
    {['grace_period', 'expired', 'canceled', 'paused'].includes(status.state) && <div className="billing-notice billing-notice--urgent" role="alert"><Clock3 size={20} /><p>El acceso de edición está suspendido. Elegí un plan para volver a trabajar en el estudio.</p></div>}
    {verifying && <div className="billing-notice" role="status"><Clock3 size={20} /><div><p>Mercado Pago está verificando el pago de {names[status.subscription?.plan || ''] || 'tu plan'}. Tu prueba sigue disponible mientras tanto.</p>{Date.now() - status.subscription!.created >= 120_000 && <button type="button" className="billing-retry" disabled={busy} onClick={async () => { setBusy(true); try { const response = await fetch('/api/billing/reset-pending', { method: 'POST' }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || 'No se pudo cancelar el intento.'); sessionStorage.removeItem('fabrica-payment-pending'); setPendingPayment(false); setMessage('El intento anterior se canceló. Podés ingresar una tarjeta nueva.'); await refreshStatus(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo reintentar.'); await refreshStatus(); } finally { setBusy(false); } }}>Cancelar intento y volver a probar</button>}</div></div>}
    {message && <output className="billing-message" role="status">{message}</output>}

    <section className="billing-section billing-current"><div className="billing-section-heading"><p className="workspace-eyebrow">01 / CAPACIDAD</p><h2>Uso del estudio</h2><p>Se cuentan los archivos de la mesa de trabajo, los modelos 3D y los planos vinculados a tus proyectos.</p></div><div className="billing-usage-card">
      <Usage label="Proyectos" used={status.usage.projects} limit={status.rights.projects} />
      <Usage label="Almacenamiento" used={status.usage.storageBytes} limit={status.rights.storageBytes} formatted />
      <Usage label="Profesionales" used={status.usage.professionals} limit={status.rights.professionals} />
      <Usage label="Clientes" used={status.usage.clients} limit={status.rights.clients} />
    </div></section>

    <section className="billing-section"><div className="billing-section-heading"><p className="workspace-eyebrow">02 / PLANES</p><h2>Elegí tu capacidad</h2><p>Precios y límites vigentes. Podés cambiar de plan desde acá.</p></div><div className="billing-plans">{plans.filter((plan) => plan.key !== 'prueba').map((plan) => {
      const current = plan.key === status.plan && ['active', 'canceling'].includes(status.state);
      const overLimit = plan.rights.projects < status.usage.projects || plan.rights.storageBytes < status.usage.storageBytes || plan.rights.professionals < status.usage.professionals || (plan.rights.clients !== null && plan.rights.clients < status.usage.clients);
      return <article className={`billing-plan ${plan.key === 'estudio' ? 'billing-plan--featured' : ''} ${selectedPlan?.id === plan.id ? 'billing-plan--selected' : ''}`} key={plan.id}>
        <div className="billing-plan-top"><span>{plan.key === 'estudio' ? 'PARA ESTUDIOS EN MARCHA' : 'SUSCRIPCIÓN MENSUAL'}</span>{current && <span className="billing-current-tag"><Check size={14} /> Actual</span>}</div>
        <h3>{names[plan.key] || plan.key}</h3><p className="billing-plan-price">{money(plan.amountCents, plan.currency)} <small>/ mes</small></p>
        <ul><li><Check size={15} />{plan.rights.projects} proyectos</li><li><HardDrive size={15} />{bytes(plan.rights.storageBytes)} entre archivos y modelos</li><li><UsersRound size={15} />{plan.rights.professionals} profesionales</li><li><Check size={15} />{plan.rights.clients === null ? 'Clientes ilimitados' : `${plan.rights.clients} clientes`}</li>{plan.rights.teamPermissions && <li><Check size={15} />Permisos por área</li>}{plan.rights.advancedAdmin && <li><Check size={15} />Administración avanzada</li>}{plan.rights.prioritySupport && <li><Check size={15} />Soporte prioritario</li>}</ul>
        <button type="button" disabled={current || !publicKey || busy || verifying || status.state === 'canceling' || (active && overLimit)} onClick={() => { setSelectedPlan(plan); setMessage(''); requestAnimationFrame(() => document.getElementById('billing-checkout')?.scrollIntoView({ behavior: 'smooth' })); }}>{current ? 'Tu plan actual' : verifying ? 'Verificando pago' : status.state === 'canceling' ? 'Acceso vigente' : overLimit && active ? 'Superás este límite' : 'Elegir plan'} {!current && <ArrowRight size={17} />}</button>
      </article>;
    })}</div></section>

    {selectedPlan && !verifying && status.state !== 'canceling' && <section className="billing-checkout" id="billing-checkout"><div className="billing-checkout-heading"><div><p className="workspace-eyebrow">03 / CONFIRMACIÓN</p><h2>{active ? 'Cambiar a' : 'Empezar con'} {names[selectedPlan.key] || selectedPlan.key}</h2><p>{money(selectedPlan.amountCents, selectedPlan.currency)} por mes. {active ? 'Confirmá el nuevo precio y capacidad.' : 'Completá los datos para activar la suscripción.'}</p></div><button type="button" className="billing-close" aria-label="Cerrar formulario" onClick={() => setSelectedPlan(null)}><X size={20} /></button></div>
      {active ? <button className="billing-primary" type="button" disabled={busy} onClick={() => void changePlan()}>{busy ? 'Actualizando…' : 'Confirmar cambio'} <ArrowRight size={17} /></button> : <>{testMode && <p className="billing-test-note">Entorno de prueba: usá una cuenta compradora y una tarjeta de prueba de Mercado Pago.</p>}{sdkReady && publicKey ? <BillingCardForm key={selectedPlan.id} plan={selectedPlan.key} amountCents={selectedPlan.amountCents} publicKey={publicKey} onComplete={onPaymentSubmitted} /> : <p>Cargando formulario seguro…</p>}</>}
    </section>}

    <section className="billing-footer"><div><h2>Próximo cobro</h2><p>{status.subscription?.nextChargeAt ? `${date(status.subscription.nextChargeAt)} · ${money(status.subscription.amountCents, status.subscription.currency)}` : 'Todavía no hay un cobro programado.'}</p><small>{status.lastCharge ? `Último movimiento: ${status.lastCharge.status === 'approved' ? 'aprobado' : status.lastCharge.status} · ${date(status.lastCharge.occurredAt)}` : 'Aún no hay pagos registrados.'}</small></div>{active && <button type="button" disabled={busy} onClick={async () => { if (!window.confirm('¿Cancelar la renovación? Conservás el acceso hasta el final del período abonado.')) return; setBusy(true); try { const response = await fetch('/api/billing/cancel', { method: 'POST' }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || 'No se pudo cancelar.'); await refreshStatus(); setMessage('La renovación fue cancelada. Conservás el acceso hasta el final del período abonado.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cancelar.'); } finally { setBusy(false); } }}>Cancelar renovación</button>}</section>
    {!publicKey && <p className="billing-test-note">Los pagos no están configurados en este entorno.</p>}
    {successOpen && <div className="billing-modal-backdrop" role="presentation" onMouseDown={() => setSuccessOpen(false)}><div className="billing-success-modal" role="dialog" aria-modal="true" aria-labelledby="billing-success-title" onMouseDown={(event) => event.stopPropagation()}><CheckCircle2 size={48} aria-hidden="true" /><p className="workspace-eyebrow">PAGO CONFIRMADO</p><h2 id="billing-success-title">Todo salió bien.</h2><p>Mercado Pago confirmó tu pago y tu plan ya está activo. Tu estudio está listo para seguir creando.</p><Link href="/estudio" className="billing-primary">Ir al estudio <ArrowRight size={18} /></Link></div></div>}
  </main>;
}
