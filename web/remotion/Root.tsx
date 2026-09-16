import { AbsoluteFill, Sequence } from 'remotion';
import { Dashboard } from './scenes/Dashboard';
import { Intro } from './scenes/Intro';
import { MainWorkflow } from './scenes/MainWorkflow';
import { Outro } from './scenes/Outro';
import { Result } from './scenes/Result';

export function ProductDemo() {
  return <AbsoluteFill style={{ background: '#050505' }}>
    <Sequence from={0} durationInFrames={240}><Intro /></Sequence>
    <Sequence from={240} durationInFrames={480}><Dashboard /></Sequence>
    <Sequence from={720} durationInFrames={1380}><MainWorkflow /></Sequence>
    <Sequence from={2100} durationInFrames={780}><Result /></Sequence>
    <Sequence from={2880} durationInFrames={720}><Outro /></Sequence>
  </AbsoluteFill>;
}