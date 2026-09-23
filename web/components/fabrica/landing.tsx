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
      <span className="header-caption">Un espacio propio para tu estudio.</span>
      <nav aria-label="Navegación principal">
        <a className="header-nav-link" href="#para-estudios">El estudio</a>
        <a className="header-nav-link" href="#precios">Precios</a>
        <Link className="header-cta action-button action-button--primary" href="/estudio">Entrar al estudio <ArrowUpRight size={17} /></Link>
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
            {chapter === 0 ? <h2>Tu estudio.<br /><em>En su mejor lugar.</em></h2> : <h2>{chapters[chapter].title[0]}<br /><em>{chapters[chapter].title[1]}</em></h2>}
            <p className="chapter-description">{chapters[chapter].text}</p>
            {chapter === 0 && <button className="round-link action-button action-button--secondary" onClick={() => goTo(.18)}><span className="round-icon"><ArrowDown size={20} /></span>Conocé el estudio</button>}
          </div>
        </div>
        {failed && <output className="loading-label">Recorrido en imágenes · Deslizá para avanzar</output>}

        <footer id="interior" className={`interior-footer ${inside ? 'is-visible' : ''}`} aria-hidden={!inside} inert={!inside}>
          <div className="interior-top"><span className="eyebrow">06 / Bienvenido a Casa Patio</span><span>Estar · Una nueva perspectiva</span></div>
          <div className="interior-content"><p className="eyebrow">Fabrica / Tu estudio online</p><h2>Tu trabajo,<br /><em>en contexto.</em></h2><p>Presentá cada proyecto con claridad.<br />Invitá a tus clientes a recorrerlo y decidir.</p>
            <div className="interior-actions"><Link className="solid-link action-button action-button--primary" href="/estudio">Entrar al estudio <ArrowUpRight size={18} /></Link><a className="action-button action-button--secondary" href="#para-estudios">Ver cómo funciona <ArrowDown size={17} /></a></div>
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
      <div className="studio-heading"><p className="eyebrow">Fabrica / El estudio</p><h2 id="para-estudios-title">Todo tu estudio.<br /><em>En un mismo lugar.</em></h2></div>
      <div className="studio-description">
        <p>Un espacio de trabajo para presentar proyectos, compartir avances y tomar decisiones con tus clientes.</p>
        <div className="studio-benefits">
          <div><span>01</span><h3>Proyectos</h3><p>Modelos, referencias y material de trabajo reunidos por proyecto.</p></div>
          <div><span>02</span><h3>Entregas</h3><p>Publicá versiones y mantené a mano lo que cambió.</p></div>
          <div><span>03</span><h3>Conversaciones</h3><p>Comentarios sobre el espacio, con su contexto y su historial.</p></div>
        </div>
        <Link className="studio-open action-button action-button--primary" href="/estudio">Conocer el estudio <ArrowUpRight size={17} /></Link>
        <p className="demo-note">Podés explorar Casa Patio, un proyecto de muestra.</p>
      </div>
      <section id="precios" className="pricing-section" aria-labelledby="pricing-title">
        <div><p className="eyebrow">Fabrica / Precios</p><h2 id="pricing-title">Planes para tu estudio.<br /><em>En preparación.</em></h2></div>
        <div className="pricing-card">
          <span className="pricing-status">Precios en preparación</span>
          <p>Estamos definiendo los planes y precios de Fabrica.</p>
          <Link className="pricing-link action-button action-button--secondary" href="/estudio">Explorar Fabrica <ArrowUpRight size={17} /></Link>
          <small>Publicaremos las condiciones antes de habilitar contrataciones.</small>
        </div>
      </section>
      <div className="studio-footer"><Wordmark /><span>Un espacio propio para cada proyecto.</span><Link className="action-button action-button--secondary" href="/estudio">Entrar al estudio <ArrowUpRight size={16} /></Link></div>
    </section>
  </main>;
}
