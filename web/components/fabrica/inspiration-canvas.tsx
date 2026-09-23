'use client';

import { memo, useLayoutEffect, useRef } from 'react';
import {
  boundsForCanvasElement,
  type AlignmentGuide,
  type CanvasElement,
  type Point,
} from '@/features/workspace/inspiration-board';
import { elementIndex } from '@/features/workspace/inspiration-scene';

function drawElement(ctx: CanvasRenderingContext2D, element: CanvasElement) {
  ctx.globalAlpha = element.opacity ?? 1;
  if (element.type === 'text') {
    ctx.font = '20px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = element.stroke;
    let y = element.y;
    for (const paragraph of element.text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        const next = line + character;
        if (line && ctx.measureText(next).width > element.width) {
          ctx.fillText(line, element.x, y);
          y += 28;
          line = character;
        } else line = next;
      }
      ctx.fillText(line, element.x, y);
      y += 28;
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (element.type === 'frame') {
    ctx.fillStyle = element.fill;
    ctx.fillRect(element.x, element.y, element.width, element.height);
    ctx.strokeStyle = '#c9cdc5';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(element.x + 0.5, element.y + 0.5, element.width - 1, element.height - 1);
    if (element.title) {
      ctx.font = '500 15px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#343a34';
      ctx.fillText(element.title, element.x, element.y - 7, element.width);
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.strokeStyle = element.stroke;
  ctx.lineWidth = element.weight;
  ctx.setLineDash(element.style === 'dashed' ? [10, 7] : []);
  ctx.beginPath();
  if (element.type === 'rectangle')
    ctx.roundRect(
      element.x,
      element.y,
      element.width,
      element.height,
      Math.min(8, element.width / 2, element.height / 2),
    );
  else if (element.type === 'circle')
    ctx.ellipse(
      element.x + element.width / 2,
      element.y + element.height / 2,
      element.width / 2,
      element.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  else if (element.type === 'arrow') {
    const dx = element.endX - element.x;
    const dy = element.endY - element.y;
    const length = Math.hypot(dx, dy);
    const headLength = Math.min(Math.max(10, element.weight * 4), length * 0.45);
    const angle = Math.atan2(dy, dx);
    ctx.moveTo(element.x, element.y);
    ctx.lineTo(element.endX - headLength * Math.cos(angle), element.endY - headLength * Math.sin(angle));
  } else if (element.type === 'stroke') {
    element.points.forEach((point, index) =>
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
  }
  ctx.stroke();
  if (element.type === 'arrow') {
    const angle = Math.atan2(
        element.endY - element.y,
        element.endX - element.x,
      ),
      size = Math.min(Math.max(10, element.weight * 4), Math.hypot(element.endX - element.x, element.endY - element.y) * 0.45);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(element.endX, element.endY);
    ctx.lineTo(
      element.endX - size * Math.cos(angle - 0.45),
      element.endY - size * Math.sin(angle - 0.45),
    );
    ctx.lineTo(
      element.endX - size * Math.cos(angle + 0.45),
      element.endY - size * Math.sin(angle + 0.45),
    );
    ctx.closePath();
    ctx.fillStyle = element.stroke;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** One viewport-sized surface. No permanent animation loop or 5000px backing store. */
export const InspirationCanvas = memo(function InspirationCanvas({
  index,
  camera,
  size,
  draft,
  guides,
  selected,
  editingId,
}: {
  index: ReturnType<typeof elementIndex>;
  camera: Point & { zoom: number };
  size: { width: number; height: number };
  draft: CanvasElement | null;
  guides: AlignmentGuide[];
  selected: CanvasElement[];
  editingId?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lastIndex = useRef(index);
  useLayoutEffect(() => {
    const draw = () => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !size.width || !size.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(size.width * ratio),
        height = Math.round(size.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const bounds = {
        left: -camera.x / camera.zoom,
        top: -camera.y / camera.zoom,
        right: (size.width - camera.x) / camera.zoom,
        bottom: (size.height - camera.y) / camera.zoom,
      };
      const visible = index.search(bounds).sort((a, b) => a.order - b.order);
      canvas.dataset.visibleMarks = String(visible.length);
      // Frames are backgrounds regardless of creation order.
      visible.forEach(({ element }) => { if (element.type === 'frame') drawElement(ctx, element); });
      visible.forEach(({ element }) => { if (element.type !== 'frame' && element.id !== editingId) drawElement(ctx, element); });
      if (draft) drawElement(ctx, draft);
      selected.forEach((selected) => {
        const b = boundsForCanvasElement(selected),
          padding = Math.max(6 / camera.zoom, selected.weight + 3);
        ctx.strokeStyle = '#566b55';
        ctx.fillStyle = '#71856614';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 4 / camera.zoom]);
        ctx.fillRect(
          b.left - padding,
          b.top - padding,
          b.right - b.left + padding * 2,
          b.bottom - b.top + padding * 2,
        );
        ctx.strokeRect(
          b.left - padding,
          b.top - padding,
          b.right - b.left + padding * 2,
          b.bottom - b.top + padding * 2,
        );
      });
      ctx.strokeStyle = '#aa674b';
      ctx.lineWidth = 1 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 5 / camera.zoom]);
      guides.forEach((guide) => {
        ctx.beginPath();
        if (guide.axis === 'x') {
          ctx.moveTo(guide.value, bounds.top);
          ctx.lineTo(guide.value, bounds.bottom);
        } else {
          ctx.moveTo(bounds.left, guide.value);
          ctx.lineTo(bounds.right, guide.value);
        }
        ctx.stroke();
      });
    };
    // New elements paint in the same commit; camera and pointer updates stay
    // coalesced to one draw per display frame.
    if (lastIndex.current !== index) {
      lastIndex.current = index;
      draw();
      return;
    }
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [index, camera, size, draft, guides, selected, editingId]);
  return (
    <canvas
      ref={ref}
      className="inspiration-render-surface"
      aria-hidden="true"
    />
  );
});
