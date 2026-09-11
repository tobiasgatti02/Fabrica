import { clamp, range } from '../timeline';
type Vec3 = [number, number, number];
type Shot = { at: number; position: Vec3; target: Vec3; fov: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Monotone Hermite interpolation keeps velocity continuous between shots without
// overshooting the doorway, the floor, or the lintel as a free spline can do.
function sample(shots: Shot[], index: number, p: number, value: (shot: Shot) => number) {
  const a = shots[index], b = shots[index + 1];
  const span = b.at - a.at;
  const slope = (value(b) - value(a)) / span;
  const tangent = (i: number) => {
    if (i === 0 || i === shots.length - 1) return 0;
    const prev = (value(shots[i]) - value(shots[i - 1])) / (shots[i].at - shots[i - 1].at);
    const next = (value(shots[i + 1]) - value(shots[i])) / (shots[i + 1].at - shots[i].at);
    return prev * next <= 0 ? 0 : 2 * prev * next / (prev + next);
  };
  const t = clamp((p - a.at) / span), t2 = t * t, t3 = t2 * t;
  if (slope === 0) return value(a);
  return (2 * t3 - 3 * t2 + 1) * value(a) + (t3 - 2 * t2 + t) * span * tangent(index)
    + (-2 * t3 + 3 * t2) * value(b) + (t3 - t2) * span * tangent(index + 1);
}

function shotsFor(mobile: boolean): Shot[] {
  const framing = mobile ? 1.48 : 1;
  const exterior = (position: Vec3): Vec3 => [position[0] * framing, position[1] + (mobile ? 2 : 0), position[2] * framing];
  const target = (y: number): Vec3 => mobile ? [.3, y + 3.5, 0] : [-2.5, y, 0];
  return [
    { at: 0, position: exterior([13, 10, 18]), target: target(.7), fov: mobile ? 45 : 39 },
    { at: .12, position: exterior([12, 8.8, 17.5]), target: target(.5), fov: mobile ? 45 : 39 },
    { at: .27, position: exterior([10.4, 8, 17]), target: target(1.3), fov: mobile ? 45 : 40 },
    { at: .43, position: exterior([8.2, 9, 16.5]), target: target(2.1), fov: mobile ? 46 : 41 },
    { at: .55, position: exterior([5.9, 8.4, 16.5]), target: target(2.4), fov: mobile ? 46 : 41 },
    { at: .68, position: exterior([3.4, 6.5, 16]), target: target(1.4), fov: mobile ? 45 : 39 },
    { at: .76, position: exterior([1.8, 4.6, 14]), target: target(1), fov: mobile ? 45 : 40 },
    { at: .85, position: [.18, 2.5, 8.8], target: [0, 1.6, -1.5], fov: mobile ? 60 : 54 },
    { at: .92, position: [.03, 1.76, 4.4], target: [.04, 1.52, -2.8], fov: mobile ? 75 : 69 },
    { at: 1, position: [.03, 1.76, 1.30], target: [.04, 1.52, -2.8], fov: mobile ? 78 : 72 },
  ];
}
const desktopShots = shotsFor(false), mobileShots = shotsFor(true);
export function cameraPose(progress: number, mobile: boolean, reduced = false) {
  const p = clamp(progress), shots = mobile ? mobileShots : desktopShots;
  if (reduced) return p >= .965 ? shots[shots.length - 1] : shots[0];
  const index = Math.min(shots.length - 2, Math.max(0, shots.findIndex(shot => shot.at > p) - 1));
  const segment = p === 1 ? shots.length - 2 : index;
  const vector = (key: 'position' | 'target'): Vec3 => [0, 1, 2].map(axis => sample(shots, segment, p, shot => shot[key][axis])) as Vec3;
  return { position: vector('position'), target: vector('target'), fov: sample(shots, segment, p, shot => shot.fov) };
}

// Preserve the authored order, leaving the final quarter for the approach inside.
export const constructionProgress = (progress: number) => clamp(progress / .9);
export function assemblyPose(progress: number, start: number, end: number, lift: number, reduced = false) {
  if (reduced) return { offset: 0, opacity: Number(progress >= end) };
  const t = clamp((progress - start) / (end - start));
  const fall = t * t * t * (t * (t * 6 - 15) + 10);
  const height = Math.max(5, Math.abs(lift) * 5.5);
  return { offset: (1 - fall) * height, opacity: range(t, 0, .22) };
}

// A fast wheel gesture still traverses every stage; frame-rate independent damping
// and a speed ceiling prevent the last metre of the dolly from becoming a cut.
export function advanceProgress(current: number, target: number, delta: number, reduced = false) {
  if (reduced) return target;
  const dt = Math.min(delta, .05);
  const step = (target - current) * (1 - Math.exp(-5 * dt));
  const limit = mix(.22, .13, range(current, .72, .88)) * dt;
  return Math.abs(target - current) < .00001 ? target : current + Math.max(-limit, Math.min(limit, step));
}
