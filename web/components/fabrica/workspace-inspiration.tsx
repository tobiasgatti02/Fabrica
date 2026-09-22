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
  ArrowRight,
  ArrowUpRight,
  Circle,
  Eraser,
  FileText,
  GripHorizontal,
  Hand,
  ImagePlus,
  Search,
  X,
  Keyboard,
  Trash2,
  Pencil,
  Link2,
  LoaderCircle,
  MessageCircle,
  Minus,
  MousePointer2,
  PencilLine,
  Plus,
  Redo2,
  Scan,
  Square,
  StickyNote,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { InspirationCanvas } from './inspiration-canvas';
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
  categoryLabels,
  createImagePreview,
  shortDate,
  uploadWorkspaceAsset,
  type WorkspaceAsset,
  type WorkspaceInspiration,
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

type Camera = Point & { zoom: number };
type Draft = {
  title: string;
  note?: string;
  url?: string;
  asset?: string;
  file?: File;
  category?: string;
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
type CanvasGesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  kind: 'canvas';
  element: CanvasElement;
  before: BoardSnapshot;
  targets: BoardBounds[];
};
type Gesture = PanGesture | CardGesture | CanvasGesture;
type BoardContextMenu = {
  x: number;
  y: number;
  point: Point;
  card?: string;
  isPostIt: boolean;
};
type CanvasTool =
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'draw'
  | 'erase';
type ActiveCanvasElement = {
  pointer: number;
  type: Exclude<CanvasTool, 'select' | 'erase'>;
  start: Point;
  points: Point[];
  targets: BoardBounds[];
};
type CanvasPreview = { element: CanvasElement; guides: AlignmentGuide[] };
const initialCamera = { x: 60, y: 90, zoom: 1 };
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
}: {
  count: number;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inspiration-comment-bubble"
      aria-label={`Ver comentarios de ${title}. ${count} comentarios.`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <MessageCircle size={15} /> <span>{count}</span>
    </button>
  );
}

function Media({
  asset,
  project,
  share,
  invite,
  fullFrame = false,
}: {
  asset: WorkspaceAsset;
  project: string;
  share: string;
  invite?: string;
  fullFrame?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [photoSize, setPhotoSize] = useState({ width: 300, height: 200 });
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
      {image && !failed ? (
        <>
          {!loaded && (
            <div className="inspiration-media-loading">
              <LoaderCircle size={20} className="inspiration-spin" />
              <span>Cargando imagen…</span>
            </div>
          )}
          {near && (
            <Image
              src={source}
              alt={asset.name}
              width={600}
              height={400}
              unoptimized
              loading="lazy"
              draggable={false}
              onLoad={(event) => {
                setLoaded(true);
                if (fullFrame) {
                  const ratio =
                    event.currentTarget.naturalWidth /
                    event.currentTarget.naturalHeight;
                  if (Number.isFinite(ratio) && ratio > 0) {
                    const width = Math.min(320, Math.max(180, 420 * ratio));
                    setPhotoSize({
                      width,
                      height: Math.min(420, width / ratio),
                    });
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
  commentCount,
  onDrag,
  onSelect,
  onComments,
}: {
  item: WorkspaceInspiration;
  asset: WorkspaceAsset;
  project: string;
  share: string;
  invite: string;
  selected: boolean;
  commentCount: number;
  onDrag: (event: PointerEvent<HTMLElement>, id: string) => void;
  onSelect: (id: string) => void;
  onComments: () => void;
}) {
  return (
    <div className="inspiration-photo-frame">
      <Media
        key={asset.id}
        asset={asset}
        project={project}
        share={share}
        invite={invite}
        fullFrame
      />
      <button
        className="inspiration-drag-handle inspiration-photo-handle"
        aria-label={'Seleccionar y mover ' + item.title}
        aria-pressed={selected}
        onPointerDown={(event) => onDrag(event, item.id)}
        onClick={() => onSelect(item.id)}
      >
        <GripHorizontal size={19} />
      </button>
      <CommentBubble
        count={commentCount}
        title={item.title}
        onClick={onComments}
      />
      <div className="inspiration-photo-details">
        {item.note && <p className="inspiration-note-text">{item.note}</p>}
        <div className="inspiration-photo-meta">
          {shortDate(item.created)} · Por {item.author} ·{' '}
          {formatBytes(asset.size)}
        </div>
        <div className="inspiration-photo-actions">
          <a
            href={assetUrl(asset.id, project, share, invite)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir foto <ArrowUpRight size={15} />
          </a>
          {safeReferenceUrl(item.url) && (
            <a
              href={safeReferenceUrl(item.url) || undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Referencia <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Inspiration({
  data,
  project,
  share,
  invite,
  busy,
  run,
  notify,
}: WorkspaceViewProps) {
  const canEdit = data.viewer.permissions.inspiracion === 'edit';
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [help, setHelp] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [positionsReady, setPositionsReady] = useState(false);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<BoardContextMenu | null>(null);
  const [tool, setTool] = useState<CanvasTool>('select');
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
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<
    string | null
  >(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasDraft, setCanvasDraft] = useState<CanvasElement | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [itemCategory, setItemCategory] = useState('general');
  const viewport = useRef<HTMLDivElement>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());
  const fileInput = useRef<HTMLInputElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activeCanvasElement = useRef<ActiveCanvasElement | null>(null);
  const previewFrame = useRef<number | null>(null);
  const queuedPreview = useRef<CanvasPreview | null>(null);
  const moveFrame = useRef<number | null>(null);
  const queuedCanvasMove = useRef<CanvasElement | null>(null);
  const insertion = useRef<Point>({ x: 40, y: 50 });
  const queue = useRef(Promise.resolve());
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const deleting = useRef(false);
  const operations = useRef({ run, notify });
  useEffect(() => {
    operations.current = { run, notify };
  }, [run, notify]);
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
      setPositionsReady(true);
      dispatchCanvas({
        type: 'reset',
        elements: readCanvasElements(project),
        positions: readPositions(project),
      });
      setCanvasReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [project]);
  const saveLocal = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!positionsReady || !canvasReady) return;
    const persist = () => {
      try {
        localStorage.setItem(
          'fabrica:inspiration:' + project,
          JSON.stringify(positions),
        );
        localStorage.setItem(
          'fabrica:inspiration-elements:' + project,
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
    project,
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
  const items = useMemo(
    () =>
      data.inspiration.filter(
        (item) =>
          (category === 'all' || item.category === category) &&
          (!search.trim() ||
            `${item.title} ${item.note}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase())),
      ),
    [data.inspiration, category, search],
  );
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
      const comments = groups.get(comment.inspiration) || [];
      comments.push(comment);
      groups.set(comment.inspiration, comments);
    });
    return groups;
  }, [inspirationComments]);
  const selectedComments = commentTarget
    ? commentsByItem.get(commentTarget) || []
    : [];
  const commentItem = commentTarget
    ? data.inspiration.find((item) => item.id === commentTarget)
    : undefined;
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
    const observer = new ResizeObserver(([entry]) =>
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
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

  function focusBoard() {
    viewport.current?.focus({ preventScroll: true });
  }

  function selectCard(id: string | null) {
    setSelected(id);
    setSelectedCanvasElement(null);
  }

  function selectCanvasElement(id: string | null) {
    setSelectedCanvasElement(id);
    setSelected(null);
  }

  function chooseTool(next: CanvasTool) {
    setTool(next);
    setHand(false);
    setContextMenu(null);
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
    const style = { stroke, weight: strokeWeight, style: strokeStyle };
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
    if (!canEdit || busy) return;
    const element = markAt(point);
    if (!element) return;
    dispatchCanvas({ type: 'remove', id: element.id });
    setSelectedCanvasElement((current) =>
      current === element.id ? null : current,
    );
    setAlignmentGuides([]);
  }

  function beginCanvasElement(event: PointerEvent<HTMLDivElement>) {
    if (canvasElements.length >= MAX_ELEMENTS) {
      notify('El lienzo alcanzó el límite de 10.000 dibujos.');
      return false;
    }
    if (!canEdit || tool === 'select' || hand || space || event.button !== 0)
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
      type: tool,
      start: point,
      points: [point],
      targets:
        tool === 'rectangle' || tool === 'circle' ? alignmentTargets() : [],
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
            points: simplifyStroke(preview.element.points, 0.8 / camera.zoom),
          }
        : preview.element;
    const bounds = boundsForCanvasElement(element);
    const size = Math.max(
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    );
    if (size > 8 && (active.type !== 'draw' || active.points.length > 1)) {
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
    if (!commentTarget || !commentText.trim() || busy) return;
    void run({
      action: 'add-inspiration-comment',
      inspiration: commentTarget,
      text: commentText.trim(),
    })
      .then(() => setCommentText(''))
      // `run` already displays the API error. Catching here prevents the
      // browser overlay from treating a rejected request as unhandled.
      .catch(() => {});
  }

  function upload(entry: Pending) {
    queue.current = queue.current.then(async () => {
      if (!mounted.current) return;
      let retryDraft = entry.draft;
      try {
        const draft = entry.draft;
        let asset = draft.asset || '';
        if (draft.file) {
          const validationError = inspirationFileError(draft.file);
          if (validationError) throw new Error(validationError);
          const optimized =
            (await createImagePreview(draft.file)) || draft.file;
          asset = await uploadWorkspaceAsset(
            optimized,
            project,
            share,
            invite,
            'inspiration',
          );
          // Retain the uploaded asset on retry; never upload it twice.
          retryDraft = { ...draft, file: undefined, asset };
        }
        const result = await operations.current.run<{
          ok: boolean;
          id: string;
        }>({
          action: 'add-inspiration',
          title: draft.title.slice(0, 160),
          note: draft.note || '',
          url: draft.url || '',
          asset,
          category: draft.category || 'general',
        });
        if (!mounted.current) return;
        setPositions((current) => ({ ...current, [result.id]: entry.point }));
        selectCard(result.id);
        setPending((current) => current.filter((item) => item.id !== entry.id));
        if (entry.preview) {
          URL.revokeObjectURL(entry.preview);
          urls.current.delete(entry.preview);
        }
      } catch (error) {
        const message = (error as Error).message;
        showErrorToast(message, 'No pudimos subir el archivo');
        if (mounted.current)
          setPending((current) =>
            current.map((item) =>
              item.id === entry.id
                ? {
                    ...entry,
                    draft: retryDraft,
                    error: message,
                  }
                : item,
            ),
          );
      }
    });
  }

  function addDrafts(drafts: Draft[], point = insertion.current) {
    if (!canEdit || !drafts.length) return;
    const acceptedDrafts = drafts.filter((draft) => {
      if (!draft.file) return true;
      const validationError = inspirationFileError(draft.file);
      if (!validationError) return true;
      showErrorToast(validationError, 'Archivo no aceptado');
      return false;
    });
    if (!acceptedDrafts.length) return;
    setCategory('all');
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
    setPending((current) => [...current, ...entries]);
    entries.forEach(upload);
    insertion.current = { x: point.x + 35, y: point.y + 35 };
    focusBoard();
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
    insertion.current = point;
    setContextMenu(null);
    openForm();
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    receive(event.dataTransfer, worldPoint(event.clientX, event.clientY));
  }

  function zoomAt(value: number, point?: Point) {
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
      if (editableTarget(event.target)) return;
      event.preventDefault();
      const bounds = node.getBoundingClientRect();
      const factor =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? node.clientHeight
            : 1;
      setCamera((current) => {
        if (event.ctrlKey || event.metaKey) {
          const zoom = Math.min(
            4,
            Math.max(
              0.05,
              current.zoom * Math.exp(-event.deltaY * factor * 0.008),
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
    if (event.button !== 0 && event.button !== 1) return;
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
    if (panning) {
      selectCard(null);
      gesture.current = {
        kind: 'pan',
        pointer: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        camera,
      };
    } else {
      selectCard(card!);
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
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function startCanvasGesture(
    event: PointerEvent<HTMLDivElement>,
    element: CanvasElement,
  ) {
    if (event.button !== 0 || hand || space || tool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    focusBoard();
    insertion.current = worldPoint(event.clientX, event.clientY);
    selectCanvasElement(element.id);
    if (!canEdit) return;
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

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const x = event.clientX - active.start.x,
      y = event.clientY - active.start.y;
    if (active.kind === 'card') {
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
    } else
      setCamera({
        ...active.camera,
        x: active.camera.x + x,
        y: active.camera.y + y,
      });
  }
  function endGesture() {
    const active = gesture.current;
    if (active?.kind === 'canvas' || active?.kind === 'card') {
      if (active.kind === 'canvas') flushCanvasMove();
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
    if (!canEdit || busy || deleting.current) return;
    deleting.current = true;
    void run({ action: 'delete-inspiration', id })
      .then(() => setSelected((current) => (current === id ? null : current)))
      .catch(() => {})
      .finally(() => {
        deleting.current = false;
      });
  }

  function deleteSelected() {
    if (!canEdit || busy) return;
    if (selected) {
      deleteInspiration(selected);
      return;
    }
    if (selectedCanvasElement) {
      dispatchCanvas({ type: 'remove', id: selectedCanvasElement });
      setSelectedCanvasElement(null);
    }
  }

  function openForm(item?: WorkspaceInspiration) {
    setEditing(item?.id || null);
    setTitle(item?.title || '');
    setNote(item?.note || '');
    setUrl(item?.url || '');
    setItemCategory(item?.category || 'general');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    focusBoard();
  }

  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    if (url.trim() && !safeReferenceUrl(url.trim())) {
      notify('Usá un enlace http o https sin credenciales.');
      return;
    }
    if (editing) {
      void run({
        action: 'edit-inspiration',
        id: editing,
        title: title.trim(),
        note,
        url,
        category: itemCategory,
      })
        .then(closeForm)
        .catch(() => {});
    } else {
      addDrafts([
        { title: title.trim() || 'Nota', note, url, category: itemCategory },
      ]);
      closeForm();
    }
  }
  const selectedItem = data.inspiration.find((item) => item.id === selected);

  return (
    <div className="workspace-content inspiration-page">
      <section className="workspace-section inspiration-board-section">
        <div className="inspiration-command-bar">
          <div className="inspiration-board-title">
            <h1>Inspiración</h1>
            <span>{data.inspiration.length} referencias</span>
          </div>
          <div className="inspiration-command-actions">
            <label className="inspiration-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Buscar referencias"
                placeholder="Buscar referencias"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {canEdit && (
              <button className="workspace-primary" onClick={() => openForm()}>
                <Plus size={16} /> Nueva idea
              </button>
            )}
          </div>
        </div>
        <div
          className="workspace-filter-row"
          aria-label="Categorías de referencias"
        >
          <button
            aria-pressed={category === 'all'}
            className={category === 'all' ? 'active' : ''}
            onClick={() => setCategory('all')}
          >
            Todas <span>{data.inspiration.length}</span>
          </button>
          {Object.entries(categoryLabels)
            .filter(([key]) => key !== 'general')
            .map(([key, label]) => {
              const count = data.inspiration.filter(
                (item) => item.category === key,
              ).length;
              return count ? (
                <button
                  key={key}
                  aria-pressed={category === key}
                  className={category === key ? 'active' : ''}
                  onClick={() => setCategory(key)}
                >
                  {label} <span>{count}</span>
                </button>
              ) : null;
            })}
        </div>
        <div className="inspiration-canvas-wrap">
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
                setHand(false);
                setTool('select');
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
                  title="Agregar flecha"
                  aria-label="Agregar flecha"
                  aria-pressed={tool === 'arrow'}
                  onClick={() => chooseTool('arrow')}
                >
                  <ArrowRight size={19} />
                </button>
                <button
                  title="Dibujar"
                  aria-label="Dibujar"
                  aria-pressed={tool === 'draw'}
                  onClick={() => chooseTool('draw')}
                >
                  <PencilLine size={19} />
                </button>
                <button
                  title="Borrador"
                  aria-label="Borrador"
                  aria-pressed={tool === 'erase'}
                  onClick={() => chooseTool('erase')}
                >
                  <Eraser size={18} />
                </button>
                <span />
                <button
                  title="Crear post-it"
                  aria-label="Crear post-it"
                  onClick={() => openForm()}
                >
                  <StickyNote size={19} />
                </button>
                <button
                  title="Subir archivos"
                  aria-label="Subir archivos"
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadCloud size={19} />
                </button>
              </>
            )}
          </div>
          {canEdit &&
            ['rectangle', 'circle', 'arrow', 'draw'].includes(tool) && (
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
          {(selectedItem || selectedCanvasElement) && canEdit && (
            <div
              className="inspiration-selection-actions"
              role="toolbar"
              aria-label="Acciones de selección"
            >
              <span>{selectedItem?.title || 'Dibujo'}</span>
              {selectedItem && (
                <button
                  aria-label="Editar referencia"
                  title="Editar referencia"
                  onClick={() => openForm(selectedItem)}
                >
                  <Pencil size={16} />
                </button>
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
          <input
            ref={fileInput}
            className="workspace-file-input"
            type="file"
            multiple
            aria-label="Elegir archivos"
            onChange={(event) => {
              addDrafts(
                Array.from(event.target.files || []).map((file) => ({
                  file,
                  title: file.name,
                })),
              );
              event.target.value = '';
            }}
          />
          {/* The canvas is a keyboard-operated application, not a document region. */}
          {/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            ref={viewport}
            className={
              'inspiration-board-shell free-canvas' +
              (hand || space ? ' hand-tool' : '') +
              (tool === 'draw' && !hand && !space ? ' draw-tool' : '') +
              (tool === 'erase' && !hand && !space ? ' erase-tool' : '') +
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
            aria-label="Lienzo de inspiración. Seleccioná y arrastrá tarjetas, figuras, flechas o trazos para moverlos. Pegá imágenes con Control o Command V. Espacio y arrastrar para desplazarte."
            onPaste={paste}
            onCopy={copy}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.inspiration-context-menu')) return;
              setContextMenu(null);
              const card = target.closest<HTMLElement>('[data-card]');
              if (tool === 'erase' && canEdit) {
                event.preventDefault();
                event.stopPropagation();
                // The eraser intentionally affects only board annotations,
                // never project references such as photos or post-its.
                if (!card) eraseAt(worldPoint(event.clientX, event.clientY));
                return;
              }
              const drawingTool =
                tool !== 'select' &&
                tool !== 'erase' &&
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
                  tool === 'select' && !hand && !space
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
            onPointerMove={(event) => {
              if (!updateCanvasElement(event)) moveGesture(event);
            }}
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
                  openForm();
                }
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
                (selected || selectedCanvasElement) &&
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
                if (selected) {
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
            style={{ backgroundPosition: camera.x + 'px ' + camera.y + 'px' }}
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
              </div>
            )}
            <InspirationCanvas
              index={sceneIndex}
              camera={camera}
              size={viewportSize}
              draft={canvasDraft}
              guides={alignmentGuides}
              selected={
                canvasElements.find(
                  (element) => element.id === selectedCanvasElement,
                ) || null
              }
            />
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
              {visibleItems.map(({ item, order: index }) => {
                const point = positionFor(item.id),
                  asset = item.asset ? assetMap.get(item.asset) : undefined;
                const isNote = !item.asset && !item.url;
                const isPhoto =
                  asset && /^image\/(jpeg|png|webp|avif)$/.test(asset.mime);
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
                      (selected === item.id ? ' selected' : '')
                    }
                    style={{ left: point.x, top: point.y }}
                  >
                    {isPhoto ? (
                      <PhotoFrame
                        item={item}
                        asset={asset}
                        project={project}
                        share={share}
                        invite={invite}
                        selected={selected === item.id}
                        commentCount={commentsByItem.get(item.id)?.length || 0}
                        onDrag={startGesture}
                        onSelect={(id) => {
                          selectCard(id);
                          focusBoard();
                        }}
                        onComments={() => {
                          setCommentTarget(item.id);
                          setCommentText('');
                          selectCard(item.id);
                        }}
                      />
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
                            selectCard(item.id);
                            focusBoard();
                          }}
                        >
                          <GripHorizontal size={19} />
                        </button>
                        <CommentBubble
                          count={commentsByItem.get(item.id)?.length || 0}
                          title={item.title}
                          onClick={() => {
                            setCommentTarget(item.id);
                            setCommentText('');
                            selectCard(item.id);
                          }}
                        />
                        {asset ? (
                          <Media
                            key={asset.id}
                            asset={asset}
                            project={project}
                            share={share}
                            invite={invite}
                          />
                        ) : item.url ? (
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
                          <h3>{item.title}</h3>
                          {item.note && (
                            <p className="inspiration-note-text">{item.note}</p>
                          )}
                          {safeReferenceUrl(item.url) && (
                            <a
                              href={safeReferenceUrl(item.url) || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir referencia <ArrowUpRight size={15} />
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
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {pending.map((entry) => (
                <article
                  data-card
                  key={entry.id}
                  className={
                    'inspiration-card inspiration-board-card inspiration-pending' +
                    (entry.preview ? ' inspiration-pending-photo' : '')
                  }
                  style={{ left: entry.point.x, top: entry.point.y }}
                >
                  {entry.preview && (
                    <Image
                      src={entry.preview}
                      alt={entry.draft.title}
                      width={300}
                      height={180}
                      unoptimized
                      draggable={false}
                    />
                  )}
                  {(!entry.preview || entry.error) && (
                    <div className="inspiration-card-body">
                      {!entry.preview && <h3>{entry.draft.title}</h3>}
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
                              upload(entry);
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
                <strong>
                  {search || category !== 'all'
                    ? 'No hay referencias con ese filtro'
                    : 'El proyecto empieza con una idea'}
                </strong>
                <p>
                  {canEdit
                    ? 'Arrastrá imágenes, pegá un enlace o anotá lo que querés explorar.'
                    : 'Las referencias del proyecto aparecerán acá.'}
                </p>
              </div>
            )}
          </div>
          {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div className="inspiration-canvas-footer">
            <div className="inspiration-board-state">
              <span
                role="status"
                className={storageError ? 'storage-error' : ''}
              >
                {storageError
                  ? 'No se pudo guardar la distribución'
                  : dragging
                    ? 'Organizando…'
                    : 'Distribución en este navegador'}
              </span>
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
                  Las referencias y los comentarios se guardan en el proyecto.
                  La distribución y los dibujos se guardan solo en este
                  navegador.
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
                  eliminación de referencias se guardan en el proyecto.
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
                aria-label="Ver todas las referencias"
                title="Ver todo"
                onClick={fitBoard}
              >
                <Scan size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>
      {showForm && (
        <dialog
          className="workspace-modal-backdrop inspiration-dialog"
          aria-label={editing ? 'Editar referencia' : 'Nueva idea'}
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={() => {
            setShowForm(false);
            focusBoard();
          }}
        >
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => {
              setShowForm(false);
              focusBoard();
            }}
          />
          <form className="workspace-modal inspiration-form" onSubmit={save}>
            <p className="workspace-eyebrow">SUMAR AL LIENZO</p>
            <h2>{editing ? 'Editar referencia' : 'Una nueva idea'}</h2>
            <label>
              Título
              <input
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Materiales cálidos"
              />
            </label>
            <label>
              Nota
              <textarea
                rows={5}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Escribí tu idea…"
              />
            </label>
            <label>
              Enlace (opcional)
              <input
                type="url"
                maxLength={2000}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label>
              Categoría
              <select
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value)}
              >
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => {
                  setShowForm(false);
                  focusBoard();
                }}
              >
                Cancelar
              </button>
              <button
                className="workspace-primary"
                disabled={
                  !canEdit ||
                  busy ||
                  (!note.trim() && !url.trim() && !selectedItem?.asset)
                }
              >
                {editing ? 'Guardar cambios' : 'Agregar al lienzo'}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {commentTarget && commentItem && (
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
                    disabled={busy || !commentText.trim()}
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
