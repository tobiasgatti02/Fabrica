'use client';

import { useEffect, useState } from 'react';

type CardFormData = { token?: string; cardholderEmail?: string };
type MercadoPagoCardForm = {
  getCardFormData(): CardFormData;
  unmount?(): void;
};
type MercadoPagoConstructor = new (key: string, options: { locale: string }) => {
  cardForm(options: Record<string, unknown>): MercadoPagoCardForm;
};

declare global {
  interface Window { MercadoPago?: MercadoPagoConstructor }
}

export function BillingCardForm({ plan, amountCents, publicKey, onComplete }: {
  plan: string;
  amountCents: number;
  publicKey: string;
  onComplete: (message: string) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!window.MercadoPago) {
      queueMicrotask(() => { if (!disposed) setError('No se pudo cargar el formulario seguro de Mercado Pago. Recargá la página.'); });
      return () => { disposed = true; };
    }
    let submitting = false;
    const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' });
    const cardForm = mp.cardForm({
      amount: String(amountCents / 100),
      iframe: true,
      form: {
        id: 'billing-card-form',
        cardNumber: { id: 'billing-card-number', placeholder: 'Número de tarjeta' },
        expirationDate: { id: 'billing-card-expiry', placeholder: 'MM/AA' },
        securityCode: { id: 'billing-card-cvv', placeholder: 'Código de seguridad' },
        cardholderName: { id: 'billing-card-name', placeholder: 'Nombre del titular' },
        issuer: { id: 'billing-card-issuer', placeholder: 'Banco emisor' },
        installments: { id: 'billing-card-installments', placeholder: 'Cuotas' },
        identificationType: { id: 'billing-card-document-type', placeholder: 'Tipo de documento' },
        identificationNumber: { id: 'billing-card-document-number', placeholder: 'Número de documento' },
        cardholderEmail: { id: 'billing-card-email', placeholder: 'Correo del comprador' },
      },
      callbacks: {
        onFormMounted: (mountError?: unknown) => {
          if (mountError && !disposed) setError('No se pudo iniciar el formulario de Mercado Pago.');
        },
        onSubmit: async (event: Event) => {
          event.preventDefault();
          if (submitting || disposed) return;
          submitting = true;
          setBusy(true);
          setError('');
          try {
            const { token, cardholderEmail } = cardForm.getCardFormData();
            if (!token || !cardholderEmail) throw new Error('Completá los datos de la tarjeta y el correo del comprador.');
            const response = await fetch('/api/billing/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan, cardTokenId: token, payerEmail: cardholderEmail }),
            });
            const result = await response.json() as { error?: string; providerStatus?: string; providerCodes?: string[] };
            if (!response.ok) throw new Error(`${result.error || 'No se pudo crear la suscripción.'}${result.providerCodes?.length ? ` (${result.providerCodes.join(', ')})` : ''}`);
            onComplete(`Suscripción enviada a Mercado Pago (${result.providerStatus || 'pendiente'}). Estamos verificando el pago.`);
          } catch (caught) {
            if (!disposed) setError(caught instanceof Error ? caught.message : 'No se pudo crear la suscripción.');
          } finally {
            submitting = false;
            if (!disposed) setBusy(false);
          }
        },
      },
    });
    return () => { disposed = true; cardForm.unmount?.(); };
  }, [plan, amountCents, publicKey, onComplete]);

  return <form id="billing-card-form" className="billing-card-form">
    <h3>Datos de pago</h3>
    <p>Los datos de la tarjeta se procesan en los campos seguros de Mercado Pago.</p>
    <fieldset><legend>Número de tarjeta</legend><div id="billing-card-number" className="billing-card-field" /></fieldset>
    <fieldset><legend>Vencimiento</legend><div id="billing-card-expiry" className="billing-card-field" /></fieldset>
    <fieldset><legend>Código de seguridad</legend><div id="billing-card-cvv" className="billing-card-field" /></fieldset>
    <label>Nombre del titular<input id="billing-card-name" autoComplete="cc-name" required /></label>
    <label>Banco emisor<select id="billing-card-issuer" aria-label="Banco emisor" /></label>
    <label>Cuotas<select id="billing-card-installments" aria-label="Cuotas" /></label>
    <label>Tipo de documento<select id="billing-card-document-type" aria-label="Tipo de documento" /></label>
    <label>Número de documento<input id="billing-card-document-number" required /></label>
    <label>Correo del comprador<input id="billing-card-email" type="email" required /></label>
    {error && <p role="alert" className="billing-alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Procesando…' : 'Confirmar suscripción'}</button>
  </form>;
}
