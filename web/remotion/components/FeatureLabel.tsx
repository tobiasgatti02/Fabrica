import { interpolate, useCurrentFrame } from 'remotion';

export function FeatureLabel({ children, left, top, delay = 0 }: { children: React.ReactNode; left: number; top: number; delay?: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', left, top, opacity, color: '#c7c7c7', font: '500 16px/1.2 ui-sans-serif, system-ui, sans-serif', letterSpacing: '.01em' }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 8, background: '#fff', marginRight: 10, verticalAlign: 2 }} />{children}</div>;
}