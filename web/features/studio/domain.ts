export type Vector3Tuple = [number, number, number];

export type CameraView = {
  position: Vector3Tuple;
  target: Vector3Tuple;
};

export type StoredFile = {
  key: string;
  name: string;
  size: number;
};

export type StoredView = CameraView & {
  id: string;
  name: string;
};

export type VersionSettings = {
  hiddenObjects: string[];
  palette?: 'original' | 'warm';
  upAxis?: 'auto' | 'x' | 'y' | 'z';
};

export type StoredProject = {
  id: string;
  name: string;
  client: string | null;
};

export type StoredClient = {
  id: string;
  name: string;
  email: string;
};

export type StoredVersion = {
  id: string;
  project: string;
  name: string;
  description: string;
  sequence: number;
  sourceVersion: string | null;
  modelKind: 'demo' | 'files';
  files: string;
  views: string;
  settings: string;
  unit: 'm' | 'cm' | 'mm';
  published: number;
  created: number;
};

export type StoredComment = {
  id: string;
  mine: boolean;
  anchor: string;
  parent: string | null;
  author: string;
  text: string;
  created: number;
  scope?: 'point' | 'project';
  surface: string;
  point: string | null;
  camera?: string | null;
  version: string;
  state: 'abierto' | 'resuelto';
};

export type StoredMeasurement = {
  id: string;
  name: string;
  version: string;
  startPoint: string;
  endPoint: string;
  value: number;
  unit: string;
  created: number;
};

export type StoredPlan = {
  id: string;
  version: string;
  name: string;
  sheet: string;
  mime: string;
  key: string | null;
  size: number;
  created: number;
};

export type StudioResponse = {
  error?: string;
  anchor?: string;
  client?: StoredClient;
  id: string;
  partSize: number;
  key: string;
  name: string;
  size: number;
  share: string;
  shareEnabled: boolean;
  shareExpires: number;
  owner: boolean;
  accountOwner?: boolean;
  viewer: {
    name: string;
    guest: boolean;
  };
  versions: StoredVersion[];
  comments: StoredComment[];
  measurements: StoredMeasurement[];
  plans: StoredPlan[];
  clients: StoredClient[];
  projects: StoredProject[];
  project: StoredProject | null;
};

export const DEFAULT_VERSION_SETTINGS: VersionSettings = {
  hiddenObjects: [],
  palette: 'warm',
  upAxis: 'auto',
};

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseVersionSettings(value?: string): VersionSettings {
  const parsed = parseJson<Partial<VersionSettings>>(value, {});
  return {
    hiddenObjects: Array.isArray(parsed.hiddenObjects)
      ? parsed.hiddenObjects.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    palette: parsed.palette === 'original' ? 'original' : 'warm',
    upAxis: ['x', 'y', 'z'].includes(String(parsed.upAxis))
      ? (parsed.upAxis as 'x' | 'y' | 'z')
      : 'auto',
  };
}

export function versionLabel(version: Pick<StoredVersion, 'sequence'>) {
  return `V${String(version.sequence).padStart(2, '0')}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}
