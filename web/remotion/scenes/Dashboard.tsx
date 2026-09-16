import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { FeatureLabel } from '../components/FeatureLabel';
import { copy } from '../config';

export function Dashboard() {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [15, 34], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#080808', color: '#f5f5f5' }}>
    <BrowserFrame capture="landing" left={180} top={170} width={1560} height={790} />
    <div style={{ position: 'absolute', left: 160, top: 86, opacity: titleOpacity, font: '500 24px ui-sans-serif, system-ui, sans-serif', letterSpacing: '-.02em' }}>{copy.product}</div>
    <FeatureLabel left={1480} top={140} delay={32}>presentación viva</FeatureLabel>
  </AbsoluteFill>;
}