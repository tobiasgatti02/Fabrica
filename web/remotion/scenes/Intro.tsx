import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { copy } from '../config';
import { LogoReveal } from '../components/LogoReveal';

export function Intro() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [45, 80], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#050505', color: '#f5f5f5' }}><LogoReveal /><div style={{ position: 'absolute', left: 160, bottom: 145, maxWidth: 720, opacity, font: '400 42px/1.1 ui-sans-serif, system-ui, sans-serif', letterSpacing: '-.035em' }}>{copy.intro}</div></AbsoluteFill>;
}