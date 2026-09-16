import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { captures } from '../config';

export type CaptureName = keyof typeof captures;

export function BrowserFrame({
  capture,
  left = 180,
  top = 150,
  width = 1560,
  height = 790,
  zoom = 1,
}: {
  capture: CaptureName;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  zoom?: number;
}) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute', left, top, width, height, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.14)', borderRadius: 14,
        background: '#111', boxShadow: '0 28px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)',
        transform: `scale(${zoom}) translateY(${(1 - reveal) * 22}px)`,
        opacity: reveal,
      }}
    >
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', background: '#171717', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => <i key={color} style={{ width: 9, height: 9, borderRadius: 9, background: color, opacity: .8 }} />)}
        <span style={{ marginLeft: 12, color: '#666', font: '11px ui-monospace, SFMono-Regular, Menlo, monospace' }}>fabrica / estudio</span>
      </div>
      <Img src={staticFile(captures[capture])} style={{ width: '100%', height: `calc(100% - 34px)`, objectFit: 'cover', objectPosition: 'center top' }} />
    </div>
  );
}