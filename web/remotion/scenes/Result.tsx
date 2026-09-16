import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { Cursor } from '../components/Cursor';
import { copy } from '../config';

export function Result() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#080808', color: '#f5f5f5' }}>
    <BrowserFrame capture="comments" left={125} top={115} width={1670} height={850} zoom={1.035} />
    <div style={{ position: 'absolute', left: 145, bottom: 64, opacity, font: '500 32px ui-sans-serif, system-ui, sans-serif', letterSpacing: '-.035em' }}>{copy.wow}</div>
    <Cursor from={[1500, 720]} to={[1270, 325]} delay={8} />
  </AbsoluteFill>;
}