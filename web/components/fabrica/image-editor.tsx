'use client';

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import Image from 'next/image';
import { Highlighter, ImagePlus, MousePointer2, Pencil, Save, Trash2, Type, Undo2, X } from 'lucide-react';

type Point = { x: number; y: number };
type Stroke = { id: string; kind: 'paint' | 'highlight'; points: Point[]; color: string; width: number };
type AddedImage = { id: string; kind: 'image'; src: string; x: number; y: number; width: number; height: number; opacity: number };
type AddedText = { id: string; kind: 'text'; text: string; x: number; y: number; color: string; size: number };
type Item = Stroke | AddedImage | AddedText;
type Tool = 'select' | 'paint' | 'highlight' | 'text';

const colors = ['#cf4f45', '#245b9e', '#376c42', '#252525', '#ffffff'];
const path = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
const filter = (brightness: number, contrast: number, saturation: number) =>
  `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

export function ImageEditor({ title, source, canEdit, onClose, onSave }: {
  title: string; source: string; canEdit: boolean; onClose: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(colors[0]);
  const [weight, setWeight] = useState(5);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageReady, setImageReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const gesture = useRef<{ pointer: number; kind: 'draw'; stroke: Stroke } | {
    pointer: number; kind: 'move'; id: string; start: Point; x: number; y: number;
  } | null>(null);
  const selectedItem = items.find((item) => item.id === selected);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [onClose, saving]);

  function pointAt(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(size.width, (event.clientX - rect.left) * size.width / rect.width)),
      y: Math.max(0, Math.min(size.height, (event.clientY - rect.top) * size.height / rect.height)),
    };
  }
  function updateSelected(update: (item: Item) => Item) {
    setItems((previous) => previous.map((item) => item.id === selected ? update(item) : item));
  }
  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
      setError('Elegí una imagen JPG, PNG, WebP o AVIF de hasta 20 MB.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const src = URL.createObjectURL(file);
      objectUrls.current.push(src);
      const width = Math.min(size.width * .48, bitmap.width);
      const height = width * bitmap.height / bitmap.width;
      bitmap.close();
      const item: AddedImage = { id: crypto.randomUUID(), kind: 'image', src,
        x: (size.width - width) / 2, y: (size.height - height) / 2, width, height, opacity: 1 };
      setItems((previous) => [...previous, item]);
      setSelected(item.id);
      setTool('select');
      setError('');
    } catch { setError('No se pudo abrir esa imagen.'); }
  }
  function addText() {
    const item: AddedText = { id: crypto.randomUUID(), kind: 'text', text: 'Escribí acá',
      x: size.width * .2, y: size.height * .5, color, size: Math.max(24, Math.round(size.width / 25)) };
    setItems((previous) => [...previous, item]);
    setSelected(item.id);
    setTool('select');
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!canEdit || saving || event.button !== 0) return;
    const point = pointAt(event);
    const node = (event.target as Element).closest('[data-editor-id]');
    const id = node?.getAttribute('data-editor-id');
    if (tool === 'select') {
      setSelected(id || null);
      const item = items.find((candidate) => candidate.id === id);
      if (item && (item.kind === 'image' || item.kind === 'text')) {
        gesture.current = { pointer: event.pointerId, kind: 'move', id: item.id, start: point, x: item.x, y: item.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else if (tool === 'text') addText();
    else {
      const stroke: Stroke = { id: crypto.randomUUID(), kind: tool,
        points: [point], color, width: tool === 'highlight' ? weight * 5 : weight };
      gesture.current = { pointer: event.pointerId, kind: 'draw', stroke };
      setDraft(stroke);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    const point = pointAt(event);
    if (current.kind === 'draw') {
      if (current.stroke.points.length >= 4096) return;
      const stroke = { ...current.stroke, points: [...current.stroke.points, point] };
      gesture.current = { ...current, stroke };
      setDraft(stroke);
    } else {
      const dx = point.x - current.start.x, dy = point.y - current.start.y;
      setItems((previous) => previous.map((item) => item.id === current.id &&
        (item.kind === 'image' || item.kind === 'text')
          ? { ...item, x: current.x + dx, y: current.y + dy } : item));
    }
  }
  function pointerUp() {
    const current = gesture.current;
    if (current?.kind === 'draw') {
      const stroke = current.stroke;
      if (stroke.points.length === 1) stroke.points.push({ ...stroke.points[0] });
      setItems((previous) => [...previous, stroke]);
      setDraft(null);
    }
    gesture.current = null;
  }

  async function save() {
    if (!canEdit || saving || !imageReady) return;
    setSaving(true);
    setError('');
    try {
      const output = document.createElement('canvas');
      const scale = Math.min(1, 2400 / Math.max(size.width, size.height));
      output.width = Math.max(1, Math.round(size.width * scale));
      output.height = Math.max(1, Math.round(size.height * scale));
      const ctx = output.getContext('2d');
      if (!ctx) throw new Error('Tu navegador no pudo preparar la imagen.');
      ctx.scale(scale, scale);
      const sources = [source, ...items.filter((item): item is AddedImage => item.kind === 'image').map((item) => item.src)];
      const images = await Promise.all(sources.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo abrir una de las imágenes.');
        return createImageBitmap(await response.blob());
      }));
      try {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.filter = filter(brightness, contrast, saturation);
        ctx.drawImage(images[0], 0, 0, size.width, size.height);
        ctx.filter = 'none';
        let imageIndex = 1;
        for (const item of items) {
          if (item.kind === 'image') {
            ctx.globalAlpha = item.opacity;
            ctx.drawImage(images[imageIndex++], item.x, item.y, item.width, item.height);
            ctx.globalAlpha = 1;
          } else if (item.kind === 'text') {
            ctx.fillStyle = item.color;
            ctx.font = `600 ${item.size}px sans-serif`;
            ctx.textBaseline = 'top';
            item.text.split('\n').forEach((line, index) => ctx.fillText(line, item.x, item.y + index * item.size * 1.2));
          } else {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = item.kind === 'highlight' ? .35 : 1;
            ctx.beginPath();
            item.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      } finally { images.forEach((image) => image.close()); }
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/webp', .88));
      if (!blob) throw new Error('No se pudo generar la imagen editada.');
      await onSave(new File([blob], `${title.replace(/\.[^.]+$/, '')}-editada.webp`, { type: 'image/webp' }));
      onClose();
    } catch (cause) { setError((cause as Error).message || 'No se pudo guardar la imagen.'); }
    finally { setSaving(false); }
  }

  return <dialog open className="image-editor" aria-modal="true" aria-label={`Editar ${title}`}>
    <header className="image-editor-header">
      <div><strong>Editar imagen</strong><span>{title}</span></div>
      <div>{canEdit && <button type="button" className="image-editor-save" disabled={saving || !imageReady} onClick={save}>
        <Save size={17} /> {saving ? 'Guardando…' : 'Guardar imagen'}</button>}
        <button type="button" aria-label="Cerrar editor" disabled={saving} onClick={onClose}><X size={20} /></button></div>
    </header>
    <div className="image-editor-layout">
      <div className="image-editor-stage">
        <div className="image-editor-sheet">
          <Image src={source} alt={title} width={1200} height={800} unoptimized draggable={false}
            style={{ filter: filter(brightness, contrast, saturation) }}
            onLoad={(event) => {
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
              setImageReady(true);
            }} onError={() => setError('No se pudo abrir la imagen original.')} />
          <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none"
            className={'image-editor-surface' + (!canEdit ? ' readonly' : '')}
            aria-label="Edición de imagen" onPointerDown={pointerDown} onPointerMove={pointerMove}
            onPointerUp={pointerUp} onPointerCancel={pointerUp}>
            {items.map((item) => item.kind === 'image' ?
              <image key={item.id} data-editor-id={item.id} href={item.src}
                x={item.x} y={item.y} width={item.width} height={item.height} opacity={item.opacity}
                preserveAspectRatio="none" /> : item.kind === 'text' ?
              <text key={item.id} data-editor-id={item.id} x={item.x} y={item.y}
                fill={item.color} fontSize={item.size} fontWeight="600" dominantBaseline="text-before-edge">
                {item.text.split('\n').map((line, index) => <tspan key={index} x={item.x} dy={index ? item.size * 1.2 : 0}>{line}</tspan>)}
              </text> :
              <polyline key={item.id} data-editor-id={item.id} points={path(item.points)} fill="none"
                stroke={item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round"
                opacity={item.kind === 'highlight' ? .35 : 1} />)}
            {draft && <polyline points={path(draft.points)} fill="none" stroke={draft.color}
              strokeWidth={draft.width} strokeLinecap="round" strokeLinejoin="round"
              opacity={draft.kind === 'highlight' ? .35 : 1} />}
            {selectedItem?.kind === 'image' && <rect x={selectedItem.x} y={selectedItem.y}
              width={selectedItem.width} height={selectedItem.height} fill="none"
              stroke="#ffffff" strokeWidth={Math.max(2, size.width / 400)} strokeDasharray="8 5" pointerEvents="none" />}
          </svg>
        </div>
      </div>
      <aside className="image-editor-panel">
        {canEdit && <>
          <p>Herramientas</p>
          <div className="image-editor-tools">
            {([['select', 'Mover', MousePointer2], ['paint', 'Pintar', Pencil], ['highlight', 'Resaltar', Highlighter], ['text', 'Texto', Type]] as const)
              .map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={tool === id}
                onClick={() => id === 'text' ? addText() : setTool(id)}><Icon size={17} /> {label}</button>)}
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={addImage} />
          <button type="button" className="image-editor-add" onClick={() => fileInput.current?.click()}><ImagePlus size={17} /> Agregar imagen</button>
          <div className="image-editor-colors">{colors.map((value) => <button key={value} type="button"
            aria-label={`Color ${value}`} aria-pressed={color === value} onClick={() => setColor(value)}
            style={{ backgroundColor: value }} />)}</div>
          <label>Grosor <input type="range" min="1" max="20" value={weight}
            onChange={(event) => setWeight(Number(event.target.value))} /> {weight}</label>
          <p>Ajustes de la foto</p>
          {([['Brillo', brightness, setBrightness], ['Contraste', contrast, setContrast], ['Saturación', saturation, setSaturation]] as const)
            .map(([label, value, setValue]) => <label key={label}>{label} <input type="range" min="0" max="200"
              value={value} onChange={(event) => setValue(Number(event.target.value))} /> {value}%</label>)}
          {selectedItem && <div className="image-editor-selection">
            <p>Elemento seleccionado</p>
            {selectedItem.kind === 'text' && <>
              <textarea aria-label="Texto de la imagen" value={selectedItem.text} maxLength={500}
                onChange={(event) => updateSelected((item) => item.kind === 'text' ? { ...item, text: event.target.value } : item)} />
              <label>Tamaño <input type="range" min="12" max="180" value={selectedItem.size}
                onChange={(event) => updateSelected((item) => item.kind === 'text' ? { ...item, size: Number(event.target.value) } : item)} /> {selectedItem.size}</label>
              <label>Color <input type="color" value={selectedItem.color}
                onChange={(event) => updateSelected((item) => item.kind === 'text' ? { ...item, color: event.target.value } : item)} /></label>
            </>}
            {selectedItem.kind === 'image' && <>
              <label>Tamaño <input type="range" min="10" max="150" value={Math.round(selectedItem.width / size.width * 100)}
                onChange={(event) => updateSelected((item) => item.kind === 'image' ? {
                  ...item, width: size.width * Number(event.target.value) / 100,
                  height: item.height * (size.width * Number(event.target.value) / 100) / item.width,
                } : item)} /> {Math.round(selectedItem.width / size.width * 100)}%</label>
              <label>Opacidad <input type="range" min="0" max="100" value={Math.round(selectedItem.opacity * 100)}
                onChange={(event) => updateSelected((item) => item.kind === 'image' ? { ...item, opacity: Number(event.target.value) / 100 } : item)} /> {Math.round(selectedItem.opacity * 100)}%</label>
            </>}
            <button type="button" onClick={() => { setItems((previous) => previous.filter((item) => item.id !== selected)); setSelected(null); }}>
              <Trash2 size={16} /> Eliminar elemento</button>
          </div>}
          <button type="button" className="image-editor-undo" disabled={!items.length}
            onClick={() => { setItems((previous) => previous.slice(0, -1)); setSelected(null); }}><Undo2 size={16} /> Deshacer último elemento</button>
        </>}
        {error && <output className="image-editor-error">{error}</output>}
        <small>Al guardar, esta imagen reemplaza la foto de la tarjeta en el proyecto.</small>
      </aside>
    </div>
  </dialog>;
}
