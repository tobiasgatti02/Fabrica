import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export function Cursor({ from = [420, 720], to = [1330, 320], delay = 0 }: { from?: [number, number]; to?: [number, number]; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 22, stiffness: 70, mass: .7 } });
  const x = interpolate(progress, [0, 1], [from[0], to[0]]);
  const y = interpolate(progress, [0, 1], [from[1], to[1]]);
  const click = frame > delay + 34 ? 1 : 0;
  return <div style={{ position: 'absolute', left: x, top: y, width: 22, height: 28, zIndex: 5, transform: `rotate(-12deg) scale(${1 - click * .08})`, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.7))' }}>
    <svg viewBox="0 0 22 28" width="22" height="28"><path d="M2 2l3 22 5-7 7 7 3-3-7-7 8-2L2 2z" fill="#fff" stroke="#111" strokeWidth="1.5" /></svg>
    {click ? <i style={{ position: 'absolute', left: -10, top: -8, width: 40, height: 40, border: '1px solid rgba(255,255,255,.6)', borderRadius: 40, opacity: .75 }} /> : null}
  </div>;
}