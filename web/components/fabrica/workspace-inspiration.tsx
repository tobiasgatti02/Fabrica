'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  FileText,
  GripHorizontal,
  Hand,
  ImagePlus,
  Link2,
  LoaderCircle,
  Minus,
  MousePointer2,
  Plus,
  Scan,
  StickyNote,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import {
  assetUrl,
  categoryLabels,
  createImagePreview,
  inspirationStatusLabels,
  shortDate,
  uploadWorkspaceAsset,
  type WorkspaceAsset,
  type WorkspaceInspiration,
} from '@/features/workspace/client';
import { formatBytes } from '@/features/studio/domain';
import {
  boardClipboard,
  clipboardReferenceType,
  type Point,
} from '@/features/workspace/inspiration-board';

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
type Gesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  card?: string;
  point?: Point;
};
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
      Object.entries(stored).filter(
        ([, point]) =>
          point && Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    );
  } catch {
    return {};
  }
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

function CardControls({
  item,
  canEdit,
  busy,
  run,
}: {
  item: WorkspaceInspiration;
  canEdit: boolean;
  busy: boolean;
  run: WorkspaceViewProps['run'];
}) {
  if (!canEdit) return null;
  return (
    <div className="inspiration-card-controls">
      <select
        aria-label={'Estado de ' + item.title}
        value={item.status}
        disabled={busy}
        onChange={(event) =>
          void run({
            action: 'update-inspiration',
            id: item.id,
            status: event.target.value,
            category: item.category,
          }).catch(() => {})
        }
      >
        {Object.entries(inspirationStatusLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={'Eliminar ' + item.title}
        onClick={() => {
          if (window.confirm('¿Eliminar “' + item.title + '”?'))
            void run({ action: 'delete-inspiration', id: item.id }).catch(
              () => {},
            );
        }}
      >
        <Trash2 size={15} />
      </button>
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
  busy,
  run,
  onDrag,
  onSelect,
}: {
  item: WorkspaceInspiration;
  asset: WorkspaceAsset;
  project: string;
  share: string;
  invite: string;
  selected: boolean;
  canEdit: boolean;
  busy: boolean;
  run: WorkspaceViewProps['run'];
  onDrag: (event: PointerEvent<HTMLElement>, id: string) => void;
  onSelect: (id: string) => void;
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
        <span>Foto</span>
      </button>
      <div className="inspiration-photo-details">
        <h3>{item.title}</h3>
        {item.note && <p className="inspiration-note-text">{item.note}</p>}
        <div className="inspiration-photo-meta">
          {categoryLabels[item.category] || 'General'} ·{' '}
          {shortDate(item.created)}
          {' · '}Por {item.author} · {formatBytes(asset.size)}
        </div>
        <div className="inspiration-photo-actions">
          <a
            href={assetUrl(asset.id, project, share, invite)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir foto <ArrowUpRight size={15} />
          </a>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Referencia <ArrowUpRight size={15} />
            </a>
          )}
          <CardControls item={item} canEdit={canEdit} busy={busy} run={run} />
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
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [positionsReady, setPositionsReady] = useState(false);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [itemCategory, setItemCategory] = useState('general');
  const viewport = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const insertion = useRef<Point>({ x: 40, y: 50 });
  const queue = useRef(Promise.resolve());
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const operations = useRef({ run, notify });
  useEffect(() => {
    operations.current = { run, notify };
  }, [run, notify]);
  useEffect(() => {
    mounted.current = true;
    const previews = urls.current;
    return () => {
      mounted.current = false;
      previews.forEach((value) => URL.revokeObjectURL(value));
      previews.clear();
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPositions(readPositions(project));
      setPositionsReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [project]);
  useEffect(() => {
    if (!positionsReady) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          'fabrica:inspiration:' + project,
          JSON.stringify(positions),
        );
      } catch {
        /* Storage may be unavailable in private mode. */
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [positions, positionsReady, project]);
  const items = useMemo(
    () =>
      data.inspiration.filter(
        (item) => category === 'all' || item.category === category,
      ),
    [data.inspiration, category],
  );
  const assetMap = useMemo(
    () => new Map(data.assets.map((asset) => [asset.id, asset])),
    [data.assets],
  );
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

  function upload(entry: Pending) {
    queue.current = queue.current.then(async () => {
      if (!mounted.current) return;
      let retryDraft = entry.draft;
      try {
        const draft = entry.draft;
        let asset = draft.asset || '';
        if (draft.file) {
          if (!draft.file.size) throw new Error('El archivo está vacío.');
          const limit = (data.viewer.guest ? 20 : 500) * 1024 * 1024;
          if (draft.file.size > limit)
            throw new Error(
              'El archivo supera el límite de ' +
                (data.viewer.guest ? '20' : '500') +
                ' MB.',
            );
          const optimized =
            (await createImagePreview(draft.file)) || draft.file;
          asset = await uploadWorkspaceAsset(optimized, project, share, invite);
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
        setSelected(result.id);
        setPending((current) => current.filter((item) => item.id !== entry.id));
        if (entry.preview) {
          URL.revokeObjectURL(entry.preview);
          urls.current.delete(entry.preview);
        }
      } catch (error) {
        if (mounted.current)
          setPending((current) =>
            current.map((item) =>
              item.id === entry.id
                ? {
                    ...entry,
                    draft: retryDraft,
                    error: (error as Error).message,
                  }
                : item,
            ),
          );
      }
    });
  }

  function addDrafts(drafts: Draft[], point = insertion.current) {
    if (!canEdit || !drafts.length) return;
    setCategory('all');
    const entries = drafts.map((draft, index): Pending => {
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
      const zoom = Math.min(2, Math.max(0.05, value));
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
            2,
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
      setSelected(card);
      focusBoard();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusBoard();
    const panning = !card || hand || space || event.button === 1;
    insertion.current = worldPoint(event.clientX, event.clientY);
    setSelected(panning ? null : card!);
    gesture.current = {
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      camera,
      card: panning ? undefined : card,
      point: card ? positionFor(card) : undefined,
    };
    viewport.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const x = event.clientX - active.start.x,
      y = event.clientY - active.start.y;
    if (active.card && active.point) {
      const point = {
        x: active.point.x + x / active.camera.zoom,
        y: active.point.y + y / active.camera.zoom,
      };
      setPositions((current) => ({ ...current, [active.card!]: point }));
    } else
      setCamera({
        ...active.camera,
        x: active.camera.x + x,
        y: active.camera.y + y,
      });
  }
  function endGesture() {
    gesture.current = null;
    setDragging(false);
  }

  function fitBoard() {
    if (!items.length) {
      setCamera(initialCamera);
      return;
    }
    const points = items.map((item) => positionFor(item.id));
    const minX = Math.min(...points.map((point) => point.x)),
      minY = Math.min(...points.map((point) => point.y));
    const width = Math.max(...points.map((point) => point.x)) - minX + 320;
    const height = Math.max(...points.map((point) => point.y)) - minY + 470;
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

  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    addDrafts([
      { title: title.trim() || 'Nota', note, url, category: itemCategory },
    ]);
    setShowForm(false);
    setTitle('');
    setNote('');
    setUrl('');
  }

  return (
    <div className="workspace-content inspiration-page">
      <section className="workspace-section inspiration-board-section">
        <div className="workspace-section-head inspiration-board-head">
          <div>
            <p className="workspace-eyebrow">INSPIRACIÓN COMPARTIDA</p>
            <h2>El lienzo del proyecto</h2>
            <p className="workspace-muted">
              Copiá una imagen, hacé clic en el lienzo y pegala con Ctrl / ⌘ V.
              También podés soltar archivos, enlaces y texto.
            </p>
          </div>
          {canEdit && (
            <button
              className="workspace-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} /> Nueva idea
            </button>
          )}
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
          {Object.entries(categoryLabels).map(([key, label]) => {
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
            aria-label="Herramientas del lienzo"
          >
            <button
              title="Seleccionar"
              aria-label="Seleccionar"
              aria-pressed={!hand}
              onClick={() => {
                setHand(false);
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
                focusBoard();
              }}
            >
              <Hand size={19} />
            </button>
            {canEdit && (
              <>
                <span />
                <button
                  title="Crear post-it"
                  aria-label="Crear post-it"
                  onClick={() => setShowForm(true)}
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
              (dragging ? ' is-dragging' : '')
            }
            tabIndex={0}
            role="application"
            aria-label="Lienzo de inspiración. Pegá imágenes con Control o Command V. Espacio y arrastrar para desplazarte."
            onPaste={paste}
            onCopy={copy}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              const card = target.closest<HTMLElement>('[data-card]');
              if (!card) startGesture(event);
              else if (
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
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onLostPointerCapture={endGesture}
            onBlur={() => {
              setSpace(false);
              endGesture();
            }}
            onKeyDown={(event) => {
              if (
                editableTarget(event.target) ||
                event.target !== event.currentTarget
              )
                return;
              if (event.code === 'Space') {
                event.preventDefault();
                setSpace(true);
              }
              if (event.key === 'Escape') setSelected(null);
              if (event.key.startsWith('Arrow') && selected && canEdit) {
                event.preventDefault();
                const previous = positionFor(selected),
                  delta = event.shiftKey ? 40 : 10;
                setPositions((current) => ({
                  ...current,
                  [selected]: {
                    x:
                      previous.x +
                      (event.key === 'ArrowRight'
                        ? delta
                        : event.key === 'ArrowLeft'
                          ? -delta
                          : 0),
                    y:
                      previous.y +
                      (event.key === 'ArrowDown'
                        ? delta
                        : event.key === 'ArrowUp'
                          ? -delta
                          : 0),
                  },
                }));
              }
            }}
            onKeyUp={(event) => {
              if (event.code === 'Space') setSpace(false);
            }}
            style={{ backgroundPosition: camera.x + 'px ' + camera.y + 'px' }}
          >
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
              {items.map((item, index) => {
                const point = positionFor(item.id),
                  asset = item.asset ? assetMap.get(item.asset) : undefined;
                const isNote = !item.asset && !item.url;
                const isPhoto =
                  asset && /^image\/(jpeg|png|webp|avif)$/.test(asset.mime);
                return (
                  <article
                    data-card={item.id}
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
                        canEdit={canEdit}
                        busy={busy}
                        run={run}
                        onDrag={startGesture}
                        onSelect={(id) => {
                          setSelected(id);
                          focusBoard();
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
                            setSelected(item.id);
                            focusBoard();
                          }}
                        >
                          <GripHorizontal size={19} />
                          <span>
                            {isNote ? 'Post-it' : asset ? 'Archivo' : 'Enlace'}
                          </span>
                        </button>
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
                                {new URL(item.url).hostname.replace(
                                  /^www\./,
                                  '',
                                )}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <div className="inspiration-card-body">
                          <div className="inspiration-card-meta">
                            <span>
                              {categoryLabels[item.category] || 'General'}
                            </span>
                            <span>{shortDate(item.created)}</span>
                          </div>
                          <h3>{item.title}</h3>
                          {item.note && (
                            <p className="inspiration-note-text">{item.note}</p>
                          )}
                          {item.url && (
                            <a
                              href={item.url}
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
                          <div className="inspiration-card-footer">
                            <span>Por {item.author}</span>
                            <CardControls
                              item={item}
                              canEdit={canEdit}
                              busy={busy}
                              run={run}
                            />
                          </div>
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
                  <div className="inspiration-card-body">
                    <h3>{entry.draft.title}</h3>
                    <output>
                      {entry.error || (
                        <>
                          <LoaderCircle
                            size={16}
                            className="inspiration-spin"
                          />{' '}
                          Preparando y guardando…
                        </>
                      )}
                    </output>
                    {entry.error && (
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
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!items.length && !pending.length && (
              <div className="inspiration-canvas-empty">
                <ImagePlus size={32} />
                <strong>Un lugar para todas tus ideas</strong>
                <p>
                  {canEdit
                    ? 'Hacé clic acá y pegá una imagen con Ctrl / ⌘ V, arrastrá archivos o creá un post-it.'
                    : 'Las referencias del proyecto aparecerán acá.'}
                </p>
              </div>
            )}
          </div>
          {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div className="inspiration-canvas-footer">
            <span>
              Espacio + arrastrar para mover · Ctrl / ⌘ + rueda para zoom
            </span>
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
          aria-label="Nueva idea"
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
            <h2>Una nueva idea</h2>
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
                disabled={!canEdit || (!note.trim() && !url.trim())}
              >
                Agregar al lienzo
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
