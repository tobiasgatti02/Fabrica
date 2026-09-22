import {
  boundsForCanvasElement,
  type BoardBounds,
  type CanvasElement,
  type Point,
} from './inspiration-board';

export const MAX_ELEMENTS = 10_000;
export const MAX_STROKE_POINTS = 4_096;
const MAX_COORDINATE = 1_000_000;
const finiteCoordinate = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MAX_COORDINATE;
export const validPoint = (p: unknown): p is Point =>
  !!p &&
  typeof p === 'object' &&
  finiteCoordinate((p as Point).x) &&
  finiteCoordinate((p as Point).y);

/** Local storage is untrusted too. Copy only known, bounded properties. */
export function parseElements(value: unknown): CanvasElement[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  let pointBudget = 100_000;
  return value.slice(0, MAX_ELEMENTS).flatMap((item): CanvasElement[] => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      !item.id ||
      item.id.length > 100 ||
      ids.has(item.id) ||
      !/^#[0-9a-f]{6}$/i.test(item.stroke) ||
      typeof item.weight !== 'number' ||
      !Number.isFinite(item.weight) ||
      item.weight < 1 ||
      item.weight > 20 ||
      !['solid', 'dashed'].includes(item.style)
    )
      return [];
    const common = {
      id: item.id,
      stroke: item.stroke,
      weight: item.weight,
      style: item.style,
      ...(typeof item.opacity === 'number' && item.opacity >= 0.1 && item.opacity <= 1
        ? { opacity: item.opacity } : {}),
    };
    let element: CanvasElement;
    if (item.type === 'stroke') {
      if (
        !Array.isArray(item.points) ||
        item.points.length < 2 ||
        item.points.length > MAX_STROKE_POINTS ||
        item.points.length > pointBudget ||
        !item.points.every(validPoint)
      )
        return [];
      pointBudget -= item.points.length;
      element = {
        ...common,
        type: 'stroke',
        points: item.points.map((p: Point) => ({ x: p.x, y: p.y })),
      };
    } else if (item.type === 'arrow') {
      if (
        !validPoint({ x: item.x, y: item.y }) ||
        !finiteCoordinate(item.endX) ||
        !finiteCoordinate(item.endY)
      )
        return [];
      element = {
        ...common,
        type: 'arrow',
        x: item.x,
        y: item.y,
        endX: item.endX,
        endY: item.endY,
      };
    } else if (item.type === 'rectangle' || item.type === 'circle' || item.type === 'frame') {
      if (
        !validPoint({ x: item.x, y: item.y }) ||
        !finiteCoordinate(item.width) ||
        !finiteCoordinate(item.height) ||
        item.width <= 0 ||
        item.height <= 0
      )
        return [];
      if (item.type === 'frame' && (
        typeof item.title !== 'string' || item.title.length > 120 ||
        !/^#[0-9a-f]{6}$/i.test(item.fill)
      )) return [];
      element = {
        ...common,
        type: item.type,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        ...(item.type === 'frame' ? { title: item.title, fill: item.fill } : {}),
      };
    } else return [];
    ids.add(item.id);
    return [element];
  });
}

export function safeReferenceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const intersects = (a: BoardBounds, b: BoardBounds) =>
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top;
export function unionBounds(boxes: BoardBounds[]): BoardBounds {
  return boxes.reduce(
    (a, b) => ({
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right),
      bottom: Math.max(a.bottom, b.bottom),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}
type Entry<T> = { bounds: BoardBounds; value: T };
type Node<T> = {
  bounds: BoardBounds;
  entries?: Entry<T>[];
  children?: Node<T>[];
};
/** Balanced bounding-volume tree; rebuild only when geometry changes, never on pan. */
export class SpatialIndex<T> {
  private root: Node<T>;
  constructor(entries: Entry<T>[]) {
    const build = (list: Entry<T>[], depth: number): Node<T> => {
      const bounds = unionBounds(list.map((e) => e.bounds));
      if (list.length <= 16) return { bounds, entries: list };
      const axis = depth % 2 ? 'top' : 'left';
      list.sort((a, b) => a.bounds[axis] - b.bounds[axis]);
      const mid = Math.floor(list.length / 2);
      return {
        bounds,
        children: [
          build(list.slice(0, mid), depth + 1),
          build(list.slice(mid), depth + 1),
        ],
      };
    };
    this.root = build([...entries], 0);
  }
  search(bounds: BoardBounds): T[] {
    const result: T[] = [];
    const visit = (node: Node<T>) => {
      if (!intersects(node.bounds, bounds)) return;
      if (node.entries)
        for (const entry of node.entries) {
          if (intersects(entry.bounds, bounds)) result.push(entry.value);
        }
      else node.children?.forEach(visit);
    };
    visit(this.root);
    return result;
  }
}

export function elementIndex(elements: CanvasElement[]) {
  return new SpatialIndex(
    elements.map((element, order) => {
      const b = boundsForCanvasElement(element),
        pad = element.weight * 5 + 12;
      return {
        value: { element, order },
        bounds: {
          left: b.left - pad,
          top: b.top - pad,
          right: b.right + pad,
          bottom: b.bottom + pad,
        },
      };
    }),
  );
}

/** Iterative Ramer–Douglas–Peucker: no recursive stack overflow on long strokes. */
export function simplifyStroke(points: Point[], tolerance = 1): Point[] {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start],
      b = points[end];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    let farthest = -1,
      distance = tolerance * tolerance;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
          )
        : 0;
      const d = (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep.add(farthest);
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

export type BoardSnapshot = {
  elements: CanvasElement[];
  positions: Record<string, Point>;
};
export type BoardDocument = BoardSnapshot & {
  past: BoardSnapshot[];
  future: BoardSnapshot[];
};
export type BoardAction =
  | {
      type: 'reset';
      elements: CanvasElement[];
      positions: Record<string, Point>;
    }
  | {
      type: 'positions';
      update: (positions: Record<string, Point>) => Record<string, Point>;
      record?: boolean;
    }
  | { type: 'add'; element: CanvasElement }
  | { type: 'update'; element: CanvasElement }
  | { type: 'remove'; id: string }
  | { type: 'replace'; elements: CanvasElement[] }
  | { type: 'commit'; before: BoardSnapshot }
  | { type: 'undo' }
  | { type: 'redo' };
export const emptyBoard: BoardDocument = {
  elements: [],
  positions: {},
  past: [],
  future: [],
};
const snapshot = ({ elements, positions }: BoardSnapshot): BoardSnapshot => ({
  elements,
  positions,
});
export function boardReducer(
  doc: BoardDocument,
  action: BoardAction,
): BoardDocument {
  if (action.type === 'reset')
    return {
      elements: action.elements,
      positions: action.positions,
      past: [],
      future: [],
    };
  if (action.type === 'replace') return { ...doc, elements: action.elements };
  if (action.type === 'undo') {
    const previous = doc.past.at(-1);
    return previous
      ? {
          ...previous,
          past: doc.past.slice(0, -1),
          future: [snapshot(doc), ...doc.future].slice(0, 50),
        }
      : doc;
  }
  if (action.type === 'redo') {
    const next = doc.future[0];
    return next
      ? {
          ...next,
          past: [...doc.past, snapshot(doc)].slice(-50),
          future: doc.future.slice(1),
        }
      : doc;
  }
  if (action.type === 'commit') {
    if (
      doc.elements === action.before.elements &&
      doc.positions === action.before.positions
    )
      return doc;
    return {
      ...doc,
      past: [...doc.past, action.before].slice(-50),
      future: [],
    };
  }
  if (action.type === 'positions') {
    const positions = action.update(doc.positions);
    return {
      ...doc,
      positions,
      ...(action.record
        ? { past: [...doc.past, snapshot(doc)].slice(-50), future: [] }
        : {}),
    };
  }
  if (action.type === 'update') {
    if (!doc.elements.some((element) => element.id === action.element.id)) return doc;
    return {
      ...doc,
      elements: doc.elements.map((element) => element.id === action.element.id ? action.element : element),
      past: [...doc.past, snapshot(doc)].slice(-50),
      future: [],
    };
  }
  const elements =
    action.type === 'add'
      ? [...doc.elements, action.element]
      : doc.elements.filter((e) => e.id !== action.id);
  if (action.type === 'remove' && elements.length === doc.elements.length)
    return doc;
  return {
    ...doc,
    elements,
    past: [...doc.past, snapshot(doc)].slice(-50),
    future: [],
  };
}
