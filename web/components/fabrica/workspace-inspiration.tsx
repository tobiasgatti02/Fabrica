'use client';

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import Image from 'next/image';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  ArrowUpRight,
  Circle,
  Bold,
  Eraser,
  FileText,
  FileUp,
  Frame,
  GripHorizontal,
  Hand,
  ImagePlus,
  SmilePlus,
  Tag,
  X,
  Keyboard,
  Trash2,
  Pencil,
  Link2,
  LockKeyhole,
  UnlockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Minus,
  MousePointer2,
  PencilLine,
  Highlighter,
  Sparkles,
  Lasso,
  Group,
  Ungroup,
  Plus,
  Redo2,
  Scan,
  Square,
  StickyNote,
  Type,
  Undo2,
  UsersRound,
} from 'lucide-react';
import { InspirationCanvas } from './inspiration-canvas';
import { ImageEditor } from './image-editor';
import {
  boardReducer,
  emptyBoard,
  elementIndex,
  parseElements,
  safeReferenceUrl,
  simplifyStroke,
  validPoint,
  MAX_STROKE_POINTS,
  MAX_ELEMENTS,
  unionBounds,
  SpatialIndex,
  type BoardSnapshot,
} from '@/features/workspace/inspiration-scene';
import type { WorkspaceViewProps } from './workspace';
import {
  assetUrl,
  createImagePreview,
  shortDate,
  uploadWorkspaceAsset,
  type WorkspaceAsset,
  type WorkspaceInspiration,
  type WorkspaceWorktable,
} from '@/features/workspace/client';
import { formatBytes } from '@/features/studio/domain';
import {
  boardClipboard,
  boundsForCanvasElement,
  canvasElementAt,
  clipboardReferenceType,
  findAlignment,
  translateCanvasElement,
  type Point,
  type AlignmentGuide,
  type BoardBounds,
  type CanvasElement,
  type StrokeStyle,
} from '@/features/workspace/inspiration-board';
import { inspirationFileError } from '@/features/files/validation';
import { showErrorToast } from '@/lib/notifications';
import { useStudioPresence, type PresenceCamera, type PresenceCursor } from '@/features/studio/presence';

type Camera = Point & { zoom: number };
const worktableTemplates = [
  { id: 'blank', title: 'Mesa en blanco' },
  { id: 'facade', title: 'Tablero 1 · Detalles de fachada' },
  { id: 'interior', title: 'Tablero 2 · Detalles de interiorismo' },
  { id: 'inspiration', title: 'Tablero 3 · Inspiración' },
  { id: 'renders', title: 'Tablero 4 · Renders y fotos' },
  { id: 'plans', title: 'Tablero 5 · Planos' },
] as const;
function templateElements(template: string): CanvasElement[] {
  const sections: Record<string, string[]> = {
    facade: ['Materiales', 'Encuentros y terminaciones', 'Referencias'],
    interior: ['Espacios', 'Materiales y mobiliario', 'Detalles'],
    inspiration: ['Ideas', 'Referencias', 'Paleta'],
    renders: ['Vistas exteriores', 'Vistas interiores', 'Selección final'],
    plans: ['Plantas', 'Cortes y elevaciones', 'Detalles constructivos'],
  };
  return (sections[template] || []).map((title, index) => ({
    id: `template-${template}-${index}`,
    type: 'frame' as const,
    x: index * 690,
    y: 40,
    width: 640,
    height: 760,
    title,
    fill: '#f4f2eb',
    stroke: '#9aab92',
    weight: 2,
    style: 'solid' as const,
  }));
}
type Draft = {
  title: string;
  note?: string;
  sequenceFrom?: string;
  url?: string;
  asset?: string;
  file?: File;
  category?: string;
  sticky?: StickyMeta;
};
type Pending = {
  id: string;
  draft: Draft;
  point: Point;
  preview?: string;
  error?: string;
};
type PanGesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  kind: 'pan';
};
type CardGesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  kind: 'card';
  card: string;
  point: Point;
  targets: BoardBounds[];
  before: BoardSnapshot;
};
type ResizeGesture = {
  pointer: number;
  start: Point;
  kind: 'resize';
  card: string;
  size: { width: number; height: number };
};
type FrameResizeGesture = {
  kind: 'frame-resize';
  pointer: number;
  start: Point;
  element: Extract<CanvasElement, { type: 'frame' }>;
  corner: 'nw' | 'ne' | 'sw' | 'se';
  before: BoardSnapshot;
};
type CanvasGesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  kind: 'canvas';
  element: CanvasElement;
  before: BoardSnapshot;
  targets: BoardBounds[];
};
type MultiGesture = {
  kind: 'multi';
  pointer: number;
  start: Point;
  camera: Camera;
  before: BoardSnapshot;
  cards: { id: string; point: Point }[];
  elements: CanvasElement[];
};
type MarqueeGesture = {
  kind: 'marquee';
  pointer: number;
  start: Point;
  camera: Camera;
  origin: Point;
  additive: boolean;
  points: Point[];
};
type Gesture =
  | PanGesture
  | CardGesture
  | CanvasGesture
  | ResizeGesture
  | FrameResizeGesture
  | MultiGesture
  | MarqueeGesture;
type BoardContextMenu = {
  x: number;
  y: number;
  point: Point;
  card?: string;
  isPostIt: boolean;
};
type CanvasTool =
  | 'select'
  | 'sticky'
  | 'text'
  | 'frame'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'draw'
  | 'marker'
  | 'smart'
  | 'lasso'
  | 'erase'
  | 'erase-area';
type ActiveCanvasElement = {
  pointer: number;
  type: Exclude<
    CanvasTool,
    'select' | 'sticky' | 'text' | 'erase' | 'erase-area' | 'lasso'
  >;
  start: Point;
  points: Point[];
  targets: BoardBounds[];
};
type CanvasPreview = { element: CanvasElement; guides: AlignmentGuide[] };
const initialCamera = { x: 60, y: 90, zoom: 1 };
function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
const stickyColors = [
  '#fff3a6',
  '#ffe36e',
  '#ffb36d',
  '#ff969b',
  '#ffd0ec',
  '#ed8bda',
  '#a9caff',
  '#ada4f5',
  '#8bdcf4',
  '#7ca6ea',
  '#72dbd1',
  '#5dd786',
  '#c9eb8c',
  '#a7e35b',
  '#f2f2ef',
  '#303030',
] as const;
type StickyMeta = {
  color: string;
  width: number;
  height: number;
  tags: string[];
  reactions: Record<string, number>;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  locked: boolean;
};
const defaultStickyMeta = (color: string = stickyColors[0]): StickyMeta => ({
  color,
  width: 260,
  height: 260,
  tags: [],
  reactions: {},
  fontSize: 18,
  bold: false,
  align: 'left',
  locked: false,
});
function readStickyMetadata(project: string): Record<string, StickyMeta> {
  try {
    const value = JSON.parse(
      localStorage.getItem('fabrica:inspiration-stickies:' + project) || '{}',
    ) as Record<string, Partial<StickyMeta>>;
    return Object.fromEntries(
      Object.entries(value).flatMap(([id, item]) => {
        if (!item || typeof item !== 'object' || id.length > 100) return [];
        const color =
          typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color)
            ? item.color
            : stickyColors[0];
        const width = Math.min(800, Math.max(180, Number(item.width) || 260));
        const height = Math.min(800, Math.max(180, Number(item.height) || 260));
        const tags = Array.isArray(item.tags)
          ? item.tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim().slice(0, 24))
              .filter(Boolean)
              .slice(0, 5)
          : [];
        const reactions = Object.fromEntries(
          Object.entries(item.reactions || {})
            .filter(
              ([emoji, count]) =>
                emoji.length <= 8 &&
                typeof count === 'number' &&
                Number.isFinite(count) &&
                count > 0,
            )
            .slice(0, 8)
            .map(([emoji, count]) => [emoji, Math.min(999, Math.floor(count))]),
        );
        const fontSize = Math.min(
          36,
          Math.max(12, Number(item.fontSize) || 18),
        );
        const align =
          item.align === 'center' || item.align === 'right'
            ? item.align
            : 'left';
        return [
          [
            id,
            {
              color,
              width,
              height,
              tags,
              reactions,
              fontSize,
              bold: item.bold === true,
              align,
              locked: item.locked === true,
            },
          ],
        ];
      }),
    );
  } catch {
    return {};
  }
}
type StickyLink = { from: string; to: string };
function readStickyLinks(project: string): StickyLink[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem('fabrica:inspiration-sticky-links:' + project) ||
        '[]',
    );
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, 1000)
      .filter(
        (link): link is StickyLink =>
          link &&
          typeof link.from === 'string' &&
          typeof link.to === 'string' &&
          link.from.length <= 100 &&
          link.to.length <= 100 &&
          link.from !== link.to,
      );
  } catch {
    return [];
  }
}
const stickyCursor = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 4h21v18l-7 7H6z" fill="${color}" stroke="#252525" stroke-width="2"/><path d="M20 29v-7h7" fill="none" stroke="#252525" stroke-width="2"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 7 5, crosshair`;
};
const framePresets = [
  { label: 'A4', width: 595, height: 842 },
  { label: 'Letter', width: 612, height: 792 },
  { label: '16 : 9', width: 640, height: 360 },
  { label: '4 : 3', width: 600, height: 450 },
  { label: '1 : 1', width: 480, height: 480 },
  { label: 'Mobile', width: 390, height: 844 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Desktop', width: 1280, height: 800 },
] as const;
const editableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

function readPositions(project: string): Record<string, Point> {
  try {
    const stored = JSON.parse(
      localStorage.getItem('fabrica:inspiration:' + project) || '{}',
    ) as Record<string, Point>;
    return Object.fromEntries(
      Object.entries(stored).filter(([, point]) => validPoint(point)),
    );
  } catch {
    return {};
  }
}

function readCanvasElements(project: string): CanvasElement[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem('fabrica:inspiration-elements:' + project) || '[]',
    );
    return parseElements(stored);
  } catch {
    return [];
  }
}

function CommentBubble({
  count,
  title,
  onClick,
  latest,
  sticky = false,
  position,
  zoom = 1,
  onMove,
}: {
  count: number;
  title: string;
  onClick: () => void;
  latest?: { author: string; text: string; created: number };
  sticky?: boolean;
  position?: Point;
  zoom?: number;
  onMove?: (point: Point) => void;
}) {
  const drag = useRef<{ pointer: number; x: number; y: number; start: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  return (
    <button
      type="button"
      className="inspiration-comment-bubble"
      data-comment-bubble
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      aria-label={`Ver comentarios de ${title}. ${count} comentarios.`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!onMove || event.button !== 0) return;
        drag.current = {
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          start: position || { x: event.currentTarget.offsetLeft, y: event.currentTarget.offsetTop },
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointer !== event.pointerId || !onMove) return;
        event.stopPropagation();
        const dx = (event.clientX - active.x) / zoom;
        const dy = (event.clientY - active.y) / zoom;
        if (Math.hypot(dx, dy) > 3) active.moved = true;
        if (active.moved) onMove({ x: active.start.x + dx, y: active.start.y + dy });
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        suppressClick.current = Boolean(drag.current?.moved);
        drag.current = null;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }}
      onPointerCancel={(event) => { event.stopPropagation(); drag.current = null; }}
      onClick={(event) => {
        event.stopPropagation();
        if (suppressClick.current) { suppressClick.current = false; return; }
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {sticky && latest ? (
        <span className="inspiration-comment-avatar" aria-hidden="true">
          {latest.author.trim().charAt(0).toUpperCase() || '?'}
        </span>
      ) : (
        <><MessageCircle size={15} /> {!sticky && <span>{count}</span>}</>
      )}
      {latest && (
        <span className="inspiration-comment-preview" aria-hidden="true">
          <span className="inspiration-comment-preview-avatar">{latest.author.trim().charAt(0).toUpperCase() || '?'}</span>
          <span className="inspiration-comment-preview-content">
            <span className="inspiration-comment-preview-heading"><strong>{latest.author}</strong><time>{shortDate(latest.created)}</time></span>
            <span className="inspiration-comment-preview-text">{latest.text}</span>
            {count > 1 && <span className="inspiration-comment-preview-count">{count - 1} {count === 2 ? 'respuesta' : 'respuestas'}</span>}
          </span>
        </span>
      )}
    </button>
  );
}

function commentTimestamp(value: number) {
  const date = new Date(value);
  const today = new Date();
  const time = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date);
  return date.toDateString() === today.toDateString() ? `Hoy, ${time}` : `${shortDate(value)}, ${time}`;
}

function Media({
  asset,
  project,
  share,
  invite,
  alt,
  fullFrame = false,
  resizable = false,
  zoom = 1,
}: {
  asset: WorkspaceAsset;
  project: string;
  share: string;
  invite?: string;
  alt?: string;
  fullFrame?: boolean;
  resizable?: boolean;
  zoom?: number;
}) {
  const maxPhotoDimension = 2000;
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const photoSizeKey = `fabrica:photo-size:${project}:${asset.id}`;
  const photoRatio = useRef(1);
  const [photoSize, setPhotoSize] = useState(() => {
    if (typeof window === 'undefined' || !fullFrame)
      return { width: 300, height: 200 };
    try {
      const saved = JSON.parse(localStorage.getItem(photoSizeKey) || 'null');
      if (
        saved &&
        Number.isFinite(saved.width) &&
        Number.isFinite(saved.height)
      )
        return {
          width: Math.min(maxPhotoDimension, Math.max(140, saved.width)),
          height: Math.min(maxPhotoDimension, Math.max(100, saved.height)),
        };
    } catch {
      /* Use the image's natural dimensions. */
    }
    return { width: 300, height: 200 };
  });
  const updatePhotoSize = (size: { width: number; height: number }) => {
    setPhotoSize(size);
    try {
      localStorage.setItem(photoSizeKey, JSON.stringify(size));
    } catch {
      /* The photo remains resizable for this session. */
    }
  };
  const photoResize = useRef<{
    pointer: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const source = assetUrl(asset.id, project, share, invite);
  // No media URL is mounted until the card approaches the visible canvas.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: node.closest('.inspiration-board-shell'), rootMargin: '250px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const image = /^image\/(jpeg|png|webp|avif)$/.test(asset.mime);
  return (
    <div
      ref={ref}
      className={
        'inspiration-media' + (fullFrame ? ' inspiration-photo-media' : '')
      }
      style={fullFrame ? photoSize : undefined}
    >
      {fullFrame && resizable && (
        <button
          type="button"
          className="inspiration-photo-resize"
          aria-label="Redimensionar foto"
          title="Arrastrá para redimensionar"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            photoResize.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              ...photoSize,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = photoResize.current;
            if (!start || start.pointer !== event.pointerId) return;
            const ratio = photoRatio.current;
            const dx = (event.clientX - start.x) / zoom;
            const dy = (event.clientY - start.y) / zoom;
            const change =
              Math.abs(dx) >= Math.abs(dy * ratio) ? dx : dy * ratio;
            const maxWidth = Math.min(
              maxPhotoDimension,
              maxPhotoDimension * ratio,
            );
            const minWidth = Math.min(maxWidth, Math.max(140, 100 * ratio));
            const width = Math.min(
              maxWidth,
              Math.max(minWidth, start.width + change),
            );
            updatePhotoSize({ width, height: width / ratio });
          }}
          onPointerUp={() => {
            photoResize.current = null;
          }}
          onPointerCancel={() => {
            photoResize.current = null;
          }}
        />
      )}
      {image && !failed ? (
        <>
          {near && (
            <Image
              src={source}
              alt={alt || asset.name}
              width={600}
              height={400}
              unoptimized
              loading="lazy"
              draggable={false}
              onLoad={(event) => {
                if (fullFrame) {
                  const ratio =
                    event.currentTarget.naturalWidth /
                    event.currentTarget.naturalHeight;
                  if (Number.isFinite(ratio) && ratio > 0) {
                    photoRatio.current = ratio;
                    let savedWidth: number | undefined;
                    try {
                      const saved = JSON.parse(
                        localStorage.getItem(photoSizeKey) || 'null',
                      );
                      if (saved && Number.isFinite(saved.width))
                        savedWidth = saved.width;
                    } catch {
                      /* Use the natural image size. */
                    }
                    const maxWidth = Math.min(
                      maxPhotoDimension,
                      maxPhotoDimension * ratio,
                    );
                    const minWidth = Math.min(
                      maxWidth,
                      Math.max(140, 100 * ratio),
                    );
                    const width = Math.min(
                      maxWidth,
                      Math.max(
                        minWidth,
                        savedWidth ?? Math.min(320, Math.max(180, 420 * ratio)),
                      ),
                    );
                    updatePhotoSize({ width, height: width / ratio });
                  }
                }
              }}
              onError={() => setFailed(true)}
            />
          )}
        </>
      ) : (
        <a
          className="inspiration-file-art"
          href={source}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FileText size={30} />
          <strong>{asset.name}</strong>
          <small>
            {formatBytes(asset.size)} ·{' '}
            {failed ? 'Abrir imagen' : 'Descargar archivo'}
          </small>
        </a>
      )}
    </div>
  );
}

function PhotoFrame({
  item,
  asset,
  project,
  share,
  invite,
  selected,
  canEdit,
  locked,
  zoom,
  onDrag,
}: {
  item: WorkspaceInspiration;
  asset: WorkspaceAsset;
  project: string;
  share: string;
  invite: string;
  selected: boolean;
  canEdit: boolean;
  locked: boolean;
  zoom: number;
  onDrag: (event: PointerEvent<HTMLElement>, id: string) => void;
}) {
  return (
    <div
      className="inspiration-photo-frame"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button, a')) return;
        onDrag(event, item.id);
      }}
    >
      <Media
        key={asset.id}
        asset={asset}
        project={project}
        share={share}
        invite={invite}
        alt={item.note || item.title}
        fullFrame
        resizable={selected && canEdit && !locked}
        zoom={zoom}
      />
    </div>
  );
}

function PendingPhoto({ entry, project, zoom, selected }: {
  entry: Pending;
  project: string;
  zoom: number;
  selected: boolean;
}) {
  const sizeKey = `fabrica:photo-size:${project}:${entry.id}`;
  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(sizeKey) || 'null');
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) return saved;
    } catch { /* Use the initial photo size. */ }
    return { width: 300, height: 200 };
  });
  const ratio = useRef(1.5);
  const resize = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const saveSize = (width: number) => {
    const next = { width, height: width / ratio.current };
    setSize(next);
    try { localStorage.setItem(sizeKey, JSON.stringify(next)); } catch { /* Keep the session size. */ }
  };
  return (
    <div className="inspiration-media inspiration-photo-media" style={size}>
      <Image
        src={entry.preview!}
        alt={entry.draft.title}
        width={600}
        height={400}
        unoptimized
        draggable={false}
        onLoad={(event) => {
          const naturalRatio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight;
          if (!Number.isFinite(naturalRatio) || naturalRatio <= 0) return;
          ratio.current = naturalRatio;
          let savedWidth: number | undefined;
          try {
            const saved = JSON.parse(localStorage.getItem(sizeKey) || 'null');
            if (Number.isFinite(saved?.width)) savedWidth = saved.width;
          } catch { /* Use the natural image size. */ }
          saveSize(savedWidth ?? Math.min(320, Math.max(180, 420 * naturalRatio)));
        }}
      />
      {selected && (
        <button
          type="button"
          className="inspiration-photo-resize"
          aria-label="Redimensionar foto"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            resize.current = { pointer: event.pointerId, x: event.clientX, width: size.width };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = resize.current;
            if (!start || start.pointer !== event.pointerId) return;
            const maxWidth = Math.min(2000, 2000 * ratio.current);
            const minWidth = Math.min(maxWidth, Math.max(140, 100 * ratio.current));
            saveSize(Math.min(maxWidth, Math.max(minWidth, start.width + (event.clientX - start.x) / zoom)));
          }}
          onPointerUp={() => { resize.current = null; }}
          onPointerCancel={() => { resize.current = null; }}
        />
      )}
    </div>
  );
}

function WorktableCanvas({
  data,
  project,
  share,
  invite,
  runCanvas,
  notify,
  board,
}: WorkspaceViewProps & { board: WorkspaceWorktable | null }) {
  const boardId = board?.id || 'default';
  const storageKey = board ? `${project}:${boardId}` : project;
  const canEdit = data.viewer.permissions.inspiracion === 'edit';
  const [selected, setSelected] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [photoAltOpen, setPhotoAltOpen] = useState(false);
  const [photoAltDraft, setPhotoAltDraft] = useState('');
  const [photoMoreOpen, setPhotoMoreOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [positionsReady, setPositionsReady] = useState(false);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const presenceCamera = useRef<PresenceCamera>({ position: [initialCamera.x, initialCamera.y, initialCamera.zoom], target: [0, 0, 0] });
  const presence = useStudioPresence(project, `board:${boardId || 'default'}`, share, true, presenceCamera, invite);
  const [followPeerId, setFollowPeerId] = useState<string | null>(null);
  const followedPeer = presence.peers.find((peer) => peer.id === followPeerId);
  useEffect(() => {
    presenceCamera.current = { position: [camera.x, camera.y, camera.zoom], target: [0, 0, 0] };
  }, [camera]);
  useEffect(() => {
    const position = followedPeer?.camera?.position;
    if (!position) return;
    const frame = requestAnimationFrame(() => setCamera((current) => {
      const next = { x: position[0], y: position[1], zoom: Math.min(4, Math.max(0.05, position[2])) };
      return Math.abs(current.x - next.x) < 0.01 && Math.abs(current.y - next.y) < 0.01 && Math.abs(current.zoom - next.zoom) < 0.001 ? current : next;
    }));
    return () => cancelAnimationFrame(frame);
  }, [followedPeer?.camera]);
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<BoardContextMenu | null>(null);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [stickyColor, setStickyColor] = useState<string>(stickyColors[0]);
  const [stickyStore, setStickyStore] = useState<{
    project: string;
    items: Record<string, StickyMeta>;
  }>({ project: '', items: {} });
  const stickyMetadata =
    stickyStore.project === storageKey ? stickyStore.items : {};
  const [stickyLinks, setStickyLinks] = useState<StickyLink[]>([]);
  const stickyLinksProject = useRef<string | null>(null);
  const [activeFrameResize, setActiveFrameResize] = useState<string | null>(
    null,
  );
  const [stickyPanel, setStickyPanel] = useState<
    'colors' | 'tags' | 'reactions' | 'link' | null
  >(null);
  const [tagDraft, setTagDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');
  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [penMenuOpen, setPenMenuOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const groupsProject = useRef<string | null>(null);
  const [marquee, setMarquee] = useState<BoardBounds | null>(null);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  const [editingFrameTitle, setEditingFrameTitle] = useState(false);
  const [stroke, setStroke] = useState('#566b55');
  const [strokeWeight, setStrokeWeight] = useState(3);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [canvasDocument, dispatchCanvas] = useReducer(boardReducer, emptyBoard);
  const canvasElements = canvasDocument.elements;
  const positions = canvasDocument.positions;
  const setPositions = (
    update: (previous: Record<string, Point>) => Record<string, Point>,
    record = false,
  ) => dispatchCanvas({ type: 'positions', update, record });
  const sceneIndex = useMemo(
    () => elementIndex(canvasElements),
    [canvasElements],
  );
  const selectedCanvasMarks = useMemo(
    () =>
      canvasElements.filter((element) =>
        selection.includes('element:' + element.id),
      ),
    [canvasElements, selection],
  );
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<
    string | null
  >(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasDraft, setCanvasDraft] = useState<CanvasElement | null>(null);
  const [textEditor, setTextEditor] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    isNew: boolean;
  } | null>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const textEditorFinishing = useRef(false);
  const editingTextId = textEditor?.id;
  useEffect(() => {
    if (editingTextId) textInput.current?.focus({ preventScroll: true });
  }, [editingTextId]);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentBubbleStore, setCommentBubbleStore] = useState<{ project: string; positions: Record<string, Point> }>({ project: '', positions: {} });
  const commentBubblePositions = commentBubbleStore.project === storageKey ? commentBubbleStore.positions : {};
  const commentInput = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const presencePanel = useRef<HTMLDivElement>(null);
  const frameMenu = useRef<HTMLFieldSetElement>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());
  const frameTitleInput = useRef<HTMLInputElement>(null);
  const stickyLinkInput = useRef<HTMLInputElement>(null);
  const notePointer = useRef<{ id: string; pointer: number; x: number; y: number } | null>(null);
  const newLinkInput = useRef<HTMLInputElement>(null);
  const externalFileInput = useRef<HTMLInputElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activeCanvasElement = useRef<ActiveCanvasElement | null>(null);
  const previewFrame = useRef<number | null>(null);
  const queuedPreview = useRef<CanvasPreview | null>(null);
  const moveFrame = useRef<number | null>(null);
  const queuedCanvasMove = useRef<CanvasElement | null>(null);
  const insertion = useRef<Point>({ x: 40, y: 50 });
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const wrap = canvasWrap.current;
    const presence = presencePanel.current;
    const menu = frameMenu.current;
    if (!wrap || !presence) return;
    const positionCanvasMenus = () => {
      wrap.style.setProperty(
        '--presence-menu-top',
        `${presence.offsetTop + presence.offsetHeight + 8}px`,
      );
      if (menu) {
        const presenceBounds = presence.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();
        wrap.classList.toggle(
          'frame-menu-below-presence',
          menuBounds.right + 8 > presenceBounds.left &&
            menuBounds.left < presenceBounds.right + 8,
        );
      }
    };
    const observer = new ResizeObserver(positionCanvasMenus);
    observer.observe(wrap);
    observer.observe(presence);
    if (menu) observer.observe(menu);
    window.addEventListener('resize', positionCanvasMenus);
    positionCanvasMenus();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionCanvasMenus);
      wrap.classList.remove('frame-menu-below-presence');
    };
  }, [frameMenuOpen]);
  const mounted = useRef(true);
  const deletingIds = useRef(new Set<string>());
  const operations = useRef({ runCanvas, notify });
  useEffect(() => {
    operations.current = { runCanvas, notify };
  }, [runCanvas, notify]);
  useEffect(() => {
    if (editingFrameTitle) frameTitleInput.current?.focus();
  }, [editingFrameTitle]);
  useEffect(() => {
    if (stickyPanel === 'link') stickyLinkInput.current?.focus();
  }, [stickyPanel]);
  useEffect(() => {
    if (newLinkOpen) newLinkInput.current?.focus();
  }, [newLinkOpen]);
  useEffect(() => {
    mounted.current = true;
    const previews = urls.current;
    return () => {
      mounted.current = false;
      if (previewFrame.current) cancelAnimationFrame(previewFrame.current);
      if (moveFrame.current) cancelAnimationFrame(moveFrame.current);
      previews.forEach((value) => URL.revokeObjectURL(value));
      previews.clear();
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let hasStoredCanvas = false;
      try {
        hasStoredCanvas =
          localStorage.getItem('fabrica:inspiration-elements:' + storageKey) !==
          null;
      } catch {
        /* Use the template when browser storage is unavailable. */
      }
      setPositionsReady(true);
      dispatchCanvas({
        type: 'reset',
        elements: hasStoredCanvas
          ? readCanvasElements(storageKey)
          : templateElements(board?.template || 'blank'),
        positions: readPositions(storageKey),
      });
      setCanvasReady(true);
      setStickyStore({
        project: storageKey,
        items: readStickyMetadata(storageKey),
      });
      try {
        const saved = JSON.parse(localStorage.getItem('fabrica:comment-bubbles:' + storageKey) || '{}');
        setCommentBubbleStore({
          project: storageKey,
          positions: saved && typeof saved === 'object' && !Array.isArray(saved)
            ? Object.fromEntries(Object.entries(saved).filter(([key, point]) =>
                /^(card|element):/.test(key) && validPoint(point))) as Record<string, Point>
            : {},
        });
      } catch {
        setCommentBubbleStore({ project: storageKey, positions: {} });
      }
      stickyLinksProject.current = storageKey;
      setStickyLinks(readStickyLinks(storageKey));
      groupsProject.current = storageKey;
      try {
        const saved = JSON.parse(
          localStorage.getItem('fabrica:inspiration-groups:' + storageKey) ||
            '{}',
        );
        setGroups(
          saved && typeof saved === 'object' && !Array.isArray(saved)
            ? Object.fromEntries(
                Object.entries(saved).filter(
                  (entry): entry is [string, string] =>
                    /^(card|element):/.test(entry[0]) &&
                    typeof entry[1] === 'string',
                ),
              )
            : {},
        );
      } catch {
        setGroups({});
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, board?.template]);
  useEffect(() => {
    if (canvasReady && groupsProject.current === storageKey) {
      try {
        localStorage.setItem(
          'fabrica:inspiration-groups:' + storageKey,
          JSON.stringify(groups),
        );
      } catch {
        setStorageError(true);
      }
    }
  }, [groups, storageKey, canvasReady]);
  useEffect(() => {
    if (stickyStore.project !== storageKey) return;
    try {
      localStorage.setItem(
        'fabrica:inspiration-stickies:' + storageKey,
        JSON.stringify(stickyStore.items),
      );
    } catch {
      setStorageError(true);
    }
  }, [storageKey, stickyStore]);
  useEffect(() => {
    if (commentBubbleStore.project !== storageKey) return;
    try {
      localStorage.setItem('fabrica:comment-bubbles:' + storageKey, JSON.stringify(commentBubbleStore.positions));
    } catch { setStorageError(true); }
  }, [storageKey, commentBubbleStore]);
  function moveCommentBubble(key: string, point: Point) {
    setCommentBubbleStore((current) => current.project === storageKey
      ? { ...current, positions: { ...current.positions, [key]: point } }
      : current);
  }
  useEffect(() => {
    if (!canvasReady || stickyLinksProject.current !== storageKey) return;
    try {
      localStorage.setItem(
        'fabrica:inspiration-sticky-links:' + storageKey,
        JSON.stringify(stickyLinks),
      );
    } catch {
      setStorageError(true);
    }
  }, [storageKey, stickyLinks, canvasReady]);
  const saveLocal = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!positionsReady || !canvasReady) return;
    const persist = () => {
      try {
        localStorage.setItem(
          'fabrica:inspiration:' + storageKey,
          JSON.stringify(positions),
        );
        localStorage.setItem(
          'fabrica:inspiration-elements:' + storageKey,
          JSON.stringify(canvasElements),
        );
        if (mounted.current) setStorageError(false);
      } catch {
        if (mounted.current) setStorageError(true);
      }
    };
    saveLocal.current = persist;
    if (dragging) return;
    const timer = window.setTimeout(persist, 250);
    return () => window.clearTimeout(timer);
  }, [
    positions,
    canvasElements,
    positionsReady,
    canvasReady,
    storageKey,
    dragging,
  ]);
  useEffect(() => {
    const flush = () => saveLocal.current?.();
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  const items = data.inspiration;
  useEffect(() => {
    const saved = new Set(items.map((item) => item.id));
    setPending((current) => {
      const finished = current.filter((entry) => saved.has(entry.id));
      if (!finished.length) return current;
      finished.forEach((entry) => {
        if (entry.preview) {
          URL.revokeObjectURL(entry.preview);
          urls.current.delete(entry.preview);
        }
      });
      return current.filter((entry) => !saved.has(entry.id));
    });
  }, [items]);
  const assetMap = useMemo(
    () => new Map(data.assets.map((asset) => [asset.id, asset])),
    [data.assets],
  );
  const inspirationComments = useMemo(
    () => data.inspirationComments || [],
    [data.inspirationComments],
  );
  const commentsByItem = useMemo(() => {
    const groups = new Map<string, typeof inspirationComments>();
    inspirationComments.forEach((comment) => {
      if (!comment.inspiration) return;
      const comments = groups.get(comment.inspiration) || [];
      comments.push(comment);
      groups.set(comment.inspiration, comments);
    });
    return groups;
  }, [inspirationComments]);
  const commentsByElement = useMemo(() => {
    const groups = new Map<string, typeof inspirationComments>();
    for (const comment of inspirationComments) {
      if (!comment.element || comment.worktable !== boardId) continue;
      const comments = groups.get(comment.element) || [];
      comments.push(comment);
      groups.set(comment.element, comments);
    }
    return groups;
  }, [inspirationComments, boardId]);
  const reactionsByItem = useMemo(() => {
    const groups = new Map<string, Record<string, number>>();
    for (const reaction of data.inspirationReactions || []) {
      const counts = groups.get(reaction.inspiration) || {};
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
      groups.set(reaction.inspiration, counts);
    }
    return groups;
  }, [data.inspirationReactions]);
  const myReactions = useMemo(
    () => new Map((data.inspirationReactions || []).filter((reaction) => reaction.mine).map((reaction) => [reaction.inspiration, reaction.emoji])),
    [data.inspirationReactions],
  );
  const selectedComments = commentTarget
    ? commentsByItem.get(commentTarget) || commentsByElement.get(commentTarget) || []
    : [];
  const commentItem = commentTarget
    ? data.inspiration.find((item) => item.id === commentTarget)
    : undefined;
  const commentElement = commentTarget
    ? canvasElements.find((element) => element.id === commentTarget)
    : undefined;
  const commentItemIsNote = Boolean(commentItem && !commentItem.asset && (!commentItem.url || stickyMetadata[commentItem.id]));
  const commentItemIsPhoto = Boolean(commentItem?.asset && /^image\/(jpeg|png|webp|avif)$/.test(assetMap.get(commentItem.asset)?.mime || ''));
  useEffect(() => {
    if (commentTarget && (commentItemIsNote || commentItemIsPhoto || commentElement)) commentInput.current?.focus({ preventScroll: true });
  }, [commentTarget, commentItemIsNote, commentItemIsPhoto, commentElement]);
  useEffect(() => {
    if (!commentTarget || (!commentItemIsNote && !commentItemIsPhoto && !commentElement)) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-comment-bubble], [data-comment-thread]')) return;
      setCommentTarget(null);
      setCommentText('');
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [commentTarget, commentItemIsNote, commentItemIsPhoto, commentElement]);
  // Default placement uses the full board order, so filtering never moves cards.
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        data.inspiration.map((item, index) => [
          item.id,
          { x: (index % 4) * 345, y: Math.floor(index / 4) * 520 },
        ]),
      ),
    [data.inspiration],
  );
  const positionFor = (id: string) =>
    positions[id] || defaults[id] || { x: 0, y: 0 };

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    let frame = 0;
    let lastWidth = -1;
    let lastHeight = -1;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewportSize({ width, height }));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  function markAt(point: Point) {
    const tolerance = 12 / camera.zoom;
    const candidates = sceneIndex
      .search({
        left: point.x - tolerance,
        right: point.x + tolerance,
        top: point.y - tolerance,
        bottom: point.y + tolerance,
      })
      .sort((a, b) => a.order - b.order);
    return canvasElementAt(
      candidates.map(({ element }) => element),
      point,
      tolerance,
    );
  }

  const cardIndex = useMemo(
    () =>
      new SpatialIndex(
        items.map((item, order) => {
          const point = positions[item.id] ||
            defaults[item.id] || { x: 0, y: 0 };
          return {
            value: { item, order },
            bounds: {
              left: point.x,
              top: point.y,
              right: point.x + 340,
              bottom: point.y + 800,
            },
          };
        }),
      ),
    [items, positions, defaults],
  );
  const visibleItems = useMemo(() => {
    const margin = 300 / camera.zoom;
    const candidates = cardIndex.search({
      left: -camera.x / camera.zoom - margin,
      top: -camera.y / camera.zoom - margin,
      right: (viewportSize.width - camera.x) / camera.zoom + margin,
      bottom: (viewportSize.height - camera.y) / camera.zoom + margin,
    });
    if (selected && !candidates.some(({ item }) => item.id === selected)) {
      const order = items.findIndex((item) => item.id === selected);
      if (order >= 0) candidates.push({ item: items[order], order });
    }
    return candidates.sort((a, b) => a.order - b.order);
  }, [cardIndex, camera, viewportSize, items, selected]);

  function worldPoint(clientX: number, clientY: number) {
    const bounds = viewport.current!.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - camera.x) / camera.zoom,
      y: (clientY - bounds.top - camera.y) / camera.zoom,
    };
  }

  function peerPoint(cursor: PresenceCursor): Point {
    if (Array.isArray(cursor)) return { x: cursor[0], y: cursor[1] };
    if (cursor.card && defaults[cursor.card]) {
      const card = positionFor(cursor.card);
      return { x: card.x + (cursor.dx || 0), y: card.y + (cursor.dy || 0) };
    }
    return { x: cursor.x, y: cursor.y };
  }

  function focusBoard() {
    viewport.current?.focus({ preventScroll: true });
  }

  function selectCard(id: string | null) {
    setSelected(id);
    setSelectedCanvasElement(null);
    setActiveFrameResize(null);
    setSelection(id ? ['card:' + id] : []);
  }

  function selectCanvasElement(id: string | null) {
    if (id !== activeFrameResize) setActiveFrameResize(null);
    setSelectedCanvasElement(id);
    setSelected(null);
    setSelection(id ? ['element:' + id] : []);
  }

  function selectTarget(key: string, additive = false) {
    const members = groups[key]
      ? Object.keys(groups).filter((id) => groups[id] === groups[key])
      : [key];
    setSelection((current) =>
      additive
        ? members.every((id) => current.includes(id))
          ? current.filter((id) => !members.includes(id))
          : [...new Set([...current, ...members])]
        : current.includes(key) && current.length > 1
          ? current
          : members,
    );
    setSelected(key.startsWith('card:') ? key.slice(5) : null);
    setSelectedCanvasElement(key.startsWith('element:') ? key.slice(8) : null);
  }

  function groupSelection() {
    if (selection.length < 2) return;
    const id = crypto.randomUUID();
    setGroups((current) => ({
      ...current,
      ...Object.fromEntries(selection.map((key) => [key, id])),
    }));
  }

  function ungroupSelection() {
    setGroups((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !selection.includes(key)),
      ),
    );
  }

  function chooseTool(next: CanvasTool) {
    setTool(next);
    setNewLinkOpen(false);
    setPenMenuOpen(
      ['draw', 'marker', 'smart', 'erase', 'erase-area', 'lasso'].includes(
        next,
      ),
    );
    setFrameMenuOpen(false);
    setHand(false);
    setContextMenu(null);
    setStickyPanel(null);
    focusBoard();
  }

  function createTextAt(point: Point) {
    if (!canEdit || canvasElements.length >= MAX_ELEMENTS) return;
    textEditorFinishing.current = false;
    setContextMenu(null);
    setTextEditor({
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      width: 320,
      height: 56,
      text: '',
      isNew: true,
    });
    setTool('select');
  }

  function finishTextEditor(save = true) {
    if (!textEditor || textEditorFinishing.current) return;
    textEditorFinishing.current = true;
    if (save && textEditor.text.trim()) {
      const previous = canvasElements.find(
        (element) => element.id === textEditor.id,
      );
      const element: CanvasElement = {
        id: textEditor.id,
        type: 'text',
        x: textEditor.x,
        y: textEditor.y,
        width: textEditor.width,
        height: Math.max(56, textEditor.height),
        text: textEditor.text.slice(0, 2000),
        stroke: previous?.stroke || '#252525',
        weight: 1,
        style: 'solid',
      };
      if (textEditor.isNew) dispatchCanvas({ type: 'add', element });
      else if (
        previous?.type === 'text' &&
        (previous.text !== element.text || previous.height !== element.height)
      )
        dispatchCanvas({ type: 'update', element });
      selectCanvasElement(element.id);
    }
    setTextEditor(null);
  }

  function updateStickyMeta(
    id: string,
    update: (current: StickyMeta) => StickyMeta,
  ) {
    setStickyStore((current) => {
      const items = current.project === storageKey ? current.items : {};
      return {
        project: storageKey,
        items: {
          ...items,
          [id]: update(items[id] || defaultStickyMeta()),
        },
      };
    });
  }

  function createFrame(width: number, height: number, title = '') {
    if (!canEdit || canvasElements.length >= MAX_ELEMENTS) return;
    const bounds = viewport.current;
    if (!bounds) return;
    const center = worldPoint(
      bounds.getBoundingClientRect().left + bounds.clientWidth / 2,
      bounds.getBoundingClientRect().top + bounds.clientHeight / 2,
    );
    const frame: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'frame',
      x: Math.round(center.x - width / 2),
      y: Math.round(center.y - height / 2),
      width,
      height,
      title,
      fill: '#ffffff',
      stroke: '#c9cdc5',
      weight: 1,
      style: 'solid',
    };
    dispatchCanvas({ type: 'add', element: frame });
    selectCanvasElement(frame.id);
    setFrameMenuOpen(false);
    setTool('select');
    focusBoard();
  }

  function undoCanvas() {
    if (!canEdit || !canvasDocument.past.length) return;
    clearCanvasPreview();
    setAlignmentGuides([]);
    dispatchCanvas({ type: 'undo' });
  }

  function redoCanvas() {
    if (!canEdit || !canvasDocument.future.length) return;
    clearCanvasPreview();
    setAlignmentGuides([]);
    dispatchCanvas({ type: 'redo' });
  }

  function cardBounds(id: string, point = positionFor(id)): BoardBounds {
    const card = cardNodes.current.get(id);
    // offset dimensions are layout-space values, unaffected by the world's
    // CSS scale, so they can be compared directly with board coordinates.
    const width = card ? card.offsetWidth : 300;
    const height = card ? card.offsetHeight : 360;
    return {
      left: point.x,
      top: point.y,
      right: point.x + width,
      bottom: point.y + height,
    };
  }

  function isGuideItem(item: WorkspaceInspiration) {
    if (!item.asset && !item.url) return true;
    const asset = item.asset ? assetMap.get(item.asset) : undefined;
    return Boolean(asset && /^image\/(jpeg|png|webp|avif)$/.test(asset.mime));
  }

  function alignmentTargets(excludeCard?: string, excludeElement?: string) {
    const sizes = new Map(
      Array.from(
        viewport.current?.querySelectorAll<HTMLElement>('[data-card]') || [],
      ).map((node) => [
        node.dataset.card,
        { width: node.offsetWidth, height: node.offsetHeight },
      ]),
    );
    return [
      ...data.inspiration
        .filter((item) => item.id !== excludeCard && isGuideItem(item))
        .map((item) => {
          const point = positionFor(item.id),
            size = sizes.get(item.id);
          return {
            left: point.x,
            top: point.y,
            right: point.x + (size?.width || 300),
            bottom: point.y + (size?.height || 360),
          };
        }),
      ...canvasElements
        .filter((element) => element.id !== excludeElement)
        .map(boundsForCanvasElement),
    ];
  }

  function alignedCanvasElement(
    element: CanvasElement,
    targets: BoardBounds[],
  ) {
    const alignment = findAlignment(
      boundsForCanvasElement(element),
      targets,
      8 / camera.zoom,
    );
    return {
      element: translateCanvasElement(element, alignment.offset),
      guides: alignment.guides,
    };
  }

  function queueCanvasPreview(preview: CanvasPreview) {
    queuedPreview.current = preview;
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(() => {
      const next = queuedPreview.current;
      previewFrame.current = null;
      queuedPreview.current = null;
      if (!next) return;
      setCanvasDraft(next.element);
      setAlignmentGuides(next.guides);
    });
  }

  function clearCanvasPreview() {
    if (previewFrame.current) cancelAnimationFrame(previewFrame.current);
    previewFrame.current = null;
    queuedPreview.current = null;
    setCanvasDraft(null);
  }

  function flushCanvasMove() {
    if (moveFrame.current) cancelAnimationFrame(moveFrame.current);
    moveFrame.current = null;
    const next = queuedCanvasMove.current;
    queuedCanvasMove.current = null;
    if (!next) return;
    dispatchCanvas({
      type: 'replace',
      elements: canvasElements.map((element) =>
        element.id === next.id ? next : element,
      ),
    });
  }

  function queueCanvasMove(element: CanvasElement) {
    queuedCanvasMove.current = element;
    if (moveFrame.current) return;
    moveFrame.current = requestAnimationFrame(flushCanvasMove);
  }

  function elementForGesture(active: ActiveCanvasElement, point: Point) {
    const style = {
      stroke,
      weight:
        active.type === 'marker'
          ? Math.max(12, strokeWeight * 4)
          : strokeWeight,
      style: strokeStyle,
      opacity: active.type === 'marker' ? 0.35 : 1,
    };
    if (active.type === 'frame')
      return {
        id: 'draft',
        type: 'frame' as const,
        x: Math.min(active.start.x, point.x),
        y: Math.min(active.start.y, point.y),
        width: Math.abs(point.x - active.start.x),
        height: Math.abs(point.y - active.start.y),
        title: '',
        fill: '#ffffff',
        ...style,
      };
    if (active.type === 'rectangle')
      return {
        id: 'draft',
        type: 'rectangle' as const,
        x: Math.min(active.start.x, point.x),
        y: Math.min(active.start.y, point.y),
        width: Math.abs(point.x - active.start.x),
        height: Math.abs(point.y - active.start.y),
        ...style,
      };
    if (active.type === 'circle') {
      const radius = Math.hypot(
        point.x - active.start.x,
        point.y - active.start.y,
      );
      return {
        id: 'draft',
        type: 'circle' as const,
        x: active.start.x - radius,
        y: active.start.y - radius,
        width: radius * 2,
        height: radius * 2,
        ...style,
      };
    }
    if (active.type === 'arrow')
      return {
        id: 'draft',
        type: 'arrow' as const,
        x: active.start.x,
        y: active.start.y,
        endX: point.x,
        endY: point.y,
        ...style,
      };
    if (active.type === 'line')
      return {
        id: 'draft',
        type: 'stroke' as const,
        points: [active.start, point],
        ...style,
      };
    const previous = active.points.at(-1);
    if (
      active.points.length < MAX_STROKE_POINTS &&
      (!previous ||
        Math.hypot(point.x - previous.x, point.y - previous.y) >
          1 / camera.zoom)
    )
      active.points.push(point);
    return {
      id: 'draft',
      type: 'stroke' as const,
      points: [...active.points],
      ...style,
    };
  }

  function eraseAt(point: Point) {
    if (!canEdit) return;
    const element = markAt(point);
    if (!element) return;
    dispatchCanvas({ type: 'remove', id: element.id });
    setCommentTarget((current) => current === element.id ? null : current);
    void runCanvas({ action: 'delete-canvas-element-comments', element: element.id, worktable: boardId }, (current) => ({
      ...current,
      inspirationComments: current.inspirationComments.filter((comment) => !(comment.element === element.id && comment.worktable === boardId)),
    }), `element:${element.id}`).catch(() => {});
    setSelectedCanvasElement((current) =>
      current === element.id ? null : current,
    );
    setAlignmentGuides([]);
  }

  function eraseAtPointer(event: PointerEvent<HTMLDivElement>) {
    if (!canEdit) return;
    // Cards (photos, links and stickies) live in the DOM rather than in the
    // canvas spatial index, so resolve them from the pointer before checking
    // canvas marks. This keeps the object eraser consistent across both layers.
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target?.closest<HTMLElement>('[data-card]');
    if (card?.dataset.card) {
      deleteInspiration(card.dataset.card);
      setSelection([]);
      return;
    }
    eraseAt(worldPoint(event.clientX, event.clientY));
  }

  function beginCanvasElement(event: PointerEvent<HTMLDivElement>) {
    if (canvasElements.length >= MAX_ELEMENTS) {
      notify('El lienzo alcanzó el límite de 10.000 dibujos.');
      return false;
    }
    if (
      !canEdit ||
      tool === 'select' ||
      tool === 'lasso' ||
      tool === 'erase-area' ||
      tool === 'sticky' ||
      hand ||
      space ||
      event.button !== 0
    )
      return false;
    event.preventDefault();
    event.stopPropagation();
    const point = worldPoint(event.clientX, event.clientY);
    insertion.current = point;
    selectCard(null);
    setContextMenu(null);
    if (tool === 'erase') {
      eraseAt(point);
      return true;
    }
    activeCanvasElement.current = {
      pointer: event.pointerId,
      type: tool as ActiveCanvasElement['type'],
      start: point,
      points: [point],
      targets:
        tool === 'rectangle' ||
        tool === 'circle' ||
        tool === 'line' ||
        tool === 'arrow' ||
        tool === 'frame'
          ? alignmentTargets()
          : [],
    };
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    return true;
  }

  function updateCanvasElement(event: PointerEvent<HTMLDivElement>) {
    const active = activeCanvasElement.current;
    if (!active || active.pointer !== event.pointerId) return false;
    const point = worldPoint(event.clientX, event.clientY);
    queueCanvasPreview(
      alignedCanvasElement(elementForGesture(active, point), active.targets),
    );
    return true;
  }

  function finishCanvasElement(event?: PointerEvent<HTMLDivElement>) {
    const active = activeCanvasElement.current;
    if (!active || (event && active.pointer !== event.pointerId)) return false;
    const point = event
      ? worldPoint(event.clientX, event.clientY)
      : active.start;
    const preview = alignedCanvasElement(
      elementForGesture(active, point),
      active.targets,
    );
    const element =
      preview.element.type === 'stroke'
        ? {
            ...preview.element,
            points: simplifyStroke(
              preview.element.points,
              (active.type === 'smart' ? 3 : 0.8) / camera.zoom,
            ),
          }
        : preview.element;
    const bounds = boundsForCanvasElement(element);
    const size = Math.max(
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    );
    if (
      size > 8 &&
      (!['draw', 'marker', 'smart'].includes(active.type) ||
        active.points.length > 1)
    ) {
      dispatchCanvas({
        type: 'add',
        element: { ...element, id: crypto.randomUUID() },
      });
    }
    activeCanvasElement.current = null;
    clearCanvasPreview();
    setAlignmentGuides([]);
    setDragging(false);
    return true;
  }

  function saveComment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = commentText.trim();
    if (!commentTarget || !text) return;
    const target = commentTarget;
    const id = crypto.randomUUID();
    const inspiration = commentElement ? null : target;
    const comment = {
      id,
      project,
      inspiration,
      element: commentElement ? target : null,
      worktable: commentElement ? boardId : null,
      author: data.viewer.name,
      mine: true,
      text,
      created: Date.now(),
    };
    setCommentText('');
    void runCanvas({
      action: 'add-inspiration-comment',
      id,
      ...(commentElement ? { element: target, worktable: boardId } : { inspiration: target }),
      text,
    }, (current) => ({
      ...current,
      inspirationComments: current.inspirationComments.some((entry) => entry.id === id)
        ? current.inspirationComments : [...current.inspirationComments, comment],
    }), `${commentElement ? 'element' : 'inspiration'}:${target}`).catch(() => {
      setCommentText((current) => current || text);
    });
  }

  function addReaction(inspiration: string, emoji: string) {
    if (!canEdit) return;
    const nextEmoji = myReactions.get(inspiration) === emoji ? null : emoji;
    const id = crypto.randomUUID();
    setStickyPanel(null);
    void runCanvas({ action: 'set-inspiration-reaction', inspiration, emoji: nextEmoji }, (current) => ({
      ...current,
      inspirationReactions: [
        ...current.inspirationReactions.filter((reaction) => !(reaction.inspiration === inspiration && reaction.mine)),
        ...(nextEmoji ? [{ id, project, inspiration, emoji: nextEmoji, mine: true, created: Date.now() }] : []),
      ],
    }), `inspiration:${inspiration}`).catch(() => {});
  }

  function deleteComment(id: string) {
    if (!canEdit) return;
    const comment = inspirationComments.find((entry) => entry.id === id);
    const scope = comment?.inspiration
      ? `inspiration:${comment.inspiration}`
      : comment?.element ? `element:${comment.element}` : `comment:${id}`;
    void runCanvas({ action: 'delete-inspiration-comment', id }, (current) => ({
      ...current,
      inspirationComments: current.inspirationComments.filter((entry) => entry.id !== id),
    }), scope).catch(() => {});
  }

  function draftRequest(entry: Pending, asset = '') {
    return {
      action: 'add-inspiration',
      id: entry.id,
      worktable: boardId,
      title: entry.draft.title.slice(0, 160),
      note: entry.draft.note || '',
      url: entry.draft.url || '',
      asset,
      sticky: Boolean(entry.draft.sticky),
      category: entry.draft.category || 'general',
    };
  }

  function placeDraft(entry: Pending) {
    const { draft } = entry;
    setPositions((current) => ({ ...current, [entry.id]: current[entry.id] || entry.point }));
    if (draft.sticky) {
      setStickyStore((current) => ({
        project: storageKey,
        items: {
          ...(current.project === storageKey ? current.items : {}),
          [entry.id]: draft.sticky!,
        },
      }));
    }
    if (draft.sequenceFrom && stickyLinksProject.current === storageKey) {
      setStickyLinks((current) => [...current, { from: draft.sequenceFrom!, to: entry.id }].slice(-1000));
    }
  }

  function markUploadFailed(entry: Pending, retryDraft: Draft, message: string) {
    setPending((current) => current.map((item) => item.id === entry.id
      ? { ...entry, draft: retryDraft, error: message } : item));
  }

  async function upload(entry: Pending) {
    if (!mounted.current) return;
    let retryDraft = entry.draft;
    try {
      const draft = entry.draft;
      let asset = draft.asset || '';
      if (draft.file) {
        const validationError = inspirationFileError(draft.file);
        if (validationError) throw new Error(validationError);
        const optimized = (await createImagePreview(draft.file)) || draft.file;
        asset = await uploadWorkspaceAsset(optimized, project, share, invite, 'inspiration');
        retryDraft = { ...draft, file: undefined, asset };
      }
      await operations.current.runCanvas(draftRequest(entry, asset), undefined, `inspiration:${entry.id}`);
      if (!mounted.current) return;
      placeDraft(entry);
      selectCard(entry.id);
      // The preview stays in place until the refreshed asset and card arrive.
    } catch (error) {
      const uploadError = (error as Error).message;
      if (mounted.current) markUploadFailed(entry, retryDraft, uploadError);
    }
  }

  function addDrafts(drafts: Draft[], point = insertion.current) {
    if (!canEdit || !drafts.length) return [];
    const acceptedDrafts = drafts.filter((draft) => {
      if (!draft.file) return true;
      const validationError = inspirationFileError(draft.file);
      if (!validationError) return true;
      showErrorToast(validationError, 'Archivo no aceptado');
      return false;
    });
    if (!acceptedDrafts.length) return [];
    const entries = acceptedDrafts.map((draft, index): Pending => {
      const preview =
        draft.file && /^image\/(jpeg|png|webp|avif)$/.test(draft.file.type)
          ? URL.createObjectURL(draft.file)
          : undefined;
      if (preview) urls.current.add(preview);
      return {
        id: crypto.randomUUID(),
        draft,
        point: { x: point.x + index * 35, y: point.y + index * 35 },
        preview,
      };
    });
    const uploads = entries.filter((entry) => Boolean(entry.draft.file));
    if (uploads.length) {
      setPositions((current) => ({
        ...current,
        ...Object.fromEntries(uploads.map((entry) => [entry.id, entry.point])),
      }));
      setPending((current) => [...current, ...uploads]);
    }
    for (const entry of entries) {
      if (entry.draft.file) {
        void upload(entry);
        continue;
      }
      placeDraft(entry);
      const item: WorkspaceInspiration = {
        id: entry.id,
        project,
        title: entry.draft.title.slice(0, 160),
        note: entry.draft.note || '',
        url: entry.draft.url || '',
        asset: entry.draft.asset || null,
        worktable: boardId === 'default' ? null : boardId,
        category: entry.draft.category || 'general',
        status: 'idea',
        author: data.viewer.name,
        created: Date.now(),
      };
      void runCanvas(draftRequest(entry, entry.draft.asset), (current) => ({
        ...current,
        inspiration: current.inspiration.some((saved) => saved.id === entry.id)
          ? current.inspiration : [...current.inspiration, item],
      }), `inspiration:${entry.id}`).catch(() => {
        setPositions((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
        setStickyStore((current) => {
          if (current.project !== storageKey || !current.items[entry.id]) return current;
          const items = { ...current.items };
          delete items[entry.id];
          return { ...current, items };
        });
        setStickyLinks((current) => current.filter((link) => link.to !== entry.id));
        setSelected((current) => current === entry.id ? null : current);
      });
    }
    insertion.current = { x: point.x + 35, y: point.y + 35 };
    focusBoard();
    return entries;
  }

  function addLinkFromToolbar() {
    const url = safeReferenceUrl(newLinkUrl.trim());
    if (!url) {
      notify('Usá un enlace http o https válido.');
      newLinkInput.current?.focus();
      return;
    }
    const bounds = viewport.current?.getBoundingClientRect();
    const point = bounds
      ? worldPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      : insertion.current;
    addDrafts([{ url, title: new URL(url).hostname.replace(/^www\./, '') }], point);
    setNewLinkUrl('');
    setNewLinkOpen(false);
  }

  function receive(transfer: DataTransfer, point: Point) {
    if (!canEdit) return false;
    const content = boardClipboard(transfer);
    if (content.kind === 'files') {
      addDrafts(
        content.files.map((file) => ({
          file,
          title: file.name.replace(/\.[^.]+$/, '') || 'Imagen pegada',
        })),
        point,
      );
    } else if (content.kind === 'reference') {
      const item =
        content.project === project
          ? data.inspiration.find((item) => item.id === content.id)
          : undefined;
      if (!item) {
        notify('Esa referencia ya no está disponible en este proyecto.');
        return true;
      }
      addDrafts(
        [
          {
            title: item.title,
            note: item.note,
            url: item.url,
            asset: item.asset || '',
            category: item.category,
          },
        ],
        point,
      );
    } else if (content.kind === 'link') {
      addDrafts(
        [
          {
            url: content.url,
            title: new URL(content.url).hostname.replace(/^www\./, ''),
          },
        ],
        point,
      );
    } else if (content.kind === 'text') {
      addDrafts(
        [
          {
            title: content.text.split('\n')[0].slice(0, 80),
            note: content.text,
          },
        ],
        point,
      );
    } else return false;
    return true;
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    if (editableTarget(event.target)) return;
    if (receive(event.clipboardData, insertion.current)) event.preventDefault();
  }

  function copy(event: ClipboardEvent<HTMLDivElement>) {
    if (editableTarget(event.target) || window.getSelection()?.toString())
      return;
    const item = data.inspiration.find((item) => item.id === selected);
    if (!item) return;
    event.clipboardData.setData(
      clipboardReferenceType,
      JSON.stringify({ id: item.id, project }),
    );
    event.clipboardData.setData(
      'text/plain',
      item.url || item.note || item.title,
    );
    event.preventDefault();
  }

  async function copyFromMenu(id: string) {
    const item = data.inspiration.find((entry) => entry.id === id);
    if (!item) return;
    const text = item.url || item.note || item.title;
    try {
      await navigator.clipboard.writeText(text);
      notify('Referencia copiada.');
    } catch {
      notify('No pudimos copiar la referencia.');
    } finally {
      setContextMenu(null);
      focusBoard();
    }
  }

  async function pasteFromMenu(point: Point) {
    setContextMenu(null);
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard) throw new Error('Clipboard no disponible');
      const clipboardItems = await clipboard.read();
      const files: File[] = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) =>
          /^image\/(jpeg|png|webp|avif)$/.test(type),
        );
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        files.push(
          new File([blob], 'Imagen pegada.' + imageType.slice(6), {
            type: imageType,
          }),
        );
      }
      if (files.length) {
        addDrafts(
          files.map((file) => ({
            file,
            title: file.name.replace(/\.[^.]+$/, '') || 'Imagen pegada',
          })),
          point,
        );
        return;
      }
      const text = (await clipboard.readText()).trim();
      if (!text) {
        notify('No hay contenido para pegar.');
        return;
      }
      try {
        const url = new URL(text);
        if (['http:', 'https:'].includes(url.protocol)) {
          addDrafts(
            [{ url: url.href, title: url.hostname.replace(/^www\./, '') }],
            point,
          );
          return;
        }
      } catch {
        // Plain text becomes a post-it below.
      }
      addDrafts(
        [
          {
            title: text.split('\n')[0].slice(0, 80) || 'Nota',
            note: text.slice(0, 2000),
          },
        ],
        point,
      );
    } catch {
      notify('No pudimos leer el portapapeles. Usá Ctrl / ⌘ V.');
    } finally {
      focusBoard();
    }
  }

  function createPostItAt(point: Point) {
    setContextMenu(null);
    const [entry] = addDrafts(
      [
        {
          title: 'Post-it',
          note: '',
          sticky: defaultStickyMeta(stickyColor),
        },
      ],
      point,
    );
    setTool('select');
    setStickyPanel(null);
    if (entry) {
      selectCard(entry.id);
      requestAnimationFrame(() => {
        cardNodes.current.get(entry.id)?.querySelector<HTMLElement>('.inspiration-note-text')?.focus({ preventScroll: true });
      });
    }
  }
  function createNextPostIt(id: string) {
    const source = cardBounds(id);
    const sourceMeta = stickyMetadata[id] || defaultStickyMeta(stickyColor);
    const [entry] = addDrafts(
      [
        {
          title: 'Post-it',
          note: '',
          sequenceFrom: id,
          sticky: defaultStickyMeta(sourceMeta.color),
        },
      ],
      { x: source.right + 150, y: source.top },
    );
    setStickyPanel(null);
    if (entry) {
      selectCard(entry.id);
      requestAnimationFrame(() => {
        cardNodes.current.get(entry.id)?.querySelector<HTMLElement>('.inspiration-note-text')?.focus({ preventScroll: true });
      });
    }
  }
  function saveStickyText(item: WorkspaceInspiration, text: string) {
    const original = item.note || (item.title !== 'Post-it' ? item.title : '');
    if (text === original) return;
    void runCanvas({
      action: 'edit-inspiration',
      id: item.id,
      title: item.title,
      note: text,
      url: item.url || '',
      sticky: true,
      category: item.category || 'general',
    }, (current) => ({
      ...current,
      inspiration: current.inspiration.map((entry) => entry.id === item.id ? { ...entry, note: text } : entry),
    }), `inspiration:${item.id}`).catch(() => {});
  }

  function savePhotoAlt(item: WorkspaceInspiration, text: string) {
    const note = text.trim();
    setPhotoAltOpen(false);
    if (note === (item.note || '')) return;
    void runCanvas({
      action: 'edit-inspiration',
      id: item.id,
      title: item.title,
      note,
      url: item.url || '',
      category: item.category || 'general',
    }, (current) => ({
      ...current,
      inspiration: current.inspiration.map((entry) =>
        entry.id === item.id ? { ...entry, note } : entry),
    }), `inspiration:${item.id}`).catch(() => {});
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    receive(event.dataTransfer, worldPoint(event.clientX, event.clientY));
  }

  function zoomAt(value: number, point?: Point) {
    setFollowPeerId(null);
    const bounds = viewport.current?.getBoundingClientRect();
    const anchor = point || {
      x: (bounds?.width || 900) / 2,
      y: (bounds?.height || 600) / 2,
    };
    setCamera((current) => {
      const zoom = Math.min(4, Math.max(0.05, value));
      return {
        zoom,
        x: anchor.x - ((anchor.x - current.x) * zoom) / current.zoom,
        y: anchor.y - ((anchor.y - current.y) * zoom) / current.zoom,
      };
    });
  }
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      // The note text has no internal scrolling; keep the board wheel gesture
      // available over it. Inputs and the active canvas text editor still own
      // their wheel events.
      if (
        editableTarget(event.target) &&
        !(event.target as HTMLElement).closest('.post-it .inspiration-note-text')
      )
        return;
      event.preventDefault();
      setFollowPeerId(null);
      const bounds = node.getBoundingClientRect();
      const factor =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? node.clientHeight
            : 1;
      setCamera((current) => {
        const mouseWheel =
          event.deltaMode !== 0 ||
          (Math.abs(event.deltaY) >= 40 && Math.abs(event.deltaX) < 1);
        if (event.ctrlKey || event.metaKey || mouseWheel) {
          const zoom = Math.min(
            4,
            Math.max(
              0.05,
              current.zoom *
                Math.exp(
                  -event.deltaY *
                    factor *
                    (event.ctrlKey || event.metaKey ? 0.008 : 0.0018),
                ),
            ),
          );
          const x = event.clientX - bounds.left,
            y = event.clientY - bounds.top;
          return {
            zoom,
            x: x - ((x - current.x) * zoom) / current.zoom,
            y: y - ((y - current.y) * zoom) / current.zoom,
          };
        }
        return {
          ...current,
          x:
            current.x - (event.shiftKey ? event.deltaY : event.deltaX) * factor,
          y:
            current.y - (event.shiftKey ? event.deltaX : event.deltaY) * factor,
        };
      });
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);

  function startGesture(event: PointerEvent<HTMLElement>, card?: string) {
    if (event.button !== 0 && event.button !== 1 && event.buttons !== 1) return;
    setFollowPeerId(null);
    if (
      card &&
      event.button === 0 &&
      stickyMetadata[card]?.locked &&
      !hand &&
      !space
    ) {
      selectCard(card);
      return;
    }
    if (card && !canEdit && !hand && !space) {
      selectCard(card);
      focusBoard();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusBoard();
    const panning = !card || hand || space || event.button === 1;
    const movingItem = card
      ? data.inspiration.find((item) => item.id === card)
      : undefined;
    insertion.current = worldPoint(event.clientX, event.clientY);
    if (
      panning &&
      !hand &&
      !space &&
      event.button === 0 &&
      (tool === 'select' || tool === 'lasso' || tool === 'erase-area')
    ) {
      const origin = worldPoint(event.clientX, event.clientY);
      gesture.current = {
        kind: 'marquee',
        pointer: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        camera,
        origin,
        additive: event.shiftKey || event.metaKey || event.ctrlKey,
        points: [origin],
      };
      if (tool === 'lasso') setLassoPoints([origin]);
      else
        setMarquee({
          left: origin.x,
          right: origin.x,
          top: origin.y,
          bottom: origin.y,
        });
    } else if (panning) {
      if (!hand && !space) selectCard(null);
      gesture.current = {
        kind: 'pan',
        pointer: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        camera,
      };
    } else {
      selectTarget(
        'card:' + card!,
        event.shiftKey || event.metaKey || event.ctrlKey,
      );
      const cardKey = 'card:' + card!;
      const keys = selection.includes(cardKey)
        ? selection
        : groups[cardKey]
          ? Object.keys(groups).filter((key) => groups[key] === groups[cardKey])
          : [cardKey];
      if (
        canEdit &&
        keys.length > 1 &&
        !(event.shiftKey || event.metaKey || event.ctrlKey)
      ) {
        gesture.current = {
          kind: 'multi',
          pointer: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          camera,
          before: { elements: canvasElements, positions },
          cards: keys
            .filter((key) => key.startsWith('card:'))
            .map((key) => ({
              id: key.slice(5),
              point: positionFor(key.slice(5)),
            })),
          elements: canvasElements.filter((element) =>
            keys.includes('element:' + element.id),
          ),
        };
      } else {
        gesture.current = {
          kind: 'card',
          before: { elements: canvasElements, positions },
          pointer: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          camera,
          card: card!,
          point: positionFor(card!),
          targets:
            movingItem && isGuideItem(movingItem) ? alignmentTargets(card) : [],
        };
      }
    }
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function startCanvasGesture(
    event: PointerEvent<HTMLDivElement>,
    element: CanvasElement,
  ) {
    if (
      event.button !== 0 ||
      hand ||
      space ||
      !['select', 'lasso'].includes(tool)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    focusBoard();
    insertion.current = worldPoint(event.clientX, event.clientY);
    selectTarget(
      'element:' + element.id,
      event.shiftKey || event.metaKey || event.ctrlKey,
    );
    if (!canEdit) return;
    const elementKey = 'element:' + element.id;
    const keys = selection.includes(elementKey)
      ? selection
      : groups[elementKey]
        ? Object.keys(groups).filter(
            (key) => groups[key] === groups[elementKey],
          )
        : [elementKey];
    if (
      keys.length > 1 &&
      !(event.shiftKey || event.metaKey || event.ctrlKey)
    ) {
      gesture.current = {
        kind: 'multi',
        pointer: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        camera,
        before: { elements: canvasElements, positions },
        cards: keys
          .filter((key) => key.startsWith('card:'))
          .map((key) => ({
            id: key.slice(5),
            point: positionFor(key.slice(5)),
          })),
        elements: canvasElements.filter((candidate) =>
          keys.includes('element:' + candidate.id),
        ),
      };
      viewport.current?.setPointerCapture(event.pointerId);
      setDragging(true);
      return;
    }
    gesture.current = {
      kind: 'canvas',
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      camera,
      element,
      before: { elements: canvasElements, positions },
      targets: alignmentTargets(undefined, element.id),
    };
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function startStickyResize(
    event: PointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (!canEdit || event.button !== 0 || stickyMetadata[id]?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const node = cardNodes.current.get(id);
    const meta = stickyMetadata[id] || defaultStickyMeta();
    gesture.current = {
      kind: 'resize',
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      card: id,
      size: {
        width: node?.offsetWidth || meta.width,
        height: node?.offsetHeight || meta.height,
      },
    };
    selectCard(id);
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function startFrameResize(
    event: PointerEvent<HTMLButtonElement>,
    element: Extract<CanvasElement, { type: 'frame' }>,
    corner: FrameResizeGesture['corner'],
  ) {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectCanvasElement(element.id);
    gesture.current = {
      kind: 'frame-resize',
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      element,
      corner,
      before: { elements: canvasElements, positions },
    };
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const x = event.clientX - active.start.x,
      y = event.clientY - active.start.y;
    if (active.kind === 'frame-resize') {
      const dx = x / camera.zoom,
        dy = y / camera.zoom;
      const left = active.corner.includes('w')
        ? active.element.x + dx
        : active.element.x;
      const top = active.corner.includes('n')
        ? active.element.y + dy
        : active.element.y;
      const right = active.corner.includes('e')
        ? active.element.x + active.element.width + dx
        : active.element.x + active.element.width;
      const bottom = active.corner.includes('s')
        ? active.element.y + active.element.height + dy
        : active.element.y + active.element.height;
      const width = Math.max(80, right - left),
        height = Math.max(80, bottom - top);
      queueCanvasMove({
        ...active.element,
        x: active.corner.includes('w') ? right - width : left,
        y: active.corner.includes('n') ? bottom - height : top,
        width,
        height,
      });
    } else if (active.kind === 'resize') {
      updateStickyMeta(active.card, (current) => ({
        ...current,
        width: Math.min(
          800,
          Math.max(180, active.size.width + x / camera.zoom),
        ),
        height: Math.min(
          800,
          Math.max(180, active.size.height + y / camera.zoom),
        ),
      }));
    } else if (active.kind === 'marquee') {
      const point = worldPoint(event.clientX, event.clientY);
      if (tool === 'lasso') {
        const last = active.points.at(-1)!;
        if (Math.hypot(point.x - last.x, point.y - last.y) > 3 / camera.zoom) {
          active.points.push(point);
          setLassoPoints([...active.points]);
        }
      } else
        setMarquee({
          left: Math.min(active.origin.x, point.x),
          top: Math.min(active.origin.y, point.y),
          right: Math.max(active.origin.x, point.x),
          bottom: Math.max(active.origin.y, point.y),
        });
    } else if (active.kind === 'multi') {
      const offset = { x: x / active.camera.zoom, y: y / active.camera.zoom };
      setPositions((current) => ({
        ...current,
        ...Object.fromEntries(
          active.cards.map(({ id, point }) => [
            id,
            { x: point.x + offset.x, y: point.y + offset.y },
          ]),
        ),
      }));
      const moved = new Map(
        active.elements.map((element) => [
          element.id,
          translateCanvasElement(element, offset),
        ]),
      );
      dispatchCanvas({
        type: 'replace',
        elements: active.before.elements.map(
          (element) => moved.get(element.id) || element,
        ),
      });
    } else if (active.kind === 'card') {
      const rawPoint = {
        x: active.point.x + x / active.camera.zoom,
        y: active.point.y + y / active.camera.zoom,
      };
      const alignment = findAlignment(
        cardBounds(active.card, rawPoint),
        active.targets,
        8 / active.camera.zoom,
      );
      setAlignmentGuides(alignment.guides);
      const point = {
        x: rawPoint.x + alignment.offset.x,
        y: rawPoint.y + alignment.offset.y,
      };
      setPositions((current) => ({ ...current, [active.card]: point }));
    } else if (active.kind === 'canvas') {
      const rawElement = translateCanvasElement(active.element, {
        x: x / active.camera.zoom,
        y: y / active.camera.zoom,
      });
      const alignment = alignedCanvasElement(rawElement, active.targets);
      queueCanvasMove(alignment.element);
      setAlignmentGuides(alignment.guides);
    } else if (active.kind === 'pan')
      setCamera({
        ...active.camera,
        x: active.camera.x + x,
        y: active.camera.y + y,
      });
  }
  function endGesture() {
    const active = gesture.current;
    if (active?.kind === 'marquee') {
      if (
        (marquee &&
          (marquee.right - marquee.left > 3 ||
            marquee.bottom - marquee.top > 3)) ||
        active.points.length > 2
      ) {
        const hit = (b: BoardBounds) =>
          tool === 'lasso'
            ? [
                { x: b.left, y: b.top },
                { x: b.right, y: b.top },
                { x: b.left, y: b.bottom },
                { x: b.right, y: b.bottom },
                { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 },
              ].some((point) => pointInPolygon(point, active.points)) ||
              active.points.some(
                (point) =>
                  point.x >= b.left &&
                  point.x <= b.right &&
                  point.y >= b.top &&
                  point.y <= b.bottom,
              )
            : !!marquee &&
              b.left <= marquee.right &&
              b.right >= marquee.left &&
              b.top <= marquee.bottom &&
              b.bottom >= marquee.top;
        if (tool === 'erase-area') {
          const ids = new Set(
            canvasElements
              .filter((element) => hit(boundsForCanvasElement(element)))
              .map((element) => element.id),
          );
          if (ids.size) {
            dispatchCanvas({
              type: 'replace',
              elements: canvasElements.filter(
                (element) => !ids.has(element.id),
              ),
            });
            dispatchCanvas({
              type: 'commit',
              before: { elements: canvasElements, positions },
            });
          }
          setMarquee(null);
          gesture.current = null;
          setDragging(false);
          return;
        }
        const keys = [
          ...items
            .filter((item) => hit(cardBounds(item.id)))
            .map((item) => 'card:' + item.id),
          ...canvasElements
            .filter((element) => hit(boundsForCanvasElement(element)))
            .map((element) => 'element:' + element.id),
        ];
        setSelection((current) =>
          active.additive ? [...new Set([...current, ...keys])] : keys,
        );
        setSelected(null);
        setSelectedCanvasElement(null);
      } else if (!active.additive) selectCard(null);
      setMarquee(null);
      setLassoPoints([]);
    }
    if (
      active?.kind === 'canvas' ||
      active?.kind === 'card' ||
      active?.kind === 'multi' ||
      active?.kind === 'frame-resize'
    ) {
      if (active.kind === 'canvas' || active.kind === 'frame-resize')
        flushCanvasMove();
      dispatchCanvas({ type: 'commit', before: active.before });
    }
    gesture.current = null;
    setDragging(false);
    setAlignmentGuides([]);
  }

  function fitBoard() {
    const boxes = [
      ...items.map((item) => cardBounds(item.id)),
      ...canvasElements.map(boundsForCanvasElement),
    ];
    if (!boxes.length) {
      setCamera(initialCamera);
      return;
    }
    const { left: minX, top: minY, right, bottom } = unionBounds(boxes);
    const width = Math.max(1, right - minX),
      height = Math.max(1, bottom - minY);
    const bounds = viewport.current!;
    const zoom = Math.min(
      1,
      Math.max(
        0.05,
        Math.min(
          (bounds.clientWidth - 100) / width,
          (bounds.clientHeight - 100) / height,
        ),
      ),
    );
    setCamera({
      zoom,
      x: (bounds.clientWidth - width * zoom) / 2 - minX * zoom,
      y: (bounds.clientHeight - height * zoom) / 2 - minY * zoom,
    });
    focusBoard();
  }

  function deleteInspiration(id: string) {
    if (!canEdit || deletingIds.current.has(id) || !items.some((item) => item.id === id)) return;
    deletingIds.current.add(id);
    const previousMeta = stickyMetadata[id];
    const previousLinks = stickyLinks.filter((link) => link.from === id || link.to === id);
    setSelected((current) => current === id ? null : current);
    setSelection((current) => current.filter((key) => key !== `card:${id}`));
    setCommentTarget((current) => current === id ? null : current);
    setStickyLinks((current) => current.filter((link) => link.from !== id && link.to !== id));
    setStickyStore((current) => {
      if (current.project !== storageKey || !current.items[id]) return current;
      const next = { ...current.items };
      delete next[id];
      return { ...current, items: next };
    });
    void runCanvas({ action: 'delete-inspiration', id }, (current) => ({
      ...current,
      inspiration: current.inspiration.filter((item) => item.id !== id),
      inspirationComments: current.inspirationComments.filter((comment) => comment.inspiration !== id),
      inspirationReactions: current.inspirationReactions.filter((reaction) => reaction.inspiration !== id),
    }), `inspiration:${id}`).catch(() => {
      if (previousMeta) setStickyStore((current) => current.project === storageKey
        ? { ...current, items: { ...current.items, [id]: previousMeta } } : current);
      if (previousLinks.length) setStickyLinks((current) => [...current, ...previousLinks]);
    }).finally(() => deletingIds.current.delete(id));
  }

  function deleteSelected() {
    if (!canEdit) return;
    if (selection.length > 1) {
      const cards = selection
        .filter((key) => key.startsWith('card:'))
        .map((key) => key.slice(5));
      const marks = new Set(
        selection
          .filter((key) => key.startsWith('element:'))
          .map((key) => key.slice(8)),
      );
      if (marks.size) {
        setCommentTarget((current) => current && marks.has(current) ? null : current);
        dispatchCanvas({
          type: 'replace',
          elements: canvasElements.filter((element) => !marks.has(element.id)),
        });
        dispatchCanvas({
          type: 'commit',
          before: { elements: canvasElements, positions },
        });
        void runCanvas({ action: 'delete-canvas-element-comments', elements: [...marks], worktable: boardId }, (current) => ({
          ...current,
          inspirationComments: current.inspirationComments.filter((comment) => !(comment.element && marks.has(comment.element) && comment.worktable === boardId)),
        })).catch(() => {});
      }
      cards.forEach(deleteInspiration);
      setSelection([]);
      setSelected(null);
      setSelectedCanvasElement(null);
      return;
    }
    if (selected) {
      deleteInspiration(selected);
      return;
    }
    if (selectedCanvasElement) {
      dispatchCanvas({ type: 'remove', id: selectedCanvasElement });
      setCommentTarget((current) => current === selectedCanvasElement ? null : current);
      void runCanvas({ action: 'delete-canvas-element-comments', element: selectedCanvasElement, worktable: boardId }, (current) => ({
        ...current,
        inspirationComments: current.inspirationComments.filter((comment) => !(comment.element === selectedCanvasElement && comment.worktable === boardId)),
      }), `element:${selectedCanvasElement}`).catch(() => {});
      setSelectedCanvasElement(null);
    }
  }

  const selectedItem = data.inspiration.find((item) => item.id === selected);
  const selectedPhoto = selectedItem?.asset &&
    /^image\/(jpeg|png|webp|avif)$/.test(assetMap.get(selectedItem.asset)?.mime || '')
      ? selectedItem : null;
  const selectedSticky =
    selectedItem &&
    !selectedItem.asset &&
    (!selectedItem.url || stickyMetadata[selectedItem.id])
      ? stickyMetadata[selectedItem.id] || defaultStickyMeta()
      : null;
  const selectedFrame = canvasElements.find(
    (element): element is Extract<CanvasElement, { type: 'frame' }> =>
      element.id === selectedCanvasElement && element.type === 'frame',
  );
  const availableStickyIds = useMemo(
    () => new Set(data.inspiration.map((item) => item.id)),
    [data.inspiration],
  );

  function renderCommentThread(title: string, comments: typeof inspirationComments, bubble: Point, photo = false) {
    return (
      <section
        className="inspiration-sticky-thread"
        data-comment-thread
        aria-label={`Comentarios de ${title}`}
        style={photo
          ? { left: 'calc(100% + 18px)', top: 0, bottom: 'auto' }
          : { left: bubble.x + 78, top: bubble.y - 30, bottom: 'auto' }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="inspiration-sticky-thread-list">
          {comments.map((comment) => (
            <article className="inspiration-sticky-thread-comment" key={comment.id}>
              <span className="inspiration-sticky-thread-avatar" aria-hidden="true">{comment.author.trim().charAt(0).toUpperCase() || '?'}</span>
              <div className="inspiration-sticky-thread-content">
                <div className="inspiration-sticky-thread-heading">
                  <strong>{comment.author}</strong>
                  <time dateTime={new Date(comment.created).toISOString()}>{commentTimestamp(comment.created)}</time>
                  {canEdit && (comment.mine || data.viewer.accountOwner) && (
                    <details className="inspiration-sticky-thread-menu">
                      <summary aria-label={`Opciones del comentario de ${comment.author}`}><MoreHorizontal size={20} /></summary>
                      <button type="button" onClick={() => deleteComment(comment.id)}><Trash2 size={15} /> Eliminar</button>
                    </details>
                  )}
                </div>
                <p>{comment.text}</p>
              </div>
            </article>
          ))}
        </div>
        {canEdit && (
          <form className="inspiration-sticky-thread-reply" onSubmit={saveComment}>
            <input
              ref={commentInput}
              aria-label="Responder al comentario"
              placeholder="Dejá una respuesta…"
              maxLength={2000}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setCommentTarget(null);
                  setCommentText('');
                }
              }}
            />
            <button type="submit" disabled={!commentText.trim()} aria-label="Enviar respuesta"><ArrowRight size={20} /></button>
          </form>
        )}
        <button type="button" className="inspiration-sticky-thread-close" aria-label="Cerrar comentarios" onClick={() => setCommentTarget(null)}><X size={16} /></button>
      </section>
    );
  }

  return (
    <div className="workspace-content inspiration-page">
      <section className="workspace-section inspiration-board-section">
        <div className="inspiration-canvas-wrap" ref={canvasWrap}>
          <div className="inspiration-presence" ref={presencePanel} aria-label="Personas en esta mesa">
            <div className="inspiration-presence-heading">
              <UsersRound size={15} aria-hidden="true" />
              <span>{!presence.visible ? 'Presencia oculta' : presence.connected ? `${presence.peers.length + 1} en esta mesa` : 'Conectando presencia…'}</span>
              <button type="button" aria-pressed={!presence.visible} onClick={() => { presence.setVisible((value) => !value); setFollowPeerId(null); }}>
                {presence.visible ? 'Ocultarme' : 'Mostrarme'}
              </button>
            </div>
            {presence.visible && presence.peers.map((peer) => (
              <div className="inspiration-presence-person" key={peer.id}>
                <span className="inspiration-presence-dot" />
                <span title={peer.role}>{peer.name}{peer.role === 'Cliente' ? ' · Cliente' : ''}</span>
                {peer.camera && <button type="button" aria-pressed={followPeerId === peer.id} onClick={() => setFollowPeerId((current) => current === peer.id ? null : peer.id)}>
                  {followPeerId === peer.id ? 'Dejar de seguir' : 'Seguir vista'}
                </button>}
              </div>
            ))}
          </div>
          <div
            className="inspiration-tools"
            role="toolbar"
            aria-label="Herramientas del lienzo"
          >
            <button
              title="Seleccionar"
              aria-label="Seleccionar"
              aria-pressed={tool === 'select' && !hand}
              onClick={() => {
                setNewLinkOpen(false);
                setHand(false);
                setTool('select');
                setPenMenuOpen(false);
                focusBoard();
              }}
            >
              <MousePointer2 size={19} />
            </button>
            <button
              title="Mover lienzo (espacio)"
              aria-label="Mover lienzo"
              aria-pressed={hand}
              onClick={() => {
                setNewLinkOpen(false);
                setHand(true);
                setTool('select');
                focusBoard();
              }}
            >
              <Hand size={19} />
            </button>
            {canEdit && (
              <>
                <span />
                <button
                  title="Deshacer (Ctrl / ⌘ Z)"
                  aria-label="Deshacer"
                  disabled={!canvasDocument.past.length}
                  onClick={undoCanvas}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  title="Rehacer (Ctrl / ⌘ Shift Z)"
                  aria-label="Rehacer"
                  disabled={!canvasDocument.future.length}
                  onClick={redoCanvas}
                >
                  <Redo2 size={18} />
                </button>
                <span />
                <button
                  title="Crear frame"
                  aria-label="Crear frame"
                  aria-expanded={frameMenuOpen}
                  aria-pressed={tool === 'frame'}
                  onClick={() => setFrameMenuOpen((open) => !open)}
                >
                  <Frame size={19} />
                </button>
                <button
                  title="Crear rectángulo"
                  aria-label="Crear rectángulo"
                  aria-pressed={tool === 'rectangle'}
                  onClick={() => chooseTool('rectangle')}
                >
                  <Square size={18} />
                </button>
                <button
                  title="Crear círculo"
                  aria-label="Crear círculo"
                  aria-pressed={tool === 'circle'}
                  onClick={() => chooseTool('circle')}
                >
                  <Circle size={18} />
                </button>
                <button
                  title="Dibujar línea"
                  aria-label="Dibujar línea"
                  aria-pressed={tool === 'line'}
                  onClick={() => chooseTool('line')}
                >
                  <Minus size={19} />
                </button>
                <button
                  title="Agregar flecha"
                  aria-label="Agregar flecha"
                  aria-pressed={tool === 'arrow'}
                  onClick={() => chooseTool('arrow')}
                >
                  <ArrowRight size={19} />
                </button>
                <button
                  title="Lápiz y dibujo"
                  aria-label="Lápiz y dibujo"
                  aria-expanded={penMenuOpen}
                  aria-pressed={[
                    'draw',
                    'marker',
                    'smart',
                    'erase',
                    'erase-area',
                    'lasso',
                  ].includes(tool)}
                  onClick={() => {
                    if (!penMenuOpen && tool === 'select') setTool('draw');
                    setPenMenuOpen((open) => !open);
                    setHand(false);
                    focusBoard();
                  }}
                >
                  <PencilLine size={19} />
                </button>
                <span />
                <button
                  title="Crear post-it"
                  aria-label="Crear post-it"
                  aria-expanded={tool === 'sticky'}
                  aria-pressed={tool === 'sticky'}
                  onClick={() => {
                    if (tool === 'sticky') chooseTool('select');
                    else {
                      chooseTool('sticky');
                      setStickyPanel('colors');
                    }
                  }}
                >
                  <StickyNote size={19} />
                </button>
                <button
                  title="Agregar texto libre (T)"
                  aria-label="Agregar texto libre"
                  aria-pressed={tool === 'text'}
                  onClick={() =>
                    chooseTool(tool === 'text' ? 'select' : 'text')
                  }
                >
                  <Type size={19} />
                </button>
                <button
                  title="Agregar enlace"
                  aria-label="Agregar enlace"
                  aria-expanded={newLinkOpen}
                  onClick={() => {
                    setNewLinkOpen((open) => !open);
                    setPenMenuOpen(false);
                    setFrameMenuOpen(false);
                    setStickyPanel(null);
                    setTool('select');
                    setHand(false);
                  }}
                >
                  <Link2 size={19} />
                </button>
                <button
                  type="button"
                  title="Agregar archivo externo"
                  aria-label="Agregar archivo externo"
                  onClick={() => externalFileInput.current?.click()}
                >
                  <FileUp size={19} />
                </button>
              </>
            )}
          </div>
          {canEdit && (
            <input
              ref={externalFileInput}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label="Seleccionar archivos externos"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files || []);
                event.currentTarget.value = '';
                const bounds = viewport.current?.getBoundingClientRect();
                const point = bounds
                  ? worldPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
                  : insertion.current;
                addDrafts(files.map((file) => ({
                  file,
                  title: file.name.replace(/\.[^.]+$/, '') || file.name,
                })), point);
              }}
            />
          )}
          {canEdit && newLinkOpen && (
            <form
              className="inspiration-new-link"
              aria-label="Nuevo enlace"
              onSubmit={(event) => {
                event.preventDefault();
                addLinkFromToolbar();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setNewLinkOpen(false);
                  focusBoard();
                }
              }}
            >
              <label htmlFor="inspiration-new-link-url">Enlace</label>
              <input
                ref={newLinkInput}
                id="inspiration-new-link-url"
                type="url"
                inputMode="url"
                placeholder="https://ejemplo.com"
                value={newLinkUrl}
                onChange={(event) => setNewLinkUrl(event.target.value)}
              />
              <button type="submit">Agregar</button>
            </form>
          )}
          {canEdit && tool === 'sticky' && (
            <div
              className="inspiration-sticky-palette"
              role="toolbar"
              aria-label="Color del post-it"
            >
              <span>Elegí un color</span>
              <div>
                {stickyColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Post-it ${color}`}
                    aria-pressed={stickyColor === color}
                    onClick={() => setStickyColor(color)}
                    style={{ '--sticky-color': color } as CSSProperties}
                  />
                ))}
              </div>
              <small>Después hacé click en el lienzo</small>
            </div>
          )}
          {canEdit && penMenuOpen && (
            <div
              className="inspiration-pen-menu"
              role="toolbar"
              aria-label="Herramientas del lápiz"
            >
              {(
                [
                  ['draw', 'Lápiz', PencilLine],
                  ['marker', 'Resaltador', Highlighter],
                  ['smart', 'Lápiz suavizado', Sparkles],
                  ['erase', 'Borrador de objetos', Eraser],
                  ['erase-area', 'Borrar área', Scan],
                  ['lasso', 'Selección libre', Lasso],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={tool === id}
                  onClick={() => chooseTool(id)}
                >
                  <Icon size={23} />
                </button>
              ))}
              <span className="inspiration-pen-divider" />
              {[2, 4, 7].map((weight) => (
                <button
                  key={weight}
                  type="button"
                  title={`Grosor ${weight}`}
                  aria-label={`Grosor ${weight}`}
                  aria-pressed={strokeWeight === weight}
                  onClick={() => setStrokeWeight(weight)}
                >
                  <i
                    className="inspiration-pen-size"
                    style={{ width: weight, height: weight }}
                  />
                </button>
              ))}
              {['#1f2933', '#ff6570', '#29ba62'].map((color) => (
                <button
                  key={color}
                  type="button"
                  title={`Color ${color}`}
                  aria-label={`Color ${color}`}
                  aria-pressed={stroke === color}
                  onClick={() => setStroke(color)}
                >
                  <i
                    className="inspiration-pen-swatch"
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
          )}
          {canEdit && frameMenuOpen && (
            <fieldset
              className="inspiration-frame-menu"
              ref={frameMenu}
              aria-label="Tamaño del frame"
            >
              <button
                className="inspiration-frame-custom"
                onClick={() => chooseTool('frame')}
              >
                <Frame size={22} />{' '}
                <span>
                  Personalizado <small>Arrastrá en el lienzo</small>
                </span>
              </button>
              <div className="inspiration-frame-presets">
                {framePresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => createFrame(preset.width, preset.height)}
                  >
                    <span
                      className="inspiration-frame-preset-icon"
                      style={{
                        aspectRatio: `${preset.width} / ${preset.height}`,
                      }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {canEdit &&
            ['rectangle', 'circle', 'line', 'arrow'].includes(tool) && (
              <div
                className="inspiration-stroke-controls"
                aria-label="Estilo de trazo"
              >
                <span>Trazo</span>
                {['#566b55', '#aa674b', '#40453d'].map((color) => (
                  <button
                    key={color}
                    className="inspiration-stroke-color"
                    aria-label={'Color de trazo ' + color}
                    aria-pressed={stroke === color}
                    onClick={() => setStroke(color)}
                    style={{ '--stroke-color': color } as CSSProperties}
                  />
                ))}
                {[2, 4, 7].map((weight) => (
                  <button
                    key={weight}
                    className="inspiration-stroke-weight"
                    aria-label={`Grosor ${weight}`}
                    aria-pressed={strokeWeight === weight}
                    onClick={() => setStrokeWeight(weight)}
                  >
                    <i style={{ height: weight }} />
                  </button>
                ))}
                <button
                  className="inspiration-stroke-style"
                  aria-label="Alternar trazo continuo o punteado"
                  aria-pressed={strokeStyle === 'dashed'}
                  onClick={() =>
                    setStrokeStyle((current) =>
                      current === 'solid' ? 'dashed' : 'solid',
                    )
                  }
                >
                  {strokeStyle === 'solid' ? '—' : '– –'}
                </button>
              </div>
            )}
          {selectedPhoto && selection.length === 1 && (
            <div
              className="inspiration-selection-actions inspiration-photo-toolbar"
              role="toolbar"
              aria-label={'Acciones de ' + selectedPhoto.title}
              style={{
                left: Math.max(12, Math.min(viewportSize.width - 600,
                  positionFor(selectedPhoto.id).x * camera.zoom + camera.x)),
                top: Math.max(12, positionFor(selectedPhoto.id).y * camera.zoom + camera.y - 64),
                right: 'auto',
              }}
            >
              <span title={selectedPhoto.title}>{selectedPhoto.title}</span>
              {canEdit && (
                <>
                  <button
                    type="button"
                    aria-label="Texto alternativo de la foto"
                    title="Texto alternativo"
                    aria-expanded={photoAltOpen}
                    onClick={() => {
                      setPhotoAltDraft(selectedPhoto.note || '');
                      setPhotoAltOpen((value) => !value);
                      setPhotoMoreOpen(false);
                    }}
                  >ALT</button>
                  <button
                    type="button"
                    aria-label="Editar foto"
                    title="Editar foto"
                    onClick={() => setEditingImage(selectedPhoto.id)}
                  ><Pencil size={19} /></button>
                </>
              )}
              <button
                type="button"
                aria-label="Comentarios de la foto"
                title="Comentarios"
                aria-expanded={commentTarget === selectedPhoto.id}
                onClick={() => {
                  setCommentTarget((current) => current === selectedPhoto.id ? null : selectedPhoto.id);
                  setCommentText('');
                }}
              ><MessageCircle size={20} /></button>
              {canEdit && (
                <button
                  type="button"
                  aria-label={stickyMetadata[selectedPhoto.id]?.locked ? 'Desbloquear foto' : 'Bloquear foto'}
                  title={stickyMetadata[selectedPhoto.id]?.locked ? 'Desbloquear foto' : 'Bloquear foto'}
                  onClick={() => updateStickyMeta(selectedPhoto.id, (current) => ({ ...current, locked: !current.locked }))}
                >{stickyMetadata[selectedPhoto.id]?.locked ? <LockKeyhole size={19} /> : <UnlockKeyhole size={19} />}</button>
              )}
              <button
                type="button"
                aria-label="Más opciones de la foto"
                aria-expanded={photoMoreOpen}
                title="Más opciones"
                onClick={() => { setPhotoMoreOpen((value) => !value); setPhotoAltOpen(false); }}
              ><MoreHorizontal size={21} /></button>
              {photoAltOpen && canEdit && (
                <form className="inspiration-photo-toolbar-popover" onSubmit={(event) => {
                  event.preventDefault();
                  savePhotoAlt(selectedPhoto, photoAltDraft);
                }}>
                  <label htmlFor="inspiration-photo-alt">Texto alternativo</label>
                  <input id="inspiration-photo-alt" maxLength={2000} value={photoAltDraft}
                    onChange={(event) => setPhotoAltDraft(event.target.value)}
                    placeholder="Describí la foto" />
                  <button type="submit">Guardar</button>
                </form>
              )}
              {photoMoreOpen && (
                <div className="inspiration-photo-toolbar-popover inspiration-photo-toolbar-more">
                  <a href={assetUrl(selectedPhoto.asset!, project, share, invite)} target="_blank" rel="noopener noreferrer">Abrir foto <ArrowUpRight size={16} /></a>
                  <button type="button" onClick={() => void copyFromMenu(selectedPhoto.id)}>Copiar referencia</button>
                  {canEdit && <button type="button" onClick={deleteSelected}>Eliminar foto</button>}
                </div>
              )}
            </div>
          )}
          {(selection.length > 0 || selectedItem || selectedCanvasElement) && !selectedPhoto &&
            canEdit && (
              <div
                className={
                  'inspiration-selection-actions' +
                  (selectedSticky ? ' inspiration-sticky-toolbar' : '')
                }
                role="toolbar"
                aria-label="Acciones de selección"
                style={
                  selectedSticky && selectedItem
                    ? {
                        left: Math.max(
                          70,
                          Math.min(
                            viewportSize.width - 578,
                            positionFor(selectedItem.id).x * camera.zoom +
                              camera.x,
                          ),
                        ),
                        top: Math.max(
                          12,
                          positionFor(selectedItem.id).y * camera.zoom +
                            camera.y -
                            50,
                        ),
                        right: 'auto',
                      }
                    : undefined
                }
              >
                {selectedFrame && editingFrameTitle ? (
                  <input
                    ref={frameTitleInput}
                    className="inspiration-frame-title-input"
                    aria-label="Título del frame"
                    defaultValue={selectedFrame.title}
                    maxLength={120}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                      if (event.key === 'Escape') {
                        event.currentTarget.value = selectedFrame.title;
                        event.currentTarget.blur();
                      }
                    }}
                    onBlur={(event) => {
                      const title = event.currentTarget.value.trim();
                      if (title !== selectedFrame.title)
                        dispatchCanvas({
                          type: 'update',
                          element: { ...selectedFrame, title },
                        });
                      setEditingFrameTitle(false);
                    }}
                  />
                ) : !selectedSticky ? (
                  <span>
                    {selection.length > 1
                      ? `${selection.length} elementos`
                      : selectedItem?.title ||
                        selectedFrame?.title ||
                        (selectedFrame ? 'Frame' : 'Dibujo')}
                  </span>
                ) : null}
                {selection.length > 1 &&
                  !selection.every(
                    (key) =>
                      groups[key] && groups[key] === groups[selection[0]],
                  ) && (
                    <button
                      aria-label="Agrupar selección"
                      title="Agrupar selección (Ctrl / ⌘ G)"
                      onClick={groupSelection}
                    >
                      <Group size={16} />
                    </button>
                  )}
                {selection.some((key) => groups[key]) && (
                  <button
                    aria-label="Desagrupar selección"
                    title="Desagrupar selección"
                    onClick={ungroupSelection}
                  >
                    <Ungroup size={16} />
                  </button>
                )}
                {selectedFrame && selection.length === 1 && (
                  <>
                    <button
                      aria-label="Editar título del frame"
                      title="Editar título"
                      onClick={() => setEditingFrameTitle(true)}
                    >
                      <Pencil size={16} />
                    </button>
                    <label
                      className="inspiration-frame-color"
                      title="Color de fondo"
                    >
                      <input
                        type="color"
                        aria-label="Color de fondo del frame"
                        value={selectedFrame.fill}
                        onChange={(event) =>
                          dispatchCanvas({
                            type: 'update',
                            element: {
                              ...selectedFrame,
                              fill: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {selectedCanvasElement && selection.length === 1 && (
                  <button
                    aria-label="Comentar elemento"
                    title="Comentar elemento"
                    onClick={() => {
                      setCommentTarget(selectedCanvasElement);
                      setCommentText('');
                    }}
                  >
                    <MessageCircle size={17} />
                  </button>
                )}
                {selectedItem && selection.length === 1 && (
                  <>
                    {selectedSticky && (
                      <>
                        <span className="inspiration-sticky-type-mark">Aa</span>
                        <select
                          aria-label="Tamaño de letra"
                          value={selectedSticky.fontSize}
                          onChange={(event) =>
                            updateStickyMeta(selectedItem.id, (current) => ({
                              ...current,
                              fontSize: Number(event.target.value),
                            }))
                          }
                        >
                          {[14, 18, 24, 30, 36].map((size) => (
                            <option key={size} value={size}>
                              {size}px
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label="Negrita"
                          title="Negrita"
                          aria-pressed={selectedSticky.bold}
                          onClick={() =>
                            updateStickyMeta(selectedItem.id, (current) => ({
                              ...current,
                              bold: !current.bold,
                            }))
                          }
                        >
                          <Bold size={18} />
                        </button>
                        <button
                          aria-label="Alinear texto"
                          title="Alinear texto"
                          onClick={() =>
                            updateStickyMeta(selectedItem.id, (current) => ({
                              ...current,
                              align:
                                current.align === 'left'
                                  ? 'center'
                                  : current.align === 'center'
                                    ? 'right'
                                    : 'left',
                            }))
                          }
                        >
                          {selectedSticky.align === 'center' ? (
                            <AlignCenter size={18} />
                          ) : selectedSticky.align === 'right' ? (
                            <AlignRight size={18} />
                          ) : (
                            <AlignLeft size={18} />
                          )}
                        </button>
                        <button
                          className="inspiration-sticky-color-button"
                          aria-label="Cambiar color"
                          title="Cambiar color"
                          aria-pressed={stickyPanel === 'colors'}
                          style={
                            {
                              '--sticky-color': selectedSticky.color,
                            } as CSSProperties
                          }
                          onClick={() =>
                            setStickyPanel((panel) =>
                              panel === 'colors' ? null : 'colors',
                            )
                          }
                        />
                        <button
                          aria-label="Agregar tag"
                          title="Agregar tag"
                          aria-pressed={stickyPanel === 'tags'}
                          onClick={() =>
                            setStickyPanel((panel) =>
                              panel === 'tags' ? null : 'tags',
                            )
                          }
                        >
                          <Tag size={17} />
                        </button>
                        <button
                          aria-label="Agregar reacción"
                          title="Agregar reacción"
                          aria-pressed={stickyPanel === 'reactions'}
                          onClick={() =>
                            setStickyPanel((panel) =>
                              panel === 'reactions' ? null : 'reactions',
                            )
                          }
                        >
                          <SmilePlus size={18} />
                        </button>
                        <button
                          aria-label="Comentar post-it"
                          title="Comentar"
                          aria-expanded={commentTarget === selectedItem.id}
                          onClick={() => {
                            setCommentTarget((current) =>
                              current === selectedItem.id ? null : selectedItem.id,
                            );
                            setCommentText('');
                          }}
                        >
                          <MessageCircle size={18} />
                        </button>
                        <button
                          aria-label="Adjuntar link"
                          title="Adjuntar link"
                          onClick={() => {
                            setLinkDraft(selectedItem.url || '');
                            setStickyPanel((panel) =>
                              panel === 'link' ? null : 'link',
                            );
                          }}
                        >
                          <Link2 size={17} />
                        </button>
                        <button
                          aria-label="Crear siguiente post-it"
                          title="Crear siguiente post-it"
                          onClick={() => createNextPostIt(selectedItem.id)}
                        >
                          <ArrowRight size={19} />
                        </button>
                        <button
                          aria-label={
                            selectedSticky.locked
                              ? 'Desbloquear post-it'
                              : 'Bloquear post-it'
                          }
                          title={
                            selectedSticky.locked ? 'Desbloquear' : 'Bloquear'
                          }
                          onClick={() =>
                            updateStickyMeta(selectedItem.id, (current) => ({
                              ...current,
                              locked: !current.locked,
                            }))
                          }
                        >
                          {selectedSticky.locked ? (
                            <LockKeyhole size={18} />
                          ) : (
                            <UnlockKeyhole size={18} />
                          )}
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  aria-label="Eliminar selección"
                  title="Eliminar selección"
                  onClick={deleteSelected}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  aria-label="Cerrar selección"
                  onClick={() => {
                    selectCard(null);
                    focusBoard();
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          {selectedItem && selectedSticky && stickyPanel && (
            <div
              className="inspiration-sticky-inspector"
              aria-label="Opciones del post-it"
              style={{
                left: Math.max(
                  70,
                  Math.min(
                    viewportSize.width - 280,
                    positionFor(selectedItem.id).x * camera.zoom + camera.x,
                  ),
                ),
                top: Math.max(
                  54,
                  positionFor(selectedItem.id).y * camera.zoom + camera.y - 12,
                ),
                right: 'auto',
              }}
            >
              {stickyPanel === 'colors' && (
                <div className="inspiration-sticky-inspector-colors">
                  {stickyColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Color ${color}`}
                      aria-pressed={selectedSticky.color === color}
                      style={{ '--sticky-color': color } as CSSProperties}
                      onClick={() =>
                        updateStickyMeta(selectedItem.id, (current) => ({
                          ...current,
                          color,
                        }))
                      }
                    />
                  ))}
                </div>
              )}
              {stickyPanel === 'tags' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const tag = tagDraft.trim().slice(0, 24);
                    if (!tag) return;
                    updateStickyMeta(selectedItem.id, (current) => ({
                      ...current,
                      tags: [...new Set([...current.tags, tag])].slice(0, 5),
                    }));
                    setTagDraft('');
                  }}
                >
                  <input
                    value={tagDraft}
                    maxLength={24}
                    aria-label="Nuevo tag"
                    placeholder="Escribí un tag"
                    onChange={(event) => setTagDraft(event.target.value)}
                  />
                  <button type="submit">Agregar</button>
                </form>
              )}
              {stickyPanel === 'reactions' && (
                <div className="inspiration-sticky-reaction-picker">
                  {['👍', '❤️', '🎉', '👀', '💡', '✅'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Reaccionar ${emoji}`}
                      aria-pressed={myReactions.get(selectedItem.id) === emoji}
                      onClick={() => addReaction(selectedItem.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {stickyPanel === 'link' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const url = linkDraft.trim();
                    if (url && !safeReferenceUrl(url)) {
                      notify('Usá un enlace http o https válido.');
                      return;
                    }
                    setStickyPanel(null);
                    void runCanvas({
                      action: 'edit-inspiration',
                      id: selectedItem.id,
                      title: selectedItem.title,
                      note: selectedItem.note || '',
                      url,
                      category: selectedItem.category || 'general',
                    }, (current) => ({
                      ...current,
                      inspiration: current.inspiration.map((item) => item.id === selectedItem.id ? { ...item, url } : item),
                    }), `inspiration:${selectedItem.id}`).catch(() => {});
                  }}
                >
                  <input
                    ref={stickyLinkInput}
                    type="url"
                    aria-label="Enlace del post-it"
                    placeholder="https://…"
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                  />
                  <button type="submit">Guardar</button>
                </form>
              )}
            </div>
          )}
          {/* The canvas is a keyboard-operated application, not a document region. */}
          {/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            ref={viewport}
            className={
              'inspiration-board-shell free-canvas' +
              (hand || space ? ' hand-tool' : '') +
              (['draw', 'marker', 'smart'].includes(tool) && !hand && !space
                ? ' draw-tool'
                : '') +
              (tool === 'sticky' && !hand && !space ? ' sticky-tool' : '') +
              (tool === 'text' && !hand && !space ? ' shape-tool' : '') +
              (tool === 'frame' && !hand && !space ? ' shape-tool' : '') +
              (tool === 'line' && !hand && !space ? ' shape-tool' : '') +
              (['erase', 'erase-area'].includes(tool) && !hand && !space
                ? ' erase-tool'
                : '') +
              ((tool === 'rectangle' ||
                tool === 'circle' ||
                tool === 'arrow') &&
              !hand &&
              !space
                ? ' shape-tool'
                : '') +
              (dragging ? ' is-dragging' : '')
            }
            tabIndex={0}
            data-reference-count={data.inspiration.length}
            role="application"
            aria-label="Mesa de trabajo. Seleccioná y arrastrá tarjetas, figuras, flechas o trazos para moverlos. Pegá imágenes con Control o Command V. Espacio y arrastrar para desplazarte."
            onPaste={paste}
            onCopy={copy}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            onPointerDownCapture={(event) => {
              if (!(hand || space)) return;
              const target = event.target as HTMLElement;
              if (
                target.closest(
                  '.inspiration-context-menu, .inspiration-raw-text-editor',
                )
              )
                return;
              const card = target.closest<HTMLElement>('[data-card]');
              if (card) startGesture(event, card.dataset.card);
            }}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.inspiration-raw-text-editor')) return;
              if (target.closest('.inspiration-context-menu')) return;
              setContextMenu(null);
              const card = target.closest<HTMLElement>('[data-card]');
              if (
                tool === 'text' &&
                canEdit &&
                !hand &&
                !space &&
                event.button === 0 &&
                !card
              ) {
                event.preventDefault();
                createTextAt(worldPoint(event.clientX, event.clientY));
                return;
              }
              if (
                tool === 'sticky' &&
                canEdit &&
                !hand &&
                !space &&
                event.button === 0 &&
                !card
              ) {
                event.preventDefault();
                event.stopPropagation();
                createPostItAt(worldPoint(event.clientX, event.clientY));
                return;
              }
              if (tool === 'erase' && canEdit) {
                event.preventDefault();
                event.stopPropagation();
                eraseAtPointer(event);
                viewport.current?.setPointerCapture(event.pointerId);
                return;
              }
              if (tool === 'erase-area' && !card && canEdit) {
                startGesture(event);
                return;
              }
              const drawingTool =
                tool !== 'select' &&
                tool !== 'sticky' &&
                tool !== 'text' &&
                tool !== 'erase' &&
                tool !== 'erase-area' &&
                tool !== 'lasso' &&
                !hand &&
                !space &&
                event.button === 0 &&
                !target.closest('button, a, input, textarea, select');
              if (drawingTool) {
                beginCanvasElement(event);
                return;
              }
              if (!card) {
                const element =
                  (tool === 'select' || tool === 'lasso') && !hand && !space
                    ? markAt(worldPoint(event.clientX, event.clientY))
                    : undefined;
                if (element) startCanvasGesture(event, element);
                else if (!beginCanvasElement(event)) startGesture(event);
              } else if (
                card.dataset.card &&
                (hand ||
                  space ||
                  event.button === 1 ||
                  !target.closest(
                    'button, a, input, textarea, select, .inspiration-note-text',
                  ))
              ) {
                startGesture(event, card.dataset.card);
              }
            }}
            onDoubleClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('[data-card], button, input, textarea'))
                return;
              const element = markAt(worldPoint(event.clientX, event.clientY));
              if (element?.type === 'text' && canEdit) {
                textEditorFinishing.current = false;
                setTextEditor({
                  id: element.id,
                  x: element.x,
                  y: element.y,
                  width: element.width,
                  height: element.height,
                  text: element.text,
                  isNew: false,
                });
                return;
              }
              if (element?.type === 'frame') {
                selectCanvasElement(element.id);
              }
            }}
            onPointerMove={(event) => {
              if (event.pointerType !== 'touch') {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                  const point = worldPoint(event.clientX, event.clientY);
                  const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card;
                  const origin = card && defaults[card] ? positionFor(card) : null;
                  presence.cursor.current = origin && card
                    ? { x: point.x, y: point.y, card, dx: point.x - origin.x, dy: point.y - origin.y }
                    : { x: point.x, y: point.y };
                } else presence.cursor.current = null;
              }
              if (
                tool === 'erase' &&
                event.buttons === 1 &&
                !gesture.current &&
                !activeCanvasElement.current
              )
                eraseAtPointer(event);
              if (!updateCanvasElement(event)) moveGesture(event);
            }}
            onPointerLeave={() => { presence.cursor.current = null; }}
            onPointerUp={(event) => {
              if (!finishCanvasElement(event)) endGesture();
            }}
            onPointerCancel={() => {
              activeCanvasElement.current = null;
              clearCanvasPreview();
              endGesture();
            }}
            onLostPointerCapture={() => {
              activeCanvasElement.current = null;
              clearCanvasPreview();
              endGesture();
            }}
            onContextMenu={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.inspiration-context-menu')) return;
              event.preventDefault();
              const card = target.closest<HTMLElement>('[data-card]');
              const id = card?.dataset.card;
              const point = worldPoint(event.clientX, event.clientY);
              insertion.current = point;
              if (id) selectCard(id);
              else selectCanvasElement(markAt(point)?.id || null);
              setContextMenu({
                x: Math.min(event.clientX, window.innerWidth - 190),
                y: Math.min(event.clientY, window.innerHeight - 150),
                point,
                card: id,
                isPostIt: Boolean(card?.classList.contains('post-it')),
              });
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              )
                return;
              setSpace(false);
              activeCanvasElement.current = null;
              clearCanvasPreview();
              endGesture();
              setContextMenu(null);
            }}
            onKeyDown={(event) => {
              if (
                editableTarget(event.target) ||
                event.target !== event.currentTarget
              )
                return;
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'z'
              ) {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
              }
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'y'
              ) {
                event.preventDefault();
                redoCanvas();
                return;
              }
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'g'
              ) {
                event.preventDefault();
                if (event.shiftKey) ungroupSelection();
                else groupSelection();
                return;
              }
              if (!event.metaKey && !event.ctrlKey && !event.altKey) {
                const key = event.key.toLowerCase();
                if (key === 'v') chooseTool('select');
                if (key === 'h') {
                  setHand(true);
                  setTool('select');
                }
                if (key === '1') fitBoard();
                if (canEdit && key === 'n') {
                  event.preventDefault();
                  chooseTool('sticky');
                  setStickyPanel('colors');
                }
                if (canEdit && key === 't') chooseTool('text');
                if (canEdit && key === 'p') chooseTool('draw');
                if (canEdit && key === 'r') chooseTool('rectangle');
                if (canEdit && key === 'o') chooseTool('circle');
              }
              if (event.code === 'Space') {
                event.preventDefault();
                setSpace(true);
              }
              if (event.key === 'Escape') {
                activeCanvasElement.current = null;
                clearCanvasPreview();
                endGesture();
                chooseTool('select');
                selectCard(null);
                setContextMenu(null);
              }
              if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                deleteSelected();
              }
              if (
                event.key.startsWith('Arrow') &&
                (selected || selectedCanvasElement || selection.length) &&
                canEdit
              ) {
                event.preventDefault();
                const delta = event.shiftKey ? 40 : 10;
                const offset = {
                  x:
                    event.key === 'ArrowRight'
                      ? delta
                      : event.key === 'ArrowLeft'
                        ? -delta
                        : 0,
                  y:
                    event.key === 'ArrowDown'
                      ? delta
                      : event.key === 'ArrowUp'
                        ? -delta
                        : 0,
                };
                if (selection.length > 1) {
                  const cards = selection
                    .filter((key) => key.startsWith('card:'))
                    .map((key) => key.slice(5));
                  const marks = new Set(
                    selection
                      .filter((key) => key.startsWith('element:'))
                      .map((key) => key.slice(8)),
                  );
                  const before = { elements: canvasElements, positions };
                  if (cards.length)
                    setPositions((current) => ({
                      ...current,
                      ...Object.fromEntries(
                        cards.map((id) => {
                          const point = positionFor(id);
                          return [
                            id,
                            { x: point.x + offset.x, y: point.y + offset.y },
                          ];
                        }),
                      ),
                    }));
                  if (marks.size)
                    dispatchCanvas({
                      type: 'replace',
                      elements: canvasElements.map((element) =>
                        marks.has(element.id)
                          ? translateCanvasElement(element, offset)
                          : element,
                      ),
                    });
                  dispatchCanvas({ type: 'commit', before });
                } else if (selected) {
                  const previous = positionFor(selected);
                  setPositions(
                    (current) => ({
                      ...current,
                      [selected]: {
                        x: previous.x + offset.x,
                        y: previous.y + offset.y,
                      },
                    }),
                    true,
                  );
                } else if (selectedCanvasElement) {
                  const element = canvasElements.find(
                    (candidate) => candidate.id === selectedCanvasElement,
                  );
                  if (element) {
                    dispatchCanvas({
                      type: 'replace',
                      elements: canvasElements.map((candidate) =>
                        candidate.id === element.id
                          ? translateCanvasElement(element, offset)
                          : candidate,
                      ),
                    });
                    dispatchCanvas({
                      type: 'commit',
                      before: { elements: canvasElements, positions },
                    });
                  }
                }
              }
            }}
            onKeyUp={(event) => {
              if (event.code === 'Space') setSpace(false);
            }}
            style={
              {
                backgroundPosition: camera.x + 'px ' + camera.y + 'px',
                '--sticky-cursor': stickyCursor(stickyColor),
              } as CSSProperties
            }
          >
            {contextMenu && (
              <div
                className="inspiration-context-menu"
                role="menu"
                aria-label="Acciones del lienzo"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                {contextMenu.card && (
                  <button
                    role="menuitem"
                    onClick={() => void copyFromMenu(contextMenu.card!)}
                  >
                    Copiar
                  </button>
                )}
                {canEdit && (
                  <button
                    role="menuitem"
                    onClick={() => void pasteFromMenu(contextMenu.point)}
                  >
                    Pegar
                  </button>
                )}
                {canEdit && !contextMenu.isPostIt && (
                  <button
                    role="menuitem"
                    onClick={() => createPostItAt(contextMenu.point)}
                  >
                    Crear post-it
                  </button>
                )}
                {canEdit && !contextMenu.card && (
                  <button
                    role="menuitem"
                    onClick={() => createTextAt(contextMenu.point)}
                  >
                    Agregar texto libre
                  </button>
                )}
              </div>
            )}
            <InspirationCanvas
              index={sceneIndex}
              camera={camera}
              size={viewportSize}
              draft={canvasDraft}
              guides={alignmentGuides}
              selected={selectedCanvasMarks}
              editingId={textEditor?.id}
            />
            {presence.peers.map((peer) => {
              if (!peer.cursor) return null;
              const point = peerPoint(peer.cursor);
              return <div key={peer.id} className="inspiration-peer-cursor" aria-label={`${peer.name} señala esta parte de la mesa`}
                style={{ left: point.x * camera.zoom + camera.x, top: point.y * camera.zoom + camera.y }}>
                <MousePointer2 size={20} aria-hidden="true" /><span>{peer.name}</span>
              </div>;
            })}
            {textEditor && (
              <textarea
                ref={textInput}
                className="inspiration-raw-text-editor"
                aria-label="Texto libre del lienzo"
                placeholder="Escribí acá…"
                maxLength={2000}
                value={textEditor.text}
                onChange={(event) => {
                  const height = Math.max(
                    56,
                    Math.ceil(event.currentTarget.scrollHeight / camera.zoom),
                  );
                  setTextEditor(
                    (current) =>
                      current && {
                        ...current,
                        text: event.target.value,
                        height,
                      },
                  );
                }}
                onBlur={() => finishTextEditor()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    finishTextEditor(false);
                    focusBoard();
                  }
                  if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    finishTextEditor();
                    focusBoard();
                  }
                }}
                style={{
                  left: camera.x + textEditor.x * camera.zoom,
                  top: camera.y + textEditor.y * camera.zoom,
                  width: textEditor.width * camera.zoom,
                  height: textEditor.height * camera.zoom,
                  fontSize: 20 * camera.zoom,
                  lineHeight: `${28 * camera.zoom}px`,
                }}
              />
            )}
            {lassoPoints.length > 1 && (
              <svg
                className="inspiration-lasso-preview"
                aria-hidden="true"
                width={viewportSize.width}
                height={viewportSize.height}
              >
                <polyline
                  points={lassoPoints
                    .map(
                      (point) =>
                        `${point.x * camera.zoom + camera.x},${point.y * camera.zoom + camera.y}`,
                    )
                    .join(' ')}
                />
              </svg>
            )}
            <div
              className="inspiration-world"
              style={{
                transform:
                  'translate(' +
                  camera.x +
                  'px, ' +
                  camera.y +
                  'px) scale(' +
                  camera.zoom +
                  ')',
              }}
            >
              <svg className="inspiration-sequence-links" aria-hidden="true">
                <defs>
                  <marker
                    id="inspiration-sequence-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#858c88" />
                  </marker>
                </defs>
                {[
                  ...stickyLinks.map((link) => ({
                    ...link,
                    point: null as Point | null,
                  })),
                  ...pending
                    .filter((entry) => entry.draft.sequenceFrom)
                    .map((entry) => ({
                      from: entry.draft.sequenceFrom!,
                      to: entry.id,
                      point: entry.point as Point | null,
                    })),
                ]
                  .filter(
                    (link) =>
                      availableStickyIds.has(link.from) &&
                      (link.point || availableStickyIds.has(link.to)),
                  )
                  .map((link) => {
                    const from = positionFor(link.from);
                    const fromMeta =
                      stickyMetadata[link.from] || defaultStickyMeta();
                    const to = link.point || positionFor(link.to);
                    return (
                      <line
                        key={link.from + ':' + link.to}
                        x1={from.x + fromMeta.width + 8}
                        y1={from.y + fromMeta.height / 2}
                        x2={to.x - 13}
                        y2={to.y + (stickyMetadata[link.to]?.height || 240) / 2}
                        stroke="#858c88"
                        strokeWidth="2"
                        markerEnd="url(#inspiration-sequence-arrow)"
                      />
                    );
                  })}
              </svg>
              {selectedFrame && canEdit && (
                <div
                  className="inspiration-frame-resize-box"
                  style={{
                    left: selectedFrame.x,
                    top: selectedFrame.y,
                    width: selectedFrame.width,
                    height: selectedFrame.height,
                  }}
                >
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                    <button
                      key={corner}
                      type="button"
                      className={'inspiration-frame-resize-handle ' + corner}
                      aria-label={'Redimensionar frame ' + corner}
                      onPointerDown={(event) =>
                        startFrameResize(event, selectedFrame, corner)
                      }
                    />
                  ))}
                </div>
              )}
              {marquee && (
                <div
                  className="inspiration-marquee"
                  style={{
                    left: marquee.left,
                    top: marquee.top,
                    width: marquee.right - marquee.left,
                    height: marquee.bottom - marquee.top,
                  }}
                />
              )}
              {visibleItems.map(({ item, order: index }) => {
                const point = positionFor(item.id),
                  asset = item.asset ? assetMap.get(item.asset) : undefined;
                const stickyMeta = stickyMetadata[item.id];
                const isNote =
                  !item.asset && (!item.url || Boolean(stickyMeta));
                const noteMeta = isNote
                  ? stickyMeta || defaultStickyMeta(stickyColors[index % 3])
                  : null;
                const isPhoto =
                  asset && /^image\/(jpeg|png|webp|avif)$/.test(asset.mime);
                const itemComments = commentsByItem.get(item.id) || [];
                const itemReactions = { ...noteMeta?.reactions };
                for (const [emoji, count] of Object.entries(reactionsByItem.get(item.id) || {}))
                  itemReactions[emoji] = (itemReactions[emoji] || 0) + count;
                return (
                  <article
                    data-card={item.id}
                    ref={(node) => {
                      if (node) cardNodes.current.set(item.id, node);
                      else cardNodes.current.delete(item.id);
                    }}
                    key={item.id}
                    className={
                      'inspiration-card inspiration-board-card ' +
                      (isPhoto ? 'inspiration-photo-card ' : '') +
                      (isNote ? 'post-it post-it-' + (index % 3) : '') +
                      (isNote && commentTarget === item.id ? ' commenting' : '') +
                      (isPhoto && commentTarget === item.id ? ' commenting' : '') +
                      (selection.includes('card:' + item.id) ? ' selected' : '')
                    }
                    style={
                      {
                        left: point.x,
                        top: point.y,
                        ...(noteMeta
                          ? {
                              width: noteMeta.width,
                              height: noteMeta.height,
                              '--sticky-color': noteMeta.color,
                              '--sticky-ink':
                                noteMeta.color === '#303030'
                                  ? '#ffffff'
                                  : '#252525',
                            }
                          : {}),
                      } as CSSProperties
                    }
                  >
                    {isPhoto ? (
                      <><PhotoFrame
                        item={item}
                        asset={asset}
                        project={project}
                        share={share}
                        invite={invite}
                        selected={selected === item.id}
                        canEdit={canEdit}
                        locked={Boolean(stickyMetadata[item.id]?.locked)}
                        zoom={camera.zoom}
                        onDrag={startGesture}
                      />
                      {commentTarget === item.id && renderCommentThread(item.title, itemComments, { x: 0, y: 0 }, true)}</>
                    ) : (
                      <>
                        <button
                          className="inspiration-drag-handle"
                          aria-label={'Seleccionar y mover ' + item.title}
                          aria-pressed={selected === item.id}
                          onPointerDown={(event) =>
                            startGesture(event, item.id)
                          }
                          onClick={() => {
                            if (!selection.includes('card:' + item.id))
                              selectTarget('card:' + item.id);
                            focusBoard();
                          }}
                        >
                          <GripHorizontal size={19} />
                        </button>
                        {(!isNote || itemComments.length > 0) && (
                          <CommentBubble
                            count={itemComments.length}
                            title={item.title}
                            sticky={isNote}
                            latest={isNote ? itemComments.at(-1) : undefined}
                            position={commentBubblePositions['card:' + item.id]}
                            zoom={camera.zoom}
                            onMove={canEdit ? (point) => moveCommentBubble('card:' + item.id, point) : undefined}
                            onClick={() => {
                              setCommentTarget((current) => current === item.id ? null : item.id);
                              setCommentText('');
                              if (!isNote) selectCard(item.id);
                            }}
                          />
                        )}
                        {isNote && commentTarget === item.id && renderCommentThread(
                          item.title,
                          itemComments,
                          commentBubblePositions['card:' + item.id] || { x: (noteMeta?.width || 300) - 30, y: (noteMeta?.height || 240) - 62 },
                        )}
                        {asset ? (
                          <Media
                            key={asset.id}
                            asset={asset}
                            project={project}
                            share={share}
                            invite={invite}
                          />
                        ) : item.url && !isNote ? (
                          <div
                            className={
                              'inspiration-card-visual visual-' + (index % 5)
                            }
                          >
                            <div className="inspiration-link-art">
                              <Link2 size={26} />
                              <span>
                                {new URL(
                                  safeReferenceUrl(item.url) ||
                                    'https://enlace.invalid',
                                ).hostname.replace(/^www\./, '')}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <div className="inspiration-card-body">
                          {!isNote && (
                            <div className="inspiration-card-meta">
                              <span>{shortDate(item.created)}</span>
                            </div>
                          )}
                          {!isNote && <h3>{item.title}</h3>}
                          {isNote ? (
                            <div
                              className="inspiration-note-text"
                              role="textbox"
                              tabIndex={0}
                              aria-label="Texto del post-it"
                              aria-multiline="true"
                              contentEditable={canEdit && !noteMeta?.locked}
                              suppressContentEditableWarning
                              data-placeholder=""
                              style={{
                                fontSize: noteMeta?.fontSize,
                                fontWeight: noteMeta?.bold ? 700 : 400,
                                textAlign: noteMeta?.align,
                              }}
                              onPointerDown={(event) => {
                                if (tool === 'erase') return;
                                event.stopPropagation();
                                if (tool === 'select' && canEdit && !noteMeta?.locked && event.button === 0) {
                                  notePointer.current = {
                                    id: item.id,
                                    pointer: event.pointerId,
                                    x: event.clientX,
                                    y: event.clientY,
                                  };
                                }
                              }}
                              onPointerMove={(event) => {
                                const pointer = notePointer.current;
                                if (!pointer || pointer.id !== item.id || pointer.pointer !== event.pointerId) return;
                                if (event.buttons !== 1) {
                                  notePointer.current = null;
                                  return;
                                }
                                if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
                                notePointer.current = null;
                                window.getSelection()?.removeAllRanges();
                                startGesture(event, item.id);
                              }}
                              onPointerUp={() => { notePointer.current = null; }}
                              onPointerCancel={() => { notePointer.current = null; }}
                              onFocus={() => selectCard(item.id)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === 'Escape' ||
                                  ((event.metaKey || event.ctrlKey) &&
                                    event.key === 'Enter')
                                )
                                  event.currentTarget.blur();
                              }}
                              onBlur={(event) =>
                                saveStickyText(
                                  item,
                                  event.currentTarget.innerText.replace(
                                    /\u00a0/g,
                                    ' ',
                                  ),
                                )
                              }
                            >
                              {item.note ||
                                (item.title !== 'Post-it' ? item.title : '')}
                            </div>
                          ) : item.note ? (
                            <p className="inspiration-note-text">{item.note}</p>
                          ) : null}
                          {noteMeta && noteMeta.tags.length > 0 && (
                            <div
                              className="inspiration-sticky-tags"
                              aria-label="Tags"
                            >
                              {noteMeta.tags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  title="Quitar tag"
                                  onClick={() =>
                                    updateStickyMeta(item.id, (current) => ({
                                      ...current,
                                      tags: current.tags.filter(
                                        (value) => value !== tag,
                                      ),
                                    }))
                                  }
                                >
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          )}
                          {safeReferenceUrl(item.url) && (
                            <a
                              href={safeReferenceUrl(item.url) || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir enlace <ArrowUpRight size={15} />
                            </a>
                          )}
                          {asset && (
                            <a
                              href={assetUrl(asset.id, project, share, invite)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir archivo · {formatBytes(asset.size)}{' '}
                              <ArrowUpRight size={15} />
                            </a>
                          )}
                          {!isNote && (
                            <div className="inspiration-card-footer">
                              <span>Por {item.author}</span>
                            </div>
                          )}
                          {noteMeta &&
                            Object.keys(itemReactions).length > 0 && (
                              <div
                                className="inspiration-sticky-reactions"
                                aria-label="Reacciones"
                              >
                                {Object.entries(itemReactions).map(
                                  ([emoji, count]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      aria-label={`${emoji} ${count}`}
                                      aria-pressed={myReactions.get(item.id) === emoji}
                                      disabled={!canEdit}
                                      onClick={() => addReaction(item.id, emoji)}
                                    >
                                      {emoji} <span>{count}</span>
                                    </button>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                        {noteMeta && canEdit && (
                          <button
                            className="inspiration-sticky-resize"
                            type="button"
                            aria-label="Redimensionar post-it"
                            onPointerDown={(event) =>
                              startStickyResize(event, item.id)
                            }
                          />
                        )}
                      </>
                    )}
                  </article>
                );
              })}
              {canvasElements.filter((element) =>
                element.id === selectedCanvasElement || element.id === commentTarget || (commentsByElement.get(element.id)?.length || 0) > 0,
              ).map((element) => {
                const bounds = boundsForCanvasElement(element);
                const comments = commentsByElement.get(element.id) || [];
                const bubble = commentBubblePositions['element:' + element.id] || {
                  x: Math.max(0, bounds.right - bounds.left) + 8,
                  y: Math.max(0, bounds.bottom - bounds.top) / 2,
                };
                const title = element.type === 'frame' ? element.title || 'frame'
                  : element.type === 'text' ? element.text.slice(0, 40) || 'texto'
                  : element.type === 'stroke' ? 'trazo' : element.type === 'arrow' ? 'flecha'
                  : element.type === 'circle' ? 'círculo' : 'rectángulo';
                return (
                  <div
                    key={element.id}
                    className={'inspiration-mark-comment' + (commentTarget === element.id ? ' commenting' : '')}
                    style={{ left: bounds.left, top: bounds.top }}
                  >
                    <CommentBubble
                      count={comments.length}
                      title={title}
                      latest={comments.at(-1)}
                      sticky
                      position={bubble}
                      zoom={camera.zoom}
                      onMove={canEdit ? (point) => moveCommentBubble('element:' + element.id, point) : undefined}
                      onClick={() => {
                        setCommentTarget((current) => current === element.id ? null : element.id);
                        setCommentText('');
                      }}
                    />
                    {commentTarget === element.id && renderCommentThread(title, comments, bubble)}
                  </div>
                );
              })}
              {pending.map((entry) => (
                <article
                  data-card={entry.id}
                  key={entry.id}
                  ref={(node) => {
                    if (node) cardNodes.current.set(entry.id, node);
                    else cardNodes.current.delete(entry.id);
                  }}
                  className={
                    'inspiration-card inspiration-board-card inspiration-pending' +
                    (entry.preview ? ' inspiration-pending-photo' : '') +
                    (selected === entry.id ? ' selected' : '') +
                    (entry.draft.sticky
                      ? ' post-it inspiration-pending-sticky'
                      : '')
                  }
                  style={
                    {
                      left: positionFor(entry.id).x,
                      top: positionFor(entry.id).y,
                      ...(entry.draft.sticky
                        ? {
                            width: entry.draft.sticky.width,
                            height: entry.draft.sticky.height,
                            '--sticky-color': entry.draft.sticky.color,
                            '--sticky-ink':
                              entry.draft.sticky.color === '#303030'
                                ? '#ffffff'
                                : '#252525',
                          }
                        : {}),
                    } as CSSProperties
                  }
                  onPointerDown={(event) => {
                    if (entry.preview && !(event.target as HTMLElement).closest('button'))
                      startGesture(event, entry.id);
                  }}
                >
                  {entry.preview && (
                    <PendingPhoto
                      entry={entry}
                      project={project}
                      zoom={camera.zoom}
                      selected={selected === entry.id}
                    />
                  )}
                  {(!entry.preview || entry.error) && (
                    <div className="inspiration-card-body">
                      {!entry.preview && (
                        <h3>
                          {entry.draft.sticky
                            ? 'Escribí una idea…'
                            : entry.draft.title}
                        </h3>
                      )}
                      {entry.error && (
                        <>
                          <output>{entry.error}</output>
                          <button
                            className="workspace-secondary"
                            onClick={() => {
                              setPending((current) =>
                                current.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, error: undefined }
                                    : item,
                                ),
                              );
                              void upload(entry);
                            }}
                          >
                            Reintentar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
            {!items.length && !pending.length && !canvasElements.length && (
              <div className="inspiration-canvas-empty">
                <ImagePlus size={32} />
                <strong>{'El proyecto empieza con una idea'}</strong>
                <p>
                  {canEdit
                    ? 'Arrastrá imágenes, pegá un enlace o anotá lo que querés explorar.'
                    : 'El lienzo aparecerá acá.'}
                </p>
              </div>
            )}
          </div>
          {editingImage &&
            (() => {
              const item = items.find(
                (candidate) => candidate.id === editingImage,
              );
              const asset = item?.asset ? assetMap.get(item.asset) : undefined;
              return item && asset ? (
                <ImageEditor
                  key={item.id}
                  title={item.title}
                  source={assetUrl(asset.id, project, share, invite)}
                  canEdit={canEdit}
                  onClose={() => setEditingImage(null)}
                  onSave={async (file) => {
                    const validationError = inspirationFileError(file);
                    if (validationError) throw new Error(validationError);
                    const uploaded = await uploadWorkspaceAsset(
                      file,
                      project,
                      share,
                      invite,
                      'inspiration',
                    );
                    await runCanvas({
                      action: 'replace-inspiration-image',
                      id: item.id,
                      asset: uploaded,
                    }, (current) => ({
                      ...current,
                      assets: [...current.assets, {
                        id: uploaded,
                        project,
                        name: file.name,
                        mime: file.type,
                        size: file.size,
                        created: Date.now(),
                      }],
                      inspiration: current.inspiration.map((entry) => entry.id === item.id ? { ...entry, asset: uploaded } : entry),
                    }), `inspiration:${item.id}`);
                  }}
                />
              ) : null;
            })()}
          {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div className="inspiration-canvas-footer">
            <div className="inspiration-board-state">
              <output className={storageError ? 'storage-error' : ''}>
                {storageError
                  ? 'No se pudo guardar la distribución'
                  : dragging
                    ? 'Organizando…'
                    : 'Distribución en este navegador'}
              </output>
              <button
                aria-label="Ayuda del lienzo"
                aria-expanded={help}
                onClick={() => setHelp((value) => !value)}
              >
                <Keyboard size={16} />
                <span>Atajos y guardado</span>
              </button>
            </div>
            {help && (
              <aside className="inspiration-help">
                <strong>Tu mesa de trabajo</strong>
                <p>
                  Los post-its y los comentarios se guardan en el proyecto. La
                  distribución y los dibujos se guardan solo en este navegador.
                </p>
                <dl>
                  <dt>Seleccionar / mover</dt>
                  <dd>V / H</dd>
                  <dt>Nota / lápiz</dt>
                  <dd>N / P</dd>
                  <dt>Desplazar</dt>
                  <dd>Espacio + arrastrar</dd>
                  <dt>Deshacer / rehacer</dt>
                  <dd>⌘ / Ctrl Z · Shift Z</dd>
                  <dt>Ver todo</dt>
                  <dd>1</dd>
                </dl>
                <p>
                  Deshacer recupera dibujos y movimientos. La edición y
                  eliminación de post-its se guardan en el proyecto.
                </p>
              </aside>
            )}
            <div className="inspiration-zoom">
              <button
                aria-label="Alejar"
                onClick={() => zoomAt(camera.zoom / 1.2)}
              >
                <Minus size={16} />
              </button>
              <button aria-label="Restablecer zoom" onClick={() => zoomAt(1)}>
                {Math.round(camera.zoom * 100)}%
              </button>
              <button
                aria-label="Acercar"
                onClick={() => zoomAt(camera.zoom * 1.2)}
              >
                <Plus size={16} />
              </button>
              <button
                aria-label="Ver todo el lienzo"
                title="Ver todo"
                onClick={fitBoard}
              >
                <Scan size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>
      {commentTarget && commentItem && !commentItemIsNote && !commentItemIsPhoto && (
        <dialog
          className="workspace-modal-backdrop inspiration-dialog"
          aria-label={'Comentarios de ' + commentItem.title}
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={() => {
            setCommentTarget(null);
            setCommentText('');
            focusBoard();
          }}
        >
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar comentarios"
            onClick={() => {
              setCommentTarget(null);
              setCommentText('');
              focusBoard();
            }}
          />
          <section
            className="workspace-modal inspiration-comments"
            aria-live="polite"
          >
            <p className="workspace-eyebrow">CONVERSACIÓN SOBRE LA IDEA</p>
            <div className="inspiration-comments-title">
              <h2>{commentItem.title}</h2>
              <span>
                <MessageCircle size={16} /> {selectedComments.length}
              </span>
            </div>
            <div className="inspiration-comment-list">
              {selectedComments.length ? (
                selectedComments.map((comment) => (
                  <article key={comment.id}>
                    <strong>{comment.author}</strong>
                    <time>{shortDate(comment.created)}</time>
                    {canEdit && (comment.mine || data.viewer.accountOwner) && (
                      <button
                        type="button"
                        className="inspiration-comment-delete"
                        aria-label={`Eliminar comentario de ${comment.author}`}
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" /> Eliminar
                      </button>
                    )}
                    <p>{comment.text}</p>
                  </article>
                ))
              ) : (
                <p className="workspace-muted">
                  Todavía no hay comentarios sobre esta idea.
                </p>
              )}
            </div>
            {canEdit && (
              <form className="inspiration-comment-form" onSubmit={saveComment}>
                <label>
                  Nuevo comentario
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Dejá una observación para el equipo…"
                  />
                </label>
                <div className="workspace-modal-actions">
                  <button
                    type="button"
                    className="workspace-secondary"
                    onClick={() => {
                      setCommentTarget(null);
                      setCommentText('');
                      focusBoard();
                    }}
                  >
                    Cerrar
                  </button>
                  <button
                    className="workspace-primary"
                    disabled={!commentText.trim()}
                  >
                    Comentar
                  </button>
                </div>
              </form>
            )}
          </section>
        </dialog>
      )}
    </div>
  );
}

export default function Inspiration(props: WorkspaceViewProps) {
  const { data, project, busy, run } = props;
  const [openIds, setOpenIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['default'];
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem('fabrica:open-worktables:' + project) ||
          '["default"]',
      );
      return Array.isArray(saved)
        ? saved
            .filter((id): id is string => typeof id === 'string')
            .slice(0, 100)
        : ['default'];
    } catch {
      return ['default'];
    }
  });
  const [activeId, setActiveId] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    try {
      return (
        localStorage.getItem('fabrica:active-worktable:' + project) || 'default'
      );
    } catch {
      return 'default';
    }
  });
  const [showBoards, setShowBoards] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const allBoards = useMemo(
    () => [
      {
        id: 'default',
        project,
        title: 'Mesa 1',
        template: 'blank',
        created: 0,
      },
      ...(data.worktables || []),
    ],
    [data.worktables, project],
  );
  const available = new Set(allBoards.map((board) => board.id));
  const openBoards = allBoards.filter((board) => openIds.includes(board.id));
  const activeBoard =
    openBoards.find((board) => board.id === activeId) || openBoards[0];
  useEffect(() => {
    try {
      localStorage.setItem(
        'fabrica:open-worktables:' + project,
        JSON.stringify(openIds),
      );
      localStorage.setItem('fabrica:active-worktable:' + project, activeId);
    } catch {
      /* Tabs remain usable when storage is unavailable. */
    }
  }, [project, openIds, activeId]);
  function openBoard(id: string) {
    if (!available.has(id)) return;
    setOpenIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setActiveId(id);
    setShowBoards(false);
  }
  function closeBoard(id: string) {
    const next = openIds.filter((entry) => entry !== id);
    setOpenIds(next);
    if (activeId === id) setActiveId(next[0] || '');
  }
  async function createBoard(template: (typeof worktableTemplates)[number]) {
    setShowTemplates(false);
    try {
      const title =
        template.id === 'blank'
          ? `Mesa de trabajo ${(data.worktables || []).length + 1}`
          : template.title;
      const created = await run<{ ok: boolean; id: string }>({
        action: 'create-worktable',
        title,
        template: template.id,
      });
      setOpenIds((current) => [...current, created.id]);
      setActiveId(created.id);
    } catch {
      /* Workspace handles the error. */
    }
  }
  const activeBoardId = activeBoard?.id;
  const visibleData = useMemo(() => {
    if (!activeBoardId) return data;
    const inspiration = data.inspiration.filter(
      (item) => (item.worktable || 'default') === activeBoardId,
    );
    const ids = new Set(inspiration.map((item) => item.id));
    return {
      ...data,
      inspiration,
      inspirationComments: data.inspirationComments.filter((comment) =>
        comment.inspiration ? ids.has(comment.inspiration) : comment.worktable === activeBoardId,
      ),
    };
  }, [data, activeBoardId]);
  return (
    <div className="worktables-layout">
      <div className="worktables-bar">
        <span className="worktables-heading">Mesas de trabajo</span>
        <div
          className="worktables-tabs"
          role="tablist"
          aria-label="Mesas de trabajo"
        >
          {openBoards.map((board) => (
            <div className="worktables-tab" key={board.id}>
              <button
                type="button"
                role="tab"
                aria-selected={activeBoard?.id === board.id}
                onClick={() => openBoard(board.id)}
                title={board.title}
              >
                {board.title}
              </button>
              <button
                type="button"
                className="worktables-close"
                aria-label={`Cerrar ${board.title}`}
                onClick={() => closeBoard(board.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="worktables-menu-wrap">
          <button
            type="button"
            className="worktables-menu-button"
            aria-expanded={showBoards}
            onClick={() => {
              setShowBoards(!showBoards);
              setShowTemplates(false);
            }}
          >
            Abrir mesa
          </button>
          {showBoards && (
            <div className="worktables-menu">
              {allBoards
                .filter((board) => !openIds.includes(board.id))
                .map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => openBoard(board.id)}
                  >
                    {board.title}
                  </button>
                ))}
              {allBoards.every((board) => openIds.includes(board.id)) && (
                <span>Ya están todas abiertas</span>
              )}
            </div>
          )}
        </div>
        {data.viewer.permissions.inspiracion === 'edit' && (
          <div className="worktables-menu-wrap">
            <button
              type="button"
              className="worktables-add"
              disabled={busy}
              aria-expanded={showTemplates}
              onClick={() => {
                setShowTemplates(!showTemplates);
                setShowBoards(false);
              }}
            >
              <Plus size={16} /> Nueva mesa
            </button>
            {showTemplates && (
              <div className="worktables-menu worktables-template-menu">
                {worktableTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => void createBoard(template)}
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {activeBoard ? (
        <WorktableCanvas
          key={activeBoard.id}
          {...props}
          data={visibleData}
          board={activeBoard.id === 'default' ? null : activeBoard}
        />
      ) : (
        <div className="worktables-empty">
          Abrí una mesa de trabajo o creá una nueva.
        </div>
      )}
    </div>
  );
}
