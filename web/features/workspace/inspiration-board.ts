export type Point = { x: number; y: number };
export type StrokeStyle = 'solid' | 'dashed';
export type CanvasElement =
  | {
      id: string;
      type: 'rectangle' | 'circle';
      x: number;
      y: number;
      width: number;
      height: number;
      stroke: string;
      weight: number;
      style: StrokeStyle;
    }
  | {
      id: string;
      type: 'arrow';
      x: number;
      y: number;
      endX: number;
      endY: number;
      stroke: string;
      weight: number;
      style: StrokeStyle;
    }
  | {
      id: string;
      type: 'stroke';
      points: Point[];
      stroke: string;
      weight: number;
      style: StrokeStyle;
    };
export type BoardBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type AlignmentGuide = { axis: 'x' | 'y'; value: number };
export type Alignment = {
  offset: Point;
  guides: AlignmentGuide[];
};
export const clipboardReferenceType = 'application/x-fabrica-inspiration';

const center = (start: number, end: number) => (start + end) / 2;
const coordinates = (bounds: BoardBounds) => ({
  x: [bounds.left, center(bounds.left, bounds.right), bounds.right],
  y: [bounds.top, center(bounds.top, bounds.bottom), bounds.bottom],
});

export function boundsForCanvasElement(element: CanvasElement): BoardBounds {
  if (element.type === 'stroke') {
    const xs = element.points.map((point) => point.x);
    const ys = element.points.map((point) => point.y);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  }
  if (element.type === 'arrow')
    return {
      left: Math.min(element.x, element.endX),
      right: Math.max(element.x, element.endX),
      top: Math.min(element.y, element.endY),
      bottom: Math.max(element.y, element.endY),
    };
  return {
    left: element.x,
    right: element.x + element.width,
    top: element.y,
    bottom: element.y + element.height,
  };
}

/** Returns a copy of an element shifted by a board-space offset. */
export function translateCanvasElement(
  element: CanvasElement,
  offset: Point,
): CanvasElement {
  if (!offset.x && !offset.y) return element;
  if (element.type === 'stroke')
    return {
      ...element,
      points: element.points.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })),
    };
  if (element.type === 'arrow')
    return {
      ...element,
      x: element.x + offset.x,
      y: element.y + offset.y,
      endX: element.endX + offset.x,
      endY: element.endY + offset.y,
    };
  return { ...element, x: element.x + offset.x, y: element.y + offset.y };
}

/**
 * Returns the closest horizontal and vertical snapping targets. The calculation
 * runs only while an item is actively moved or drawn, so boards stay light even
 * with many references.
 */
export function findAlignment(
  moving: BoardBounds,
  targets: BoardBounds[],
  tolerance = 8,
): Alignment {
  const movingCoordinates = coordinates(moving);
  const best: Record<
    'x' | 'y',
    { distance: number; offset: number; value: number } | null
  > = {
    x: null,
    y: null,
  };
  for (const target of targets) {
    const targetCoordinates = coordinates(target);
    for (const axis of ['x', 'y'] as const) {
      for (const source of movingCoordinates[axis]) {
        for (const value of targetCoordinates[axis]) {
          const offset = value - source;
          const distance = Math.abs(offset);
          if (
            distance > tolerance ||
            distance >= (best[axis]?.distance ?? Infinity)
          )
            continue;
          best[axis] = { distance, offset, value };
        }
      }
    }
  }
  return {
    offset: { x: best.x?.offset || 0, y: best.y?.offset || 0 },
    guides: (['x', 'y'] as const).flatMap((axis) =>
      best[axis] ? [{ axis, value: best[axis].value }] : [],
    ),
  };
}

const distanceToSegment = (point: Point, start: Point, end: Point) => {
  const x = end.x - start.x;
  const y = end.y - start.y;
  const lengthSquared = x * x + y * y;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + x * progress),
    point.y - (start.y + y * progress),
  );
};

/** Finds the top-most canvas mark under an eraser point. */
export function canvasElementAt(
  elements: CanvasElement[],
  point: Point,
  tolerance = 12,
) {
  return [...elements].reverse().find((element) => {
    if (element.type === 'rectangle') {
      const bounds = boundsForCanvasElement(element);
      return (
        point.x >= bounds.left - tolerance &&
        point.x <= bounds.right + tolerance &&
        point.y >= bounds.top - tolerance &&
        point.y <= bounds.bottom + tolerance
      );
    }
    if (element.type === 'circle') {
      const radiusX = element.width / 2 + tolerance;
      const radiusY = element.height / 2 + tolerance;
      if (radiusX <= 0 || radiusY <= 0) return false;
      return ((point.x - element.x - element.width / 2) / radiusX) ** 2 + ((point.y - element.y - element.height / 2) / radiusY) ** 2 <= 1;
    }
    if (element.type === 'arrow')
      return (
        distanceToSegment(
          point,
          { x: element.x, y: element.y },
          {
            x: element.endX,
            y: element.endY,
          },
        ) <=
        tolerance + element.weight / 2
      );
    if (element.type !== 'stroke') return false;
    return element.points.some(
      (segmentPoint, index) =>
        index > 0 &&
        distanceToSegment(point, element.points[index - 1], segmentPoint) <=
          tolerance + element.weight / 2,
    );
  });
}

type BoardContent =
  | { kind: 'files'; files: File[] }
  | { kind: 'reference'; id: string; project: string }
  | { kind: 'link'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' };

function webUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

// ClipboardEvent delivers the actual OS clipboard (including screenshots).
// Files take priority over text/html, which browsers often include alongside them.
export function boardClipboard(
  transfer: Pick<DataTransfer, 'files' | 'items' | 'getData'>,
): BoardContent {
  const files = Array.from(transfer.files || []);
  if (!files.length) {
    for (const item of Array.from(transfer.items || [])) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  if (files.length) return { kind: 'files', files };
  try {
    const ref = JSON.parse(transfer.getData(clipboardReferenceType)) as {
      id?: unknown;
      project?: unknown;
    };
    if (typeof ref.id === 'string' && typeof ref.project === 'string')
      return { kind: 'reference', id: ref.id, project: ref.project };
  } catch {
    /* Most pastes come from outside this board. */
  }
  const text = transfer.getData('text/plain').trim();
  const uri =
    transfer
      .getData('text/uri-list')
      .split(/\r?\n/)
      .find((line) => line.trim() && !line.startsWith('#'))
      ?.trim() || '';
  const url = webUrl(uri || text);
  if (url) return { kind: 'link', url };
  if (text) return { kind: 'text', text: text.slice(0, 2000) };
  return { kind: 'empty' };
}
