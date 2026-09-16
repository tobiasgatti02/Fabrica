import { interpolate, useCurrentFrame } from 'remotion';

export function LogoReveal({ compact = false }: { compact?: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18, 42, 58], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, 28], [.96, 1], { extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity, transform: `scale(${scale})`, color: '#f5f5f5', font: `${compact ? 25 : 76}px/1 ui-sans-serif, system-ui, sans-serif`, letterSpacing: '-.055em', fontWeight: 600 }}>fabrica<span style={{ fontSize: '.32em', verticalAlign: 'top', marginLeft: 4 }}>®</span></div>;
}