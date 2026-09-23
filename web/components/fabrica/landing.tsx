'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapters, chapterAt, clamp } from './timeline';
import type { SceneController } from './scene/house-scene';

const HouseScene = dynamic(() => import('./scene/house-scene'), { ssr: false });
export function Wordmark() { return <span className="wordmark">fabrica<span aria-hidden="true">®</span></span>; }

const stageRenders = ['terrain', 'foundation', 'framing', 'shell', 'finishes', 'exterior', 'interior'];
function FallbackHouse({ progress }: { progress: number }) {
  const stage = progress >= .965 ? 6 : Math.min(5, chapterAt(progress));
  return <>{stageRenders.map((name, i) => <Image key={name} className="fallback-render" style={{ opacity: i === stage ? 1 : 0, transition: 'opacity .7s ease' }} src={`/images/casa-patio-${name}.webp`} width={1600} height={1000} alt="" />)}</>;
}

export default function Landing() {
  const story = useRef<HTMLElement>(null);
  const controller = useRef<SceneController>({ progress: 0, invalidate: () => {}, reduced: false });
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sceneFailed = useRef(false);
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => { sceneFailed.current = true; setFailed(true); setProgress(controller.current.progress); }, []);
  const chapter = chapterAt(progress);
  const inside = progress > .965;
  const goTo = useCallback((p: number) => {
    if (!story.current) return;
    const element = story.current;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * (element.offsetHeight - window.innerHeight), behavior: controller.current.reduced ? 'instant' : 'smooth' });
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { setReduced(media.matches); controller.current.reduced = media.matches; controller.current.invalidate(); };
    motion();
    media.addEventListener('change', motion);
    const trigger = ScrollTrigger.create({
      trigger: story.current, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => {
        const p = clamp(self.progress);
        controller.current.progress = p;
        controller.current.invalidate();
        if (sceneFailed.current) setProgress(p);
      },
    });
    const hash = () => { const index = chapters.findIndex(c => `#${c.id}` === window.location.hash); if (index >= 0) goTo(index === 6 ? 1 : chapters[index].at + .025); };
    window.addEventListener('hashchange', hash);
    const refresh = requestAnimationFrame(() => { ScrollTrigger.refresh(); hash(); });
    return () => { cancelAnimationFrame(refresh); trigger.kill(); media.removeEventListener('change', motion); window.removeEventListener('hashchange', hash); };
  }, [goTo]);

  return <main className={`fabrica-experience ${inside ? 'is-inside' : ''} ${failed ? 'scene-failed' : ''}`}>
    <h1 className="sr-only">Fabrica. Todo empieza con una idea.</h1>
    <a className="skip-link" href="#interior" onClick={e => { e.preventDefault(); goTo(1); }}>Saltar recorrido e ir al interior</a>
    <header className="site-header">
      <a href="#vision" aria-label="Fabrica, volver al inicio" onClick={e => { e.preventDefault(); goTo(0); }}><Wordmark /></a>
      <span className="header-caption">Un espacio para imaginar juntos.</span>
      <nav aria-label="Navegación principal">
        <Link className="header-cta" href="/estudio">Entrar al estudio <ArrowUpRight size={17} /></Link>
      </nav>
    </header>

    <section ref={story} className="story-scroll" aria-label="De una idea a un lugar: recorrido de Casa Patio">
      <div className="story-stage">
        <div className={`scene-backdrop ${ready && !failed ? 'is-ready' : ''}`} aria-hidden="true">
     
          {failed && <FallbackHouse progress={progress} />}
          {!failed && <HouseScene controller={controller} onReady={markReady} onProgress={setProgress} onError={markFailed} />}
        </div>
        <div className="scene-vignette" aria-hidden="true" />
        <div className="hero-ghost" aria-hidden="true" style={{ opacity: 1 - Math.min(1, progress / .14), transform: `translateY(${progress * 180}px)` }}>fabrica</div>

        <div className="story-copy" style={{ opacity: progress > .80 ? Math.max(0, 1 - (progress - .80) / .06) : 1 }} aria-hidden={progress > .86} inert={progress > .86}>
          <div key={chapter} className={`chapter-copy ${reduced ? 'no-motion' : ''}`}>
            <p className="eyebrow"><span>{chapters[chapter].number} /</span> {chapters[chapter].label}</p>
            {chapter === 0 ? <h2>Todo empieza<br /><em>con una idea.</em></h2> : <h2>{chapters[chapter].title[0]}<br /><em>{chapters[chapter].title[1]}</em></h2>}
            <p className="chapter-description">{chapters[chapter].text}</p>
            {chapter === 0 && <button className="round-link" onClick={() => goTo(.18)}><span className="round-icon"><ArrowDown size={20} /></span>Deslizá para darle forma</button>}
          </div>
        </div>
        {failed && <output className="loading-label">Recorrido en imágenes · Deslizá para avanzar</output>}

        <footer id="interior" className={`interior-footer ${inside ? 'is-visible' : ''}`} aria-hidden={!inside} inert={!inside}>
          <div className="interior-top"><span className="eyebrow">06 / Bienvenido a Casa Patio</span><span>Estar · Una nueva perspectiva</span></div>
          <div className="interior-content"><p className="eyebrow">De imaginarlo a habitarlo</p><h2>Las ideas merecen<br /><em>ser habitadas.</em></h2><p>Presentá un espacio. Compartí cada mirada.<br />Dale lugar a la próxima versión.</p>
            <div className="interior-actions"><Link className="solid-link" href="/estudio">Abrir Casa Patio <ArrowUpRight size={18} /></Link><a href="#para-estudios">Conocer Fabrica <ArrowDown size={17} /></a></div>
          </div>

        </footer>

        <div className={`journey-bottom ${inside ? 'at-end' : ''}`}>
          <div className="journey-meta"><span>DE UNA IDEA A UN LUGAR</span><span>{String(Math.round(progress * 100)).padStart(2, '0')}%</span></div>
          <nav className="chapter-nav" aria-label="Etapas de construcción">
            {chapters.map((c, i) => <button key={c.id} aria-current={chapter === i ? 'step' : undefined} aria-label={`${c.number}: ${c.label}`} onClick={() => goTo(i === 6 ? 1 : c.at + .025)}><span className="chapter-line"><i style={{ transform: `scaleX(${clamp((progress - c.at) / ((chapters[i + 1]?.at ?? 1) - c.at))})` }} /></span><span className="chapter-number">{c.number}</span><span className="chapter-name">{c.label}</span></button>)}
          </nav>
        </div>
      </div>
    </section>
    <section id="para-estudios" className="studio-section" aria-labelledby="para-estudios-title">
      <div className="studio-heading"><p className="eyebrow">Fabrica / Para tu estudio</p><h2 id="para-estudios-title">El proyecto cambia.<br /><em>La conversación sigue.</em></h2></div>
      <div className="studio-description">
        <p>Mostrá el proyecto como se vive, ordená cada entrega y convertí el feedback del cliente en decisiones claras.</p>
        <div className="studio-benefits">
          <div><span>01</span><h3>Presentá mejor</h3><p>Recorridos 3D y vistas guardadas para que cada propuesta se entienda sin explicar de más.</p></div>
          <div><span>02</span><h3>Decidí con contexto</h3><p>Comentarios anclados al espacio, medidas y referencias reunidos en el mismo proyecto.</p></div>
          <div><span>03</span><h3>Avanzá con claridad</h3><p>Versiones ordenadas y enlaces privados para revisar cada cambio con clientes y equipo.</p></div>
        </div>
        <Link className="studio-open" href="/estudio">Explorar Casa Patio <ArrowUpRight size={17} /></Link>
        <p className="demo-note">Entrá a un proyecto de muestra y conocé la experiencia antes de crear el tuyo.</p>
      </div>
      <div className="studio-footer"><Wordmark /><span>Diseñar es imaginar. Construirlo, conversar.</span><Link href="/estudio">Entrar al proyecto <ArrowUpRight size={16} /></Link></div>
    </section>
  </main>;
}
