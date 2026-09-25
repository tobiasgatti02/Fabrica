'use client';

import { useState, type SyntheticEvent } from 'react';
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { passwordChecks } from '@/features/auth/core';

type AuthMode = 'login' | 'register';

export function StudioAuthPanel({
  sharedToken,
  initialError,
  returnTo: returnToOverride,
}: {
  sharedToken: string;
  initialError?: string;
  returnTo?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(
    sharedToken ? 'register' : 'login',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || '');
  const checks = passwordChecks(password);
  const strongEnough =
    checks.length &&
    [checks.letters, checks.number, checks.symbol].filter(Boolean).length >= 2;
  const passwordsMatch = confirmation.length > 0 && password === confirmation;
  const returnTo = returnToOverride || (sharedToken
    ? `/estudio/modelo?share=${encodeURIComponent(sharedToken)}`
    : '/estudio/panel');
  const googleHref = `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`;

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmation('');
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    if (mode === 'register') {
      if (!strongEnough) {
        setError(
          'La contraseña debe tener 10 caracteres y combinar mayúsculas y minúsculas con un número o un símbolo.',
        );
        return;
      }
      if (!passwordsMatch) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: mode, name, email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos completar el acceso.');
      }
      window.location.replace(returnTo);
    } catch (requestError) {
      setError(
        (requestError as Error).name === 'AbortError'
          ? 'El acceso tardó demasiado. Revisá tu conexión e intentá nuevamente.'
          : (requestError as Error).message ||
              'No pudimos comunicarnos con el servicio de acceso.',
      );
      setBusy(false);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-form-wrap">
        <a className="google-access" target="_top" href={googleHref}>
          <GoogleMark />
          Continuar con Google
        </a>
        <div className="auth-divider">
          <span>o con email</span>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Acceso a Fabrica">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            aria-controls="fabrica-auth-form"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            {sharedToken ? 'Ya tengo cuenta' : 'Iniciar sesión'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            aria-controls="fabrica-auth-form"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => changeMode('register')}
          >
            {sharedToken ? 'Crear cuenta opcional' : 'Crear cuenta'}
          </button>
        </div>
        <form id="fabrica-auth-form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <label>
              {sharedToken ? 'Tu nombre' : 'Nombre del estudio'}
              <div className="auth-field">
                <UserRound />
                <input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    sharedToken ? 'Ej. Marina Costa' : 'Ej. Estudio Norte'
                  }
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
            </label>
          )}
          <label>
            Email
            <div className="auth-field">
              <Mail />
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={
                  sharedToken ? 'tu@email.com' : 'nombre@estudio.com'
                }
                required
              />
            </div>
          </label>
          <label>
            Contraseña
            <div className="auth-field">
              <LockKeyhole />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={10}
                maxLength={200}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 10 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
                }
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {mode === 'register' && (
            <>
              <div className="password-rules" aria-live="polite">
                {[
                  [checks.length, '10 caracteres'],
                  [checks.letters, 'Mayúscula y minúscula'],
                  [checks.number, 'Un número'],
                  [checks.symbol, 'Un símbolo'],
                ].map(([valid, label]) => (
                  <span className={valid ? 'valid' : ''} key={String(label)}>
                    <Check /> {label}
                  </span>
                ))}
              </div>
              <label>
                Repetir contraseña
                <div
                  className={`auth-field ${confirmation && !passwordsMatch ? 'invalid' : ''}`}
                >
                  <LockKeyhole />
                  <input
                    name="password-confirmation"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={200}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Volvé a escribirla"
                    required
                  />
                  {passwordsMatch && <Check className="field-valid" />}
                </div>
                {confirmation && !passwordsMatch && (
                  <small className="field-error">
                    Las contraseñas no coinciden.
                  </small>
                )}
              </label>
            </>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Ingresando…'
              : mode === 'register'
                ? 'Crear cuenta'
                : 'Iniciar sesión'}
          </Button>
        </form>
        {sharedToken && (
          <p className="auth-legal">También podés continuar como invitado.</p>
        )}
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.85A6 6 0 0 1 6.08 12c0-.64.11-1.27.31-1.85V7.53H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.47l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.01c1.47 0 2.79.5 3.82 1.5l2.88-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.35 2.62C7.18 7.78 9.39 6.01 12 6.01Z"
      />
    </svg>
  );
}
