import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { copy } from '../config';
import { LogoReveal } from '../components/LogoReveal';

export function Outro() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#050505', color: '#f5f5f5' }}><LogoReveal compact /><div style={{ position: 'absolute', left: 160, bottom: 170, opacity, font: '400 34px/1.15 ui-sans-serif, system-ui, sans-serif', letterSpacing: '-.03em' }}>{copy.close}<div style={{ marginTop: 22, color: '#888', fontSize: 18, letterSpacing: '.02em' }}>{copy.cta}</div></div></AbsoluteFill>;
}