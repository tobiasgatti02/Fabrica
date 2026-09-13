'use client';

import { useState, type SyntheticEvent } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type AuthMode = 'login' | 'register';

export function StudioAuthPanel({
  professionalSignIn,
  sharedToken,
}: {
  professionalSignIn: string;
  sharedToken: string;
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
  const [error, setError] = useState('');
  const checks = {
    length: password.length >= 10,
    letters: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const strength = Object.values(checks).filter(Boolean).length;
  const passwordsMatch = confirmation.length > 0 && password === confirmation;
  const returnTo = `/estudio?role=${sharedToken ? 'customer' : 'professional'}${
    sharedToken ? `&share=${encodeURIComponent(sharedToken)}` : ''
  }`;
  const chatgptReturnTo = `${returnTo}&auth=chatgpt`;
  const chatgptHref = sharedToken
    ? `/signin-with-chatgpt?return_to=${encodeURIComponent(chatgptReturnTo)}`
    : professionalSignIn;

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
      if (strength < 3) {
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
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setError((requestError as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="auth-mark">
          <ShieldCheck />
        </span>
        <p className="section-kicker">
          {sharedToken ? 'Cuenta opcional' : 'Tu estudio, en un solo lugar'}
        </p>
        <h3>
          {sharedToken
            ? 'Volvé a tus revisiones con tu propia identidad.'
            : 'Proyectos reales, separados y siempre disponibles.'}
        </h3>
        <p>
          {sharedToken
            ? 'El enlace ya te permite entrar. Usá el mismo email asociado a la invitación para conservar esta revisión en tu cuenta.'
            : 'Cada cuenta conserva únicamente los proyectos, entregas y conversaciones de su estudio.'}
        </p>
        <div className="auth-trust">
          <LockKeyhole />
          <span>
            <strong>Acceso protegido</strong>
            {sharedToken
              ? 'Podés cerrar esta ventana y seguir revisando como invitado.'
              : 'Sesión privada y contraseña cifrada con salt único.'}
          </span>
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-tabs" role="tablist" aria-label="Acceso a Fabrica">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            {sharedToken ? 'Ya tengo cuenta' : 'Iniciar sesión'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => changeMode('register')}
          >
            {sharedToken ? 'Crear cuenta opcional' : 'Crear cuenta'}
          </button>
        </div>
        <div className="auth-context">
          {sharedToken
            ? 'Acceso a una revisión compartida'
            : 'Acceso del estudio'}
        </div>
        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <label>
              {sharedToken ? 'Tu nombre' : 'Nombre del estudio'}
              <div className="auth-field">
                <UserRound />
                <input
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
              ? 'Verificando…'
              : mode === 'register'
                ? sharedToken
                  ? 'Crear mi cuenta'
                  : 'Crear cuenta y entrar'
                : sharedToken
                  ? 'Entrar y continuar'
                  : 'Entrar al estudio'}
          </Button>
        </form>
        <div className="auth-divider">
          <span>o</span>
        </div>
        <a className="chatgpt-access" target="_top" href={chatgptHref}>
          Continuar con ChatGPT <span>→</span>
        </a>
        <p className="auth-legal">
          {sharedToken
            ? 'Podés seguir sin cuenta. Si te registrás, usá el email de la invitación.'
            : 'La cuenta profesional es necesaria para crear, publicar y compartir proyectos.'}
        </p>
      </section>
    </div>
  );
}
