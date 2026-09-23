'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StudioTourTrigger } from './studio-tour';
import { StudioAreaNav } from './studio-area-nav';
import { WorkspaceShareControl } from './workspace-share-control';
import {
  StudioAccount,
  StudioHeader,
  StudioProjectSwitcher,
} from './studio-header';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  workspaceRequest,
  type WorkspaceData,
  type WorkspaceSection,
} from '@/features/workspace/client';
import { showErrorToast, showToast } from '@/lib/notifications';

const Panel = dynamic(() => import('./workspace-panel'), {
  loading: () => <ViewSkeleton />,
});
const StudioAuthPanel = dynamic(() =>
  import('./studio-auth-panel').then((module) => module.StudioAuthPanel),
);
const Inspiration = dynamic(() => import('./workspace-inspiration'), {
  loading: () => <ViewSkeleton />,
});
const Team = dynamic(() => import('./workspace-team'), {
  loading: () => <ViewSkeleton />,
});

export type WorkspaceViewProps = {
  data: WorkspaceData;
  project: string;
  share: string;
  invite: string;
  busy: boolean;
  run: <T = { ok: boolean; invite?: string }>(
    body: Record<string, unknown>,
  ) => Promise<T>;
  notify: (message: string) => void;
  openProject: (id: string) => void;
};

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
  const [invitePending, setInvitePending] = useState(
    Boolean(invite && authenticated),
  );
  const [requiresAuth, setRequiresAuth] = useState(false);
  const notify = (message: string) => showToast(message);
  const refresh = useCallback(
    async (selected: string, signal?: AbortSignal) => {
      const next = await workspaceRequest<WorkspaceData>(
        undefined,
        selected,
        share,
        signal,
        section,
        invite,
      );
      setData(next);
      setError('');
      return next;
    },
    [share, section, invite],
  );

  useEffect(() => {
    if (invitePending) return;
    if (!authenticated && !share && !invite) return;
    const controller = new AbortController();
    void workspaceRequest<WorkspaceData>(
      undefined,
      project,
      share,
      controller.signal,
      section,
      invite,
    )
      .then((next) => {
        if (!controller.signal.aborted) {
          setData(next);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError((requestError as Error).message);
          if (!authenticated && invite) setRequiresAuth(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [project, share, invite, authenticated, invitePending, section]);

  useEffect(() => {
    if (!invitePending || !authenticated) return;
    void workspaceRequest<{ project?: string | null; external?: boolean }>(
      { action: 'accept-invite', token: invite },
      '',
      '',
    )
      .then((accepted) => {
        setInvitePending(false);
        if (accepted.project) setProject(accepted.project);
        if (accepted.external) {
          notify('Accediste con el enlace externo.');
          return;
        }
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
    if (id === data?.project.id) return;
    setLoading(true);
    setProject(id);
    window.history.replaceState(
      {},
      '',
      `/estudio/${section}?${new URLSearchParams(invite ? { invite } : { project: id }).toString()}`,
    );
  };
  const run: WorkspaceViewProps['run'] = async <T,>(
    body: Record<string, unknown>,
  ): Promise<T> => {
    setBusy(true);
    try {
      const selected = data?.project.id || project;
      const result = await workspaceRequest<T>(
        body,
        selected,
        share,
        undefined,
        undefined,
        invite,
      );
      await refresh(selected);
      return result;
    } catch (requestError) {
      showErrorToast((requestError as Error).message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated && !share && (!invite || requiresAuth)) {
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

  const props = data
    ? {
        data,
        project: data.project.id,
        share,
        invite,
        busy,
        run,
        notify,
        openProject,
      }
    : null;
  const clientGroups =
    data?.clients.map((client) => ({
      ...client,
      projects: data.projects.filter((item) => item.client === client.id),
    })) || [];
  const unassignedProjects =
    data?.projects.filter((item) => !item.client) || [];
  return (
    <main
      className={
        'workspace-app' +
        (section === 'inspiracion' ? ' inspiration-workspace' : '')
      }
    >
      <StudioHeader
        project={
          <StudioProjectSwitcher
            name={data?.project.name || 'Cargando…'}
            description={
              data
                ? data.viewer.guest
                  ? 'Vista del cliente'
                  : `${data.projects.length} ${data.projects.length === 1 ? 'proyecto' : 'proyectos'} en el estudio`
                : ''
            }
            selectedId={data?.project.id || project}
            projects={data?.projects || []}
            groups={
              data && !data.viewer.guest
                ? [
                    ...clientGroups,
                    ...(unassignedProjects.length
                      ? [
                          {
                            id: 'unassigned',
                            name: 'Sin contacto asignado',
                            projects: unassignedProjects,
                            unassigned: true,
                          },
                        ]
                      : []),
                  ]
                : []
            }
            menuTitle={
              data?.viewer.guest ? 'Proyecto' : 'Contactos y proyectos'
            }
            menuCount={
              data?.viewer.guest
                ? data.projects.length
                : data?.clients.length || 0
            }
            onSelect={openProject}
          />
        }
        actions={
          data && !loading && !error && !share && data.viewer.accountOwner ? (
            <StudioTourTrigger />
          ) : null
        }
        account={
          <StudioAccount
            name={data?.viewer.name || 'Estudio'}
            href={
              data?.viewer.external
                ? undefined
                : `/estudio?${new URLSearchParams({ ...(data?.project.id ? { project: data.project.id } : {}), account: '1' }).toString()}`
            }
          />
        }
      />
      <StudioAreaNav
        area={section}
        project={project || data?.project.id || ''}
        share={share}
        invite={invite}
        showTeam={!share && !data?.viewer.external}
        showModel={!data?.viewer.external}
        permissions={data?.viewer.permissions}
        action={
          data &&
          !loading &&
          !error &&
          !share &&
          !data.viewer.external &&
          data.viewer.accountOwner ? (
            <WorkspaceShareControl
              key={data.project.id}
              project={data.project}
            />
          ) : undefined
        }
      />
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
      <footer className="workspace-footer">
        
        <span>Un lugar para cada decisión.</span>
      </footer>
    </main>
  );
}
