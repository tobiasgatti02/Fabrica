import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { captures, copy } from '../config';

type Capture = keyof typeof captures;

const uiFont = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const serifFont = 'Iowan Old Style, Baskerville, Georgia, serif';

const scenes: Array<{
  capture: Capture;
  copy: string;
  detail: string;
  from: number;
  cursorFrom: [number, number];
  cursorTo: [number, number];
  pan: [number, number];
  overlay?: 'comments';
}> = [
  {
    capture: 'version',
    copy: copy.model,
    detail: 'Explorá cada versión y entendé el proyecto antes de construir.',
    from: 120,
    cursorFrom: [1160, 650],
    cursorTo: [1370, 105],
    pan: [-20, 12],
  },
  {
    capture: 'version',
    copy: copy.comments,
    detail: 'Las decisiones quedan sobre el proyecto, donde realmente importan.',
    from: 360,
    cursorFrom: [1250, 680],
    cursorTo: [1778, 105],
    pan: [18, 4],
    overlay: 'comments',
  },
  {
    capture: 'team',
    copy: copy.team,
    detail: 'Invitá personas y definí el acceso de cada una.',
    from: 600,
    cursorFrom: [1160, 650],
    cursorTo: [400, 104],
    pan: [14, -8],
  },
  {
    capture: 'inspiration',
    copy: copy.inspiration,
    detail: 'Referencias, materiales e ideas en un lienzo compartido.',
    from: 840,
    cursorFrom: [1230, 690],
    cursorTo: [178, 104],
    pan: [-12, 10],
  },
  {
    capture: 'panel',
    copy: copy.panel,
    detail: 'Proyectos, tareas y próximos pasos, siempre a la vista.',
    from: 1080,
    cursorFrom: [1160, 690],
    cursorTo: [92, 104],
    pan: [8, -14],
  },
];

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        color: '#f4f1e8',
        fontFamily: uiFont,
        fontSize: small ? 26 : 82,
        fontWeight: 650,
        letterSpacing: '-0.065em',
      }}
    >
      fabrica
      <span style={{ marginLeft: 7, marginTop: 4, fontSize: '.3em', letterSpacing: 0 }}>®</span>
    </div>
  );
}

function Cursor({ from, to }: { from: [number, number]; to: [number, number] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - 32,
    fps,
    config: { damping: 26, stiffness: 55, mass: 0.75 },
    durationInFrames: 100,
  });
  const x = interpolate(progress, [0, 1], [from[0], to[0]]);
  const y = interpolate(progress, [0, 1], [from[1], to[1]]);
  const click = interpolate(frame, [125, 132, 152], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 8 }}>
      <div
        style={{
          position: 'absolute',
          left: -16,
          top: -16,
          width: 44,
          height: 44,
          border: '2px solid rgba(43, 53, 37, .55)',
          borderRadius: '50%',
          opacity: click,
          transform: `scale(${0.4 + click * 1.35})`,
        }}
      />
      <svg
        viewBox="0 0 26 32"
        width="26"
        height="32"
        style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.28))', transform: `scale(${1 - click * 0.08})` }}
      >
        <path d="M2 2l4 26 6-8 8 8 4-4-8-8 8-3L2 2z" fill="#f8f7f2" stroke="#253024" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function CommentsOverlay() {
  const frame = useCurrentFrame();
  const open = spring({
    frame: frame - 20,
    fps: 60,
    config: { damping: 24, stiffness: 72, mass: 0.85 },
  });
  return (
    <div
      style={{
        position: 'absolute', right: 0, top: 92, bottom: 0, width: 410,
        padding: '34px 30px', background: 'rgba(250,249,244,.98)',
        borderLeft: '1px solid #d8d8cf', boxShadow: '-20px 0 50px rgba(25,30,22,.12)',
        color: '#30352c', fontFamily: uiFont,
        transform: `translateX(${(1 - open) * 430}px)`,
      }}
    >
      <div style={{ color: '#7b8274', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>Conversación</div>
      <div style={{ marginTop: 8, paddingBottom: 22, borderBottom: '1px solid #dedfd7', fontFamily: serifFont, fontSize: 34, letterSpacing: '-.035em' }}>
        Comentarios <span style={{ fontFamily: uiFont, fontSize: 13, verticalAlign: 5 }}>2</span>
      </div>
      <div style={{ marginTop: 26, display: 'flex', gap: 13 }}>
        <div style={{ flex: '0 0 auto', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#a66b4d', color: 'white', fontSize: 11 }}>MC</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Marina Costa</div>
          <div style={{ marginTop: 9, fontSize: 16, lineHeight: 1.45 }}>¿Podemos abrir un poco más la conexión con el patio?</div>
          <div style={{ marginTop: 12, color: '#9a7542', fontSize: 11, fontWeight: 700, letterSpacing: '.07em' }}>ABIERTO · PUNTO 02</div>
        </div>
      </div>
      <div style={{ marginTop: 28, display: 'flex', gap: 13 }}>
        <div style={{ flex: '0 0 auto', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#40523a', color: 'white', fontSize: 11 }}>EN</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Estudio Norte</div>
          <div style={{ marginTop: 9, fontSize: 16, lineHeight: 1.45 }}>Sí. Lo ajustamos en la próxima versión para compararlo.</div>
          <div style={{ marginTop: 12, color: '#72846a', fontSize: 11, fontWeight: 700, letterSpacing: '.07em' }}>RESUELTO EN V03</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, height: 88, padding: '16px 18px', border: '1px solid #d9dbd2', color: '#8a8d84', fontSize: 14 }}>Escribí un comentario…</div>
    </div>
  );
}

function AppScene({ scene }: { scene: (typeof scenes)[number] }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 22, 210, 239], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 239], [1.012, 1.055], {
    easing: Easing.inOut(Easing.ease),
    extrapolateRight: 'clamp',
  });
  const text = spring({
    frame: frame - 36,
    fps: 60,
    config: { damping: 22, stiffness: 75, mass: 0.8 },
  });

  return (
    <AbsoluteFill style={{ opacity, background: '#161914' }}>
      <div
        style={{
          position: 'absolute',
          inset: 36,
          overflow: 'hidden',
          borderRadius: 22,
          boxShadow: '0 35px 100px rgba(0,0,0,.45)',
          background: '#ecebe4',
        }}
      >
        <Img
          src={staticFile(captures[scene.capture])}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(${scene.pan[0] * (frame / 239)}px, ${scene.pan[1] * (frame / 239)}px) scale(${scale})`,
          }}
        />
        {scene.overlay === 'comments' ? <CommentsOverlay /> : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(10,13,9,.68) 0%, rgba(10,13,9,.12) 41%, transparent 62%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 118,
          bottom: 105,
          width: 660,
          color: '#f5f2e9',
          opacity: text,
          transform: `translateY(${(1 - text) * 28}px)`,
        }}
      >
        <div style={{ marginBottom: 18, fontFamily: uiFont, fontSize: 15, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#cad7a1' }}>
          Fabrica estudio
        </div>
        <div style={{ fontFamily: serifFont, fontSize: 67, lineHeight: 0.98, letterSpacing: '-.05em' }}>{scene.copy}</div>
        <div style={{ marginTop: 22, maxWidth: 540, fontFamily: uiFont, fontSize: 22, lineHeight: 1.4, color: 'rgba(245,242,233,.78)' }}>{scene.detail}</div>
      </div>

      <Cursor from={scene.cursorFrom} to={scene.cursorTo} />
    </AbsoluteFill>
  );
}

function Intro() {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 60, config: { damping: 24, stiffness: 62 } });
  const exit = interpolate(frame, [92, 119], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#1f281d', color: '#f4f1e8', opacity: exit }}>
      <div style={{ position: 'absolute', top: 76, left: 86 }}><Brand small /></div>
      <div style={{ position: 'absolute', left: 150, bottom: 130, maxWidth: 1220, opacity: enter, transform: `translateY(${(1 - enter) * 34}px)` }}>
        <div style={{ fontFamily: serifFont, fontSize: 102, lineHeight: .96, letterSpacing: '-.06em' }}>{copy.intro}</div>
      </div>
      <div style={{ position: 'absolute', right: 94, bottom: 90, width: 190, height: 1, background: 'rgba(244,241,232,.35)' }} />
    </AbsoluteFill>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const enter = spring({ frame: frame - 8, fps: 60, config: { damping: 24, stiffness: 60 } });
  const cta = interpolate(frame, [72, 105], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#1f281d', color: '#f4f1e8' }}>
      <div style={{ position: 'absolute', top: 76, left: 86 }}><Brand small /></div>
      <div style={{ position: 'absolute', left: 150, bottom: 150, opacity: enter, transform: `translateY(${(1 - enter) * 32}px)` }}>
        <div style={{ maxWidth: 1000, fontFamily: serifFont, fontSize: 105, lineHeight: .96, letterSpacing: '-.06em' }}>{copy.close}</div>
        <div style={{ marginTop: 34, opacity: cta, fontFamily: uiFont, fontSize: 23, letterSpacing: '.02em', color: '#cad7a1' }}>{copy.cta} →</div>
      </div>
    </AbsoluteFill>
  );
}

export function AppTour() {
  return (
    <AbsoluteFill style={{ background: '#161914' }}>
      <Sequence from={0} durationInFrames={120}><Intro /></Sequence>
      {scenes.map((scene) => (
        <Sequence key={scene.copy} from={scene.from} durationInFrames={240} premountFor={30}>
          <AppScene scene={scene} />
        </Sequence>
      ))}
      <Sequence from={1320} durationInFrames={180} premountFor={30}><Outro /></Sequence>
    </AbsoluteFill>
  );
}
