export type WorkspaceSection =
  | 'panel'
  | 'inspiracion'
  | 'propuestas'
  | 'equipo';
export type WorkspaceProject = {
  id: string;
  owner: string;
  client: string | null;
  name: string;
  stage: string;
  share?: string;
  shareEnabled?: number;
  shareExpires?: number;
  description: string;
  progress: number | null;
  startDate: string | null;
  dueDate: string | null;
  created: number;
};
export type WorkspaceTask = {
  id: string;
  project: string;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  clientVisible: number;
  assignee: string | null;
  created: number;
};
export type WorkspaceBudgetItem = {
  id: string;
  project: string;
  title: string;
  category: string;
  planned: number;
  committed: number;
  status: string;
  clientVisible: number;
  created: number;
};
export type WorkspaceInspiration = {
  id: string;
  project: string;
  title: string;
  note: string;
  url: string;
  asset: string | null;
  worktable: string | null;
  category: string;
  status: string;
  author: string;
  created: number;
};
export type WorkspaceWorktable = {
  id: string;
  project: string;
  title: string;
  template: string;
  created: number;
};
export type WorkspaceInspirationComment = {
  id: string;
  project: string;
  inspiration: string;
  author: string;
  text: string;
  created: number;
};
export type WorkspaceProposal = {
  id: string;
  project: string;
  title: string;
  description: string;
  status: string;
  selectedOption: string | null;
  created: number;
};
export type WorkspaceOption = {
  id: string;
  proposal: string;
  title: string;
  description: string;
  asset: string | null;
  previewAsset: string | null;
  url: string;
  costNote: string;
  timeNote: string;
  created: number;
};
export type WorkspaceFeedback = {
  id: string;
  proposal: string;
  option: string | null;
  author: string;
  kind: string;
  text: string;
  created: number;
};
export type WorkspaceAsset = {
  id: string;
  project: string;
  name: string;
  mime: string;
  size: number;
  created: number;
};
export type WorkspaceMember = {
  id: string;
  owner: string;
  project: string | null;
  email: string;
  user: string | null;
  name: string;
  role: string;
  permissions: WorkspacePermissions;
  inviteExpires: number;
  created: number;
  accepted: number | null;
};
export type WorkspaceArea = 'panel' | 'inspiracion' | 'modelo';
export type WorkspacePermission = 'none' | 'view' | 'edit';
export type WorkspacePermissions = Record<WorkspaceArea, WorkspacePermission>;
export type WorkspaceData = {
  viewer: {
    name: string;
    role: string;
    guest: boolean;
    canEdit: boolean;
    accountOwner: boolean;
    external: boolean;
    permissions: WorkspacePermissions;
  };
  project: WorkspaceProject;
  projects: WorkspaceProject[];
  projectStats: Record<string, { total: number; done: number }>;
  tasks: WorkspaceTask[];
  budgetItems: WorkspaceBudgetItem[];
  inspiration: WorkspaceInspiration[];
  worktables: WorkspaceWorktable[];
  inspirationComments: WorkspaceInspirationComment[];
  proposals: WorkspaceProposal[];
  options: WorkspaceOption[];
  feedback: WorkspaceFeedback[];
  assets: WorkspaceAsset[];
  members: WorkspaceMember[];
  clients: { id: string; name: string; email: string }[];
};

export const workspaceQuery = (project = '', share = '', invite = '') => {
  const params = new URLSearchParams();
  if (project && !share) params.set('project', project);
  if (share) params.set('share', share);
  if (invite) params.set('invite', invite);
  return params.toString();
};

export async function workspaceRequest<
  T = { ok: boolean; invite?: string; asset?: string },
>(
  body: Record<string, unknown> | undefined,
  project: string,
  share: string,
  signal?: AbortSignal,
  section?: WorkspaceSection,
  invite = '',
): Promise<T> {
  const params = new URLSearchParams(workspaceQuery(project, share, invite));
  if (!body && section) params.set('view', section);
  const query = params.toString();
  const response = await fetch(`/api/workspace${query ? `?${query}` : ''}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}

export const assetUrl = (
  id: string,
  project: string,
  share: string,
  invite = '',
) => {
  const query = workspaceQuery(project, share, invite);
  return `/api/workspace?asset=${encodeURIComponent(id)}${query ? `&${query}` : ''}`;
};

export async function createImagePreview(file: File, maxSide = 1600) {
  if (!file.type.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size < 700_000) {
      bitmap.close();
      return null;
    }
    let blob: Blob | null = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.82),
      );
    }
    bitmap.close();
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size)
      return null;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
      type: 'image/webp',
    });
  } catch {
    return null;
  }
}

export async function uploadWorkspaceAsset(
  file: File,
  project: string,
  share: string,
  invite = '',
  scope?: 'inspiration',
) {
  const { id, partSize } = await workspaceRequest<{
    id: string;
    partSize: number;
  }>(
    {
      action: 'begin-asset',
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      scope,
    },
    project,
    share,
    undefined,
    undefined,
    invite,
  );
  const query = workspaceQuery(project, share, invite);
  const parts: { partNumber: number; etag: string }[] = [];
  let nextPart = 1;
  const total = Math.ceil(file.size / partSize);
  try {
    await Promise.all(
      Array.from({ length: Math.min(3, total) }, async () => {
        while (nextPart <= total) {
          const partNumber = nextPart++;
          const response = await fetch(
            `/api/workspace?${query ? `${query}&` : ''}upload=${encodeURIComponent(id)}&part=${partNumber}`,
            {
              method: 'PUT',
              body: file.slice(
                (partNumber - 1) * partSize,
                Math.min(partNumber * partSize, file.size),
              ),
            },
          );
          const result = (await response.json()) as {
            etag?: string;
            error?: string;
          };
          if (!response.ok || !result.etag)
            throw new Error(result.error || 'No se pudo subir el archivo.');
          parts.push({ partNumber, etag: result.etag });
        }
      }),
    );
    parts.sort((a, b) => a.partNumber - b.partNumber);
    const complete = await workspaceRequest<{ asset: string }>(
      { action: 'finish-asset', id, parts },
      project,
      share,
      undefined,
      undefined,
      invite,
    );
    return complete.asset;
  } catch (error) {
    await workspaceRequest(
      { action: 'abort-asset', id },
      project,
      share,
      undefined,
      undefined,
      invite,
    ).catch(() => {});
    throw error;
  }
}

export const stageLabels: Record<string, string> = {
  idea: 'Idea',
  relevamiento: 'Relevamiento',
  anteproyecto: 'Anteproyecto',
  propuesta: 'Propuesta',
  documentacion: 'Documentación',
  obra: 'Obra',
  finalizado: 'Finalizado',
};
export const categoryLabels: Record<string, string> = {
  general: 'General',
  espacios: 'Espacios',
  materiales: 'Materiales',
  mobiliario: 'Mobiliario',
  iluminacion: 'Iluminación',
  colores: 'Colores',
};
export const inspirationStatusLabels: Record<string, string> = {
  idea: 'Nueva idea',
  revisar: 'Para revisar',
  aprobada: 'Aprobada',
  descartada: 'Descartada',
};

export const shortDate = (value: string | null | number | undefined) =>
  value
    ? new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
      }).format(
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(`${value}T12:00:00`)
          : new Date(value),
      )
    : 'Sin fecha';
