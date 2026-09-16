import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { Cursor } from '../components/Cursor';
import { FeatureLabel } from '../components/FeatureLabel';
import { copy } from '../config';

export function MainWorkflow() {
  const frame = useCurrentFrame();
  const capture = frame < 95 ? 'dashboard' : frame < 190 ? 'version' : 'comments';
  return <AbsoluteFill style={{ background: '#070707', color: '#f5f5f5' }}>
    <BrowserFrame capture={capture} left={145} top={135} width={1630} height={820} zoom={1 + Math.min(frame / 1800, .035)} />
    <div style={{ position: 'absolute', left: 145, top: 70, font: '500 24px ui-sans-serif, system-ui, sans-serif', letterSpacing: '-.02em' }}>{copy.workflow}</div>
    <Sequence from={22} durationInFrames={80}><Cursor from={[450, 850]} to={[1280, 310]} delay={0} /></Sequence>
    <FeatureLabel left={1580} top={112} delay={25}>versiones</FeatureLabel>
    <FeatureLabel left={1580} top={145} delay={105}>contexto</FeatureLabel>
    <FeatureLabel left={1580} top={178} delay={198}>comentarios</FeatureLabel>
  </AbsoluteFill>;
}