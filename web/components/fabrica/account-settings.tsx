'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDescriptionUi,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleUi,
} from '@/components/ui/alert-dialog';

export type Account = {
  name: string;
  email: string;
  provider: 'chatgpt' | 'google' | 'fabrica';
  created?: number;
};

export function AccountSettings({
  account,
  onUpdated,
}: {
  account: Account;
  onUpdated: (account: Account) => void;
}) {
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const request = async (body: Record<string, string>) => {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      error?: string;
      name?: string;
      email?: string;
    };
    if (!response.ok)
      throw new Error(data.error || 'No pudimos completar la acción.');
    return data;
  };

  return (
    <section className="account-settings" aria-label="Configuración de cuenta">
      <div className="account-settings-heading">
        <h3>Configuración</h3>
        <p>Actualizá los datos con los que accedés a Fabrica.</p>
        {typeof account.created === 'number' && (
          <p>
            Cuenta creada el{' '}
            {new Intl.DateTimeFormat('es-AR', {
              dateStyle: 'long',
              timeZone: 'America/Argentina/Buenos_Aires',
            }).format(account.created)}
            .
          </p>
        )}
      </div>
      <form
        className="account-settings-card"
        onSubmit={(event) => {
          event.preventDefault();
          setSavingProfile(true);
          setMessage('');
          void request({ action: 'update-profile', name, email })
            .then((data) => {
              onUpdated({
                ...account,
                name: data.name || name,
                email: data.email || email,
              });
              setMessage('Datos actualizados.');
            })
            .catch((error: Error) => setMessage(error.message))
            .finally(() => setSavingProfile(false));
        }}
      >
        <strong>Datos personales</strong>
        <label>
          Nombre
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <Button type="submit" variant="outline" disabled={savingProfile}>
          {savingProfile ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
      {account.provider === 'fabrica' ? (
        <form
          className="account-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            setSavingPassword(true);
            setMessage('');
            void request({ action: 'update-password', password })
              .then(() => {
                setPassword('');
                setMessage('Contraseña actualizada.');
              })
              .catch((error: Error) => setMessage(error.message))
              .finally(() => setSavingPassword(false));
          }}
        >
          <strong>Contraseña</strong>
          <p>
            Usá 10 o más caracteres, mayúsculas, minúsculas y un número o
            símbolo.
          </p>
          <label>
            Nueva contraseña
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <Button type="submit" variant="outline" disabled={savingPassword}>
            {savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      ) : account.provider === 'google' ? (
        <div className="account-settings-card account-provider-note">
          <strong>Contraseña</strong>
          <p>Tu cuenta usa Google. La contraseña se administra desde allí.</p>
        </div>
      ) : null}
      <div className="account-settings-card account-danger">
        <strong>Eliminar cuenta</strong>
        <p>
          Se eliminarán definitivamente tus proyectos, archivos y datos
          asociados. Esta acción no se puede deshacer.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDeleteOpen(true)}
        >
          Eliminar cuenta
        </Button>
      </div>
      {message && (
        <p className="account-settings-message" role="status">
          {message}
        </p>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitleUi>¿Eliminar tu cuenta?</AlertDialogTitleUi>
            <AlertDialogDescriptionUi>
              Esta acción elimina todo el contenido de tu cuenta de forma
              permanente. Escribí <strong>ELIMINAR</strong> para confirmarla.
            </AlertDialogDescriptionUi>
          </AlertDialogHeader>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="ELIMINAR"
            aria-label="Confirmación para eliminar cuenta"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={confirmation !== 'ELIMINAR' || deleting}
              onClick={() => {
                setDeleting(true);
                void request({ action: 'delete-account', confirmation })
                  .then(() => window.location.assign('/'))
                  .catch((error: Error) => {
                    setMessage(error.message);
                    setDeleteOpen(false);
                  })
                  .finally(() => setDeleting(false));
              }}
            >
              {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

