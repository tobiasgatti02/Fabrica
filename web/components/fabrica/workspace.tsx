'use client';

import dynamic from 'next/dynamic';
import Panel from './workspace-panel';
import Team from './workspace-team';
import { hardNavigate } from './hard-navigation';
import { WorkspaceSkeleton } from './workspace-skeleton';
import { WorkspaceShareControl } from './workspace-share-control';
import {
  StudioHeader,
  StudioProjectSwitcher,
} from './studio-header';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  workspaceRequest,
  type WorkspaceData,
  type WorkspaceSection,
} from '@/features/workspace/client';
import { showErrorToast, showToast } from '@/lib/notifications';

const StudioAuthPanel = dynamic(() =>
  import('./studio-auth-panel').then((module) => module.StudioAuthPanel),
);
const Inspiration = dynamic(() => import('./workspace-inspiration'), {
  loading: () => <WorkspaceSkeleton />,
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
  runCanvas: <T = { ok: boolean }>(
    body: Record<string, unknown>,
    optimistic?: (data: WorkspaceData) => WorkspaceData,
    scope?: string,
  ) => Promise<T>;
  notify: (message: string) => void;
  openProject: (id: string) => void;
};

const workspaceViewCache = new Map<string, WorkspaceData>();
const cacheKey = (
  section: WorkspaceSection,
  project: string,
  share: string,
  invite: string,
) => [section, project, share, invite].join('|');
function cacheWorkspaceView(
  section: WorkspaceSection,
  project: string,
  share: string,
  invite: string,
  next: WorkspaceData,
) {
  const key = cacheKey(section, project, share, invite);
  workspaceViewCache.delete(key);
  workspaceViewCache.set(key, next);
  if (workspaceViewCache.size > 6) {
    workspaceViewCache.delete(workspaceViewCache.keys().next().value!);
  }
}

export default function Workspace({
  section,
  initialData,
  initialProject,
  share,
  invite,
  authenticated,
  authError,
}: {
  section: WorkspaceSection;
  initialData?: WorkspaceData | null;
  initialProject: string;
  share: string;
  invite: string;
  authenticated: boolean;
  authError: string;
}) {
  const [project, setProject] = useState(initialProject);
  const cached = workspaceViewCache.get(
    cacheKey(section, initialProject, share, invite),
  );
  const [data, setData] = useState<WorkspaceData | null>(initialData || cached || null);
  const serverData = useRef<WorkspaceData | null>(initialData || cached || null);
  // The default URL has no project query, but the response selects a project.
  const visibleProject = project || data?.project.id || '';
  const activeKey = useRef(cacheKey(section, visibleProject, share, invite));
  activeKey.current = cacheKey(section, visibleProject, share, invite);
  const canvasUpdates = useRef(new Map<number, {
    key: string;
    apply: (data: WorkspaceData) => WorkspaceData;
    settled: boolean;
  }>());
  const canvasUpdateId = useRef(0);
  const canvasQueues = useRef(new Map<string, Promise<void>>());
  const canvasSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasSyncing = useRef(false);
  const [loading, setLoading] = useState(!initialData && !cached);
  const initialRequest = useRef(initialData ? cacheKey(section, initialProject, share, invite) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invitePending, setInvitePending] = useState(
    Boolean(invite && authenticated),
  );
  const [requiresAuth, setRequiresAuth] = useState(false);
  const notify = (message: string) => showToast(message);
  const publishData = useCallback((next: WorkspaceData, key: string) => {
    if (activeKey.current !== key) return;
    serverData.current = next;
    let visible = next;
    for (const update of canvasUpdates.current.values()) {
      if (update.key === key) visible = update.apply(visible);
    }
    setData(visible);
  }, []);
  const refresh = useCallback(
    async (selected: string, signal?: AbortSignal, acknowledged: number[] = []) => {
      const key = cacheKey(section, selected, share, invite);
      const next = await workspaceRequest<WorkspaceData>(
        undefined,
        selected,
        share,
        signal,
        section,
        invite,
      );
      acknowledged.forEach((id) => canvasUpdates.current.delete(id));
      publishData(next, key);
      cacheWorkspaceView(section, selected, share, invite, next);
      if (activeKey.current === key) setError('');
      return next;
    },
    [share, section, invite, publishData],
  );
  function scheduleCanvasSync(selected: string, key: string, delay = 120) {
    if (canvasSyncTimer.current) clearTimeout(canvasSyncTimer.current);
    canvasSyncTimer.current = setTimeout(() => {
      canvasSyncTimer.current = null;
      if (canvasSyncing.current) {
        scheduleCanvasSync(selected, key, 250);
        return;
      }
      const acknowledged = [...canvasUpdates.current]
        .filter(([, update]) => update.key === key && update.settled)
        .map(([id]) => id);
      if (!acknowledged.length) return;
      canvasSyncing.current = true;
      let failed = false;
      void refresh(selected, undefined, acknowledged)
        .catch(() => {
          // Keep successful writes visible and retry reconciliation later.
          failed = true;
        })
        .finally(() => {
          canvasSyncing.current = false;
          if ([...canvasUpdates.current.values()].some((update) => update.key === key && update.settled))
            scheduleCanvasSync(selected, key, failed ? 2000 : 120);
        });
    }, delay);
  }
  const runCanvas: WorkspaceViewProps['runCanvas'] = async <T,>(
    body: Record<string, unknown>,
    optimistic?: (data: WorkspaceData) => WorkspaceData,
    scope?: string,
  ): Promise<T> => {
    const selected = data?.project.id || project;
    const key = cacheKey(section, selected, share, invite);
    const id = ++canvasUpdateId.current;
    canvasUpdates.current.set(id, { key, apply: optimistic || ((current) => current), settled: false });
    if (optimistic && serverData.current) publishData(serverData.current, key);
    const queueKey = scope ? `${selected}:${scope}` : '';
    const previous = queueKey ? canvasQueues.current.get(queueKey) : undefined;
    const request = previous
      ? previous.then(() => workspaceRequest<T>(body, selected, share, undefined, undefined, invite))
      : workspaceRequest<T>(body, selected, share, undefined, undefined, invite);
    if (queueKey) {
      const tail = request.then(() => {}, () => {});
      canvasQueues.current.set(queueKey, tail);
      void tail.then(() => {
        if (canvasQueues.current.get(queueKey) === tail) canvasQueues.current.delete(queueKey);
      });
    }
    try {
      const result = await request;
      const update = canvasUpdates.current.get(id);
      if (update) update.settled = true;
      if (activeKey.current === key) scheduleCanvasSync(selected, key);
      else canvasUpdates.current.delete(id);
      return result;
    } catch (requestError) {
      canvasUpdates.current.delete(id);
      if (optimistic && serverData.current) publishData(serverData.current, key);
      showErrorToast((requestError as Error).message);
      throw requestError;
    }
  };

  useEffect(() => {
    if (invitePending) return;
    if (!authenticated && !share && !invite) return;
    if (initialRequest.current === cacheKey(section, project, share, invite)) {
      return;
    }
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
          publishData(next, cacheKey(section, project, share, invite));
          cacheWorkspaceView(section, project, share, invite, next);
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
  }, [project, share, invite, authenticated, invitePending, section, publishData]);

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
    initialRequest.current = '';
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
          <a href="/" onClick={hardNavigate} className="workspace-logo">
            f4brica<span>estudio</span>
          </a>
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
            initialError={
              authError === 'google_unavailable'
                ? 'El acceso con Google todavía no está configurado.'
                : authError === 'google_cancelled'
                  ? 'No se completó el acceso con Google.'
                  : authError === 'google_failed'
                    ? 'No pudimos ingresar con Google. Intentá nuevamente.'
                    : ''
            }
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
        runCanvas,
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
        label={data?.viewer.name || 'Estudio local'}
        shareEnabled={Boolean(data && !loading && !error && !share && !data.viewer.external && data.viewer.accountOwner)}
        loading={loading || !data}
        project={
          <StudioProjectSwitcher
            name={data?.viewer.name || 'Estudio'}
            description={data?.viewer.guest ? 'Vista del cliente' : 'Cambiar proyecto'}
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
            actions={
              data?.viewer.accountOwner
                ? (close) => (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        close();
                        if (
                          !data ||
                          !window.confirm(
                            `¿Eliminar “${data.project.name}” y todos sus archivos? Esta acción no se puede deshacer.`,
                          )
                        )
                          return;
                        setBusy(true);
                        try {
                          const response = await fetch(
                            `/api/studio?project=${encodeURIComponent(data.project.id)}`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'delete-project',
                                id: data.project.id,
                              }),
                            },
                          );
                          const result = (await response.json()) as {
                            error?: string;
                          };
                          if (!response.ok)
                            throw new Error(
                              result.error ||
                                'No se pudo eliminar el proyecto.',
                            );
                          window.location.href = '/estudio/panel';
                        } catch (caught) {
                          showErrorToast((caught as Error).message);
                          setBusy(false);
                        }
                      }}
                    >
                      Eliminar proyecto actual
                    </button>
                  )
                : undefined
            }
          />
        }
      />
      {data && !loading && !error && !share && !data.viewer.external && data.viewer.accountOwner && (
        <WorkspaceShareControl key={data.project.id} project={data.project} showTrigger={false} />
      )}
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
        <WorkspaceSkeleton />
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
          <a href="/estudio/panel" onClick={hardNavigate}>Ir al estudio</a>
        </div>
      )}
      <footer className="workspace-footer">
        <span>Un lugar para cada decisión.</span>
      </footer>
    </main>
  );
}
