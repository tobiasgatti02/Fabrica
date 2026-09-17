'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Box,
  ChevronDown,
  LayoutDashboard,
  Lightbulb,
  MessageSquareMore,
  UsersRound,
} from 'lucide-react';
import {
  workspaceRequest,
  type WorkspaceData,
  type WorkspaceSection,
} from '@/features/workspace/client';

const Panel = dynamic(() => import('./workspace-panel'), {
  loading: () => <ViewSkeleton />,
});
const StudioAuthPanel = dynamic(() =>
  import('./studio-auth-panel').then((module) => module.StudioAuthPanel),
);
const Inspiration = dynamic(() => import('./workspace-inspiration'), {
  loading: () => <ViewSkeleton />,
});
const Proposals = dynamic(() => import('./workspace-proposals'), {
  loading: () => <ViewSkeleton />,
});
const Team = dynamic(() => import('./workspace-team'), {
  loading: () => <ViewSkeleton />,
});

export type WorkspaceViewProps = {
  data: WorkspaceData;
  project: string;
  share: string;
  busy: boolean;
  run: <T = { ok: boolean; invite?: string }>(
    body: Record<string, unknown>,
  ) => Promise<T>;
  notify: (message: string) => void;
  openProject: (id: string) => void;
};

const navigation = [
  { id: 'panel', label: 'Panel', icon: LayoutDashboard },
  { id: 'inspiracion', label: 'Inspiración', icon: Lightbulb },
  { id: 'propuestas', label: 'Propuestas', icon: MessageSquareMore },
  { id: 'modelo', label: 'Modelo 3D', icon: Box },
  { id: 'equipo', label: 'Equipo', icon: UsersRound },
] as const;

function ViewSkeleton() {
  return (
    <div className="workspace-skeleton" aria-label="Cargando vista">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function Workspace({
  section,
  initialProject,
  share,
  invite,
  authenticated,
}: {
  section: WorkspaceSection;
  initialProject: string;
  share: string;
  invite: string;
  authenticated: boolean;
}) {
  const [project, setProject] = useState(initialProject);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [projectMenu, setProjectMenu] = useState(false);
  const [invitePending, setInvitePending] = useState(Boolean(invite));
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4200);
  };
  const refresh = useCallback(
    async (selected: string, signal?: AbortSignal) => {
      const next = await workspaceRequest<WorkspaceData>(
        undefined,
        selected,
        share,
        signal,
        section,
      );
      setData(next);
      setError('');
      return next;
    },
    [share, section],
  );

  useEffect(() => {
    if (invitePending && authenticated) return;
    if (!authenticated && !share) return;
    const controller = new AbortController();
    void workspaceRequest<WorkspaceData>(undefined, project, share, controller.signal, section)
      .then((next) => {
        if (!controller.signal.aborted) { setData(next); setError(''); }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError((requestError as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [project, share, authenticated, invitePending, section]);

  useEffect(() => {
    if (!invitePending || !authenticated) return;
    void workspaceRequest({ action: 'accept-invite', token: invite }, '', '')
      .then((result) => {
        const accepted = result as { project?: string | null };
        setInvitePending(false);
        if (accepted.project) setProject(accepted.project);
        notify('Te sumaste al equipo. Ya podés trabajar en el proyecto.');
        window.history.replaceState(
          {},
          '',
          `/estudio/equipo${accepted.project ? `?project=${encodeURIComponent(accepted.project)}` : ''}`,
        );
      })
      .catch((requestError) => {
        setInvitePending(false);
        setError((requestError as Error).message);
      });
  }, [invitePending, authenticated, invite]);

  const openProject = (id: string) => {
    setProjectMenu(false);
    if (id === data?.project.id) return;
    setLoading(true);
    setProject(id);
    window.history.replaceState(
      {},
      '',
      `/estudio/${section}?project=${encodeURIComponent(id)}`,
    );
  };
  const run: WorkspaceViewProps['run'] = async <T,>(
    body: Record<string, unknown>,
  ): Promise<T> => {
    setBusy(true);
    try {
      const selected = data?.project.id || project;
      const result = await workspaceRequest<T>(body, selected, share);
      await refresh(selected);
      return result;
    } catch (requestError) {
      notify((requestError as Error).message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated && !share) {
    return (
      <main className="workspace-auth-page">
        <div className="workspace-auth-card">
          <Link href="/" className="workspace-logo">
            f4brica<span>estudio</span>
          </Link>
          <h1>
            {invite ? 'Te invitaron a colaborar' : 'Tu estudio empieza acá'}
          </h1>
          <p>
            {invite
              ? 'Ingresá con el email al que llegó la invitación para sumarte al equipo.'
              : 'Ingresá para ver tus proyectos y decisiones en un solo lugar.'}
          </p>
          <StudioAuthPanel
            sharedToken=""
            returnTo={`/estudio/${section}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`}
          />
        </div>
      </main>
    );
  }

  const query = share
    ? `share=${encodeURIComponent(share)}`
    : `project=${encodeURIComponent(data?.project.id || project)}`;
  const props = data
    ? { data, project: data.project.id, share, busy, run, notify, openProject }
    : null;
  return (
    <main className="workspace-app">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <Link
            href="/"
            className="workspace-logo"
            aria-label="F4brica, volver al inicio"
          >
            f4brica<span>estudio</span>
          </Link>
          <span className="workspace-header-rule" />
          <div className="workspace-project-wrap">
            <button
              className="workspace-project-button"
              type="button"
              onClick={() => setProjectMenu((value) => !value)}
              aria-expanded={projectMenu}
              disabled={!data || data.projects.length === 0}
            >
              <span>
                <strong>{data?.project.name || 'Cargando proyecto'}</strong>
                <small>
                  {data?.viewer.guest
                    ? 'Vista del cliente'
                    : `${data?.projects.length || 0} ${(data?.projects.length || 0) === 1 ? 'proyecto' : 'proyectos'} en el estudio`}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
            {projectMenu && data && (
              <div className="workspace-project-menu">
                {data.projects.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === data.project.id ? 'active' : ''}
                    onClick={() => openProject(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="workspace-account">
          <span className="workspace-avatar">
            {data?.viewer.name?.slice(0, 1).toUpperCase() || 'F'}
          </span>
          <span>{data?.viewer.name || 'Estudio'}</span>
        </div>
      </header>
      <nav className="workspace-nav" aria-label="Áreas del estudio">
        {navigation
          .filter((item) => !share || item.id !== 'equipo')
          .map((item) => {
            const Icon = item.icon;
            const href =
              item.id === 'modelo'
                ? `/estudio?${query}`
                : `/estudio/${item.id}?${query}`;
            return (
              <Link
                key={item.id}
                href={href}
                prefetch={item.id === 'modelo' ? false : undefined}
                aria-current={item.id === section ? 'page' : undefined}
                className={item.id === section ? 'active' : ''}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
      {error && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void refresh(data?.project.id || project).finally(() =>
                setLoading(false),
              );
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {loading || invitePending ? (
        <ViewSkeleton />
      ) : props ? (
        section === 'panel' ? (
          <Panel key={props.data.project.id} {...props} />
        ) : section === 'inspiracion' ? (
          <Inspiration key={props.data.project.id} {...props} />
        ) : section === 'propuestas' ? (
          <Proposals key={props.data.project.id} {...props} />
        ) : (
          <Team key={props.data.project.id} {...props} />
        )
      ) : (
        <div className="workspace-empty">
          <h1>No pudimos abrir el estudio</h1>
          <p>Revisá el enlace o volvé a ingresar.</p>
          <Link href="/estudio">Ir al estudio</Link>
        </div>
      )}
      {toast && (
        <output className="workspace-toast">
          {toast}
        </output>
      )}
      <footer className="workspace-footer">
        <Link href="/">
          <ArrowLeft size={14} /> Volver a F4brica
        </Link>
        <span>Un lugar para cada decisión.</span>
      </footer>
    </main>
  );
}
