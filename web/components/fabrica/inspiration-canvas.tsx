'use client';

import { memo, useEffect, useRef } from 'react';
import {
  boundsForCanvasElement,
  type AlignmentGuide,
  type CanvasElement,
  type Point,
} from '@/features/workspace/inspiration-board';
import { elementIndex } from '@/features/workspace/inspiration-scene';

function drawElement(ctx: CanvasRenderingContext2D, element: CanvasElement) {
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
    ctx.moveTo(element.x, element.y);
    ctx.lineTo(element.endX, element.endY);
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
      size = Math.max(10, element.weight * 4);
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
}

/** One viewport-sized surface. No permanent animation loop or 5000px backing store. */
export const InspirationCanvas = memo(function InspirationCanvas({
  index,
  camera,
  size,
  draft,
  guides,
  selected,
}: {
  index: ReturnType<typeof elementIndex>;
  camera: Point & { zoom: number };
  size: { width: number; height: number };
  draft: CanvasElement | null;
  guides: AlignmentGuide[];
  selected: CanvasElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
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
      visible.forEach(({ element }) => drawElement(ctx, element));
      if (draft) drawElement(ctx, draft);
      if (selected) {
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
      }
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
    });
    return () => cancelAnimationFrame(frame);
  }, [index, camera, size, draft, guides, selected]);
  return (
    <canvas
      ref={ref}
      className="inspiration-render-surface"
      aria-hidden="true"
    />
  );
});
