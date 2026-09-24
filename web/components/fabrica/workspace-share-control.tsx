'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Link2, RotateCcw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { studioRequest } from '@/features/studio/api';
import { showErrorToast, showToast } from '@/lib/notifications';
import type { WorkspaceProject } from '@/features/workspace/client';

export function WorkspaceShareControl({
  project,
  showTrigger = true,
}: {
  project: WorkspaceProject;
  showTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(project.share || '');
  const [enabled, setEnabled] = useState(Boolean(project.shareEnabled));
  const [expires, setExpires] = useState(project.shareExpires || 0);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  useEffect(() => {
    const openShare = () => { setCheckedAt(Date.now()); setOpen(true); };
    window.addEventListener('fabrica:open-share', openShare);
    return () => window.removeEventListener('fabrica:open-share', openShare);
  }, []);
  const active =
    enabled && Boolean(token) && (!expires || expires > checkedAt);
  const link = (value: string) =>
    `${window.location.origin}/estudio/panel?share=${encodeURIComponent(value)}`;

  const create = async (copy: boolean) => {
    setBusy(true);
    try {
      const result = await studioRequest(
        { action: 'share', days },
        '',
        project.id,
      );
      setToken(result.share || '');
      setEnabled(true);
      setExpires(result.shareExpires || 0);
      if (copy && result.share) {
        await navigator.clipboard.writeText(link(result.share));
        showToast('Enlace del cliente copiado');
      } else {
        showToast('Enlace del cliente actualizado');
      }
    } catch (error) {
      showErrorToast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!active) return create(true);
    try {
      await navigator.clipboard.writeText(link(token));
      showToast('Enlace del cliente copiado');
    } catch (error) {
      showErrorToast((error as Error).message);
    }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await studioRequest({ action: 'revoke-share' }, '', project.id);
      setToken('');
      setEnabled(false);
      setExpires(0);
      showToast('Enlace revocado');
    } catch (error) {
      showErrorToast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showTrigger && <button
        type="button"
        className="studio-nav-share"
      onClick={() => { setCheckedAt(Date.now()); setOpen(true); }}
      >
        <Share2 aria-hidden="true" /> Compartir
      </button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="small-studio-dialog share-access-dialog">
          <DialogTitle>Compartir con el cliente</DialogTitle>
          <DialogDescription>
            El enlace privado abre el panel del proyecto. Podés renovarlo o
            revocarlo cuando quieras.
          </DialogDescription>
          <div className={`share-status ${active ? 'active' : ''}`}>
            <span className="share-status-icon">
              {active ? <Link2 /> : <CalendarClock />}
            </span>
            <div>
              <strong>
                {active ? 'Enlace activo' : 'No hay un enlace activo'}
              </strong>
              <small>
                {active
                  ? expires
                    ? `Disponible hasta ${new Date(expires).toLocaleDateString('es-AR')}`
                    : 'Sin vencimiento'
                  : 'Creá uno para compartir el proyecto.'}
              </small>
            </div>
          </div>
          <label className="workspace-share-duration">
            Duración del nuevo enlace
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
          <p className="share-help">Renovar el enlace invalida el anterior.</p>
          <div className="share-actions">
            {active && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void revoke()}
              >
                Revocar
              </Button>
            )}
            {active && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void create(false)}
              >
                <RotateCcw /> Renovar
              </Button>
            )}
            <Button disabled={busy} onClick={() => void copy()}>
              <Link2 />
              {busy
                ? 'Preparando…'
                : active
                  ? 'Copiar enlace'
                  : 'Crear y copiar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
