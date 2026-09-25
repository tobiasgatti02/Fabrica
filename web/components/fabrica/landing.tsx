'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import { chapters, chapterAt, clamp, INTERIOR_START } from './timeline';
import type { SceneController } from './scene/house-scene';
import { hardNavigate } from './hard-navigation';

const HouseScene = dynamic(() => import('./scene/house-scene'), { ssr: false });
export function Wordmark() { return <span className="wordmark">fabrica<span aria-hidden="true">®</span></span>; }

const stageRenders = ['terrain', 'foundation', 'framing', 'shell', 'finishes', 'exterior', 'interior'];
const fallbackStageAt = [0, .1, .28, .5, .62, .76, INTERIOR_START];
type PublicPlan = { key: string; amountCents: number; currency: string; rights: {
  projects: number; storageBytes: number; professionals: number; clients: number | null;
  teamPermissions: boolean; advancedAdmin: boolean; prioritySupport: boolean;
} };
const planNames: Record<string, string> = { prueba: 'Prueba', inicial: 'Inicial', estudio: 'Estudio', equipo: 'Equipo' };
const price = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const productScreens = [
  { title: 'Panel del estudio', detail: 'Proyectos, entregas y pendientes en una vista clara.', image: '/images/product-panel.svg' },
  { title: 'Mesa de trabajo', detail: 'Ordená ideas y referencias junto a tu equipo.', image: '/images/product-mesa.svg' },
  { title: 'Modelo 3D', detail: 'Compartí el modelo y conversá sobre cada entrega.', image: '/images/product-modelo.svg' },
];
function FallbackHouse({ progress }: { progress: number }) {
  const stage = fallbackStageAt.reduce((current, at, index) => progress >= at ? index : current, 0);
  return <Image key={stage} className="fallback-render" src={`/images/casa-patio-${stageRenders[stage]}.webp`} width={1600} height={1000} alt="" />;
}

function FallingTitle({ first, second }: { first: string; second: string }) {
  const renderWords = (line: string, start: number) => line.split(' ').map((word, index, words) => <span key={`${start}-${index}`} className="title-word" style={{ animationDelay: `${(start + index) * 135 + 120}ms` }}>{word}{index < words.length - 1 ? '\u00a0' : ''}</span>);
  return <h2 aria-label={`${first} ${second}`} className="falling-title">
    <span className="title-line" aria-hidden="true">{renderWords(first, 0)}</span>
    <em className="title-line" aria-hidden="true">{renderWords(second, first.split(' ').length)}</em>
  </h2>;
}

export default function Landing() {
  const story = useRef<HTMLElement>(null);
  const controller = useRef<SceneController>({ progress: 0, invalidate: () => {}, reduced: false });
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [screenIndex, setScreenIndex] = useState(0);
  const [plansError, setPlansError] = useState(false);
  const sceneFailed = useRef(false);
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => { sceneFailed.current = true; setFailed(true); setProgress(controller.current.progress); }, []);
  const chapter = chapterAt(progress);
  const inside = progress >= INTERIOR_START;
  const goTo = useCallback((p: number) => {
    if (!story.current) return;
    const element = story.current;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * (element.offsetHeight - window.innerHeight), behavior: controller.current.reduced ? 'instant' : 'smooth' });
  }, []);

  useEffect(() => {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) {
      queueMicrotask(() => setFailed(true));
      return;
    }
    const start = () => setSceneEnabled(true);
    const idle = window.requestIdleCallback?.(start, { timeout: 1200 });
    const timer = idle === undefined ? window.setTimeout(start, 250) : undefined;
    window.addEventListener('wheel', start, { once: true, passive: true });
    window.addEventListener('touchstart', start, { once: true, passive: true });
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('wheel', start);
      window.removeEventListener('touchstart', start);
    };
  }, []);

  useEffect(() => {
    void fetch('/api/billing/catalog').then(async (response) => {
      if (!response.ok) throw new Error('catalog');
      return response.json() as Promise<{ plans: PublicPlan[] }>;
    }).then((data) => setPlans(data.plans)).catch(() => setPlansError(true));
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
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
      const hash = () => { const index = chapters.findIndex(c => `#${c.id}` === window.location.hash); if (index >= 0) goTo(chapters[index].at + (index === 0 ? 0 : .02)); };
      window.addEventListener('hashchange', hash);
      const refresh = requestAnimationFrame(() => { ScrollTrigger.refresh(); hash(); });
      cleanup = () => { cancelAnimationFrame(refresh); trigger.kill(); media.removeEventListener('change', motion); window.removeEventListener('hashchange', hash); };
    });
    return () => { disposed = true; cleanup(); };
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
        <a className="header-cta action-button action-button--primary" href="/estudio/panel" onClick={hardNavigate}>Entrar al estudio <ArrowUpRight size={17} /></a>
      </nav>
    </header>

    <section ref={story} className="story-scroll" aria-label="De una idea a un lugar: recorrido de Casa Patio">
      <div className="story-stage">
        <div className={`scene-backdrop ${ready && !failed ? 'is-ready' : ''}`} aria-hidden="true">
          <picture className="scene-poster">
            <source media="(max-width: 759px)" srcSet="/images/landing-first-frame-mobile.webp" />
            <img src="/images/landing-first-frame-desktop.webp" width="1600" height="1000" alt="" fetchPriority="high" decoding="async" />
          </picture>
          {failed && <FallbackHouse progress={progress} />}
          {!failed && sceneEnabled && <HouseScene controller={controller} onReady={markReady} onProgress={setProgress} onError={markFailed} />}
        </div>
        <div className="scene-vignette" aria-hidden="true" />
        <div className="hero-ghost" aria-hidden="true" style={{ opacity: 1 - Math.min(1, progress / .14), transform: `translateY(${progress * 180}px)` }}>fabrica</div>

        <div className="story-copy" style={{ opacity: progress > .84 ? Math.max(0, 1 - (progress - .84) / .05) : 1 }} aria-hidden={progress > .89} inert={progress > .89}>
          <div key={chapter} className={`chapter-copy ${reduced ? 'no-motion' : ''}`}>
            <p className="eyebrow"><span>{chapters[chapter].number} /</span> {chapters[chapter].label}</p>
            <FallingTitle first={chapters[chapter].title[0]} second={chapters[chapter].title[1]} />
            <p className="chapter-description">{chapters[chapter].text}</p>
            {chapter === 0 && <button className="round-link action-button action-button--secondary" onClick={() => goTo(chapters[1].at + .02)}><span className="round-icon"><ArrowDown size={20} /></span>Conocé el estudio</button>}
          </div>
        </div>
        {failed && <output className="loading-label">Recorrido en imágenes · Deslizá para avanzar</output>}

        <footer id="interior" className={`interior-footer ${inside ? 'is-visible' : ''}`} aria-hidden={!inside} inert={!inside}>
          <div className="interior-top"><span className="eyebrow">03 / Bienvenido a Casa Patio</span><span>Estar · Una nueva perspectiva</span></div>
          <div className="interior-content"><p className="eyebrow">Fabrica / Tu estudio online</p><h2>Tu trabajo,<br /><em>en contexto.</em></h2><p>Presentá cada proyecto con claridad.<br />Invitá a tus clientes a recorrerlo y decidir.</p>
            <div className="interior-actions"><a className="solid-link action-button action-button--primary" href="/estudio/panel" onClick={hardNavigate}>Entrar al estudio <ArrowUpRight size={18} /></a><a className="action-button action-button--secondary" href="#para-estudios">Ver cómo funciona <ArrowDown size={17} /></a></div>
          </div>

        </footer>

        <div className={`journey-bottom ${inside ? 'at-end' : ''}`}>
          <div className="journey-meta"><span>DE UNA IDEA A UN LUGAR</span><span>{String(Math.round(progress * 100)).padStart(2, '0')}%</span></div>
          <nav className="chapter-nav" aria-label="Etapas de construcción">
            {chapters.map((c, i) => <button key={c.id} aria-current={chapter === i ? 'step' : undefined} aria-label={`${c.number}: ${c.label}`} onClick={() => goTo(c.at + (i === 0 ? 0 : .02))}><span className="chapter-line"><i style={{ transform: `scaleX(${clamp((progress - c.at) / ((chapters[i + 1]?.at ?? 1) - c.at))})` }} /></span><span className="chapter-number">{c.number}</span><span className="chapter-name">{c.label}</span></button>)}
          </nav>
        </div>
      </div>
    </section>
    <section id="para-estudios" className="studio-section" aria-labelledby="para-estudios-title">
      <div className="product-tour" aria-label="Pantallas del estudio">
        <div className="product-tour-copy">
          <p className="eyebrow">Fabrica / El estudio</p>
          <h2 id="para-estudios-title">Del proyecto<br /><em>a la decisión.</em></h2>
          <p className="product-tour-intro">Organizá el trabajo, explorá el modelo y conversá con tus clientes en un mismo espacio.</p>
          <h3>{productScreens[screenIndex].title}</h3>
          <p>{productScreens[screenIndex].detail}</p>
          <div className="product-tour-tabs" role="tablist" aria-label="Elegí una pantalla">
            {productScreens.map((screen, index) => <button key={screen.title} role="tab" aria-selected={screenIndex === index} aria-controls="product-screen" onClick={() => setScreenIndex(index)}><span>0{index + 1}</span>{screen.title}</button>)}
          </div>
          <a className="product-tour-cta action-button action-button--primary" href="/estudio/modelo" onClick={hardNavigate}>Explorar Casa Patio <ArrowUpRight size={17} /></a>
        </div>
        <div className="product-screen" id="product-screen" role="tabpanel" aria-label={productScreens[screenIndex].title}>
          <div className="product-screen-bar"><i /><i /><i /><span>fabrica / estudio</span></div>
          <div className="product-screen-stage">
            {screenIndex === 2 && <Image className="product-screen-model" src="/images/casa-patio-exterior.webp" alt="" width={1600} height={1000} />}
            <Image className="product-screen-ui" key={productScreens[screenIndex].image} src={productScreens[screenIndex].image} alt={`Pantalla de ${productScreens[screenIndex].title} en Fabrica`} width={1440} height={900} />
          </div>
        </div>
      </div>
      <section id="precios" className="pricing-section" aria-labelledby="pricing-title">
        <div className="pricing-intro"><p className="eyebrow">Fabrica / Precios</p><h2 id="pricing-title">Un plan para cada<br /><em>forma de crear.</em></h2><p>Empezá con 14 días de prueba. Elegí más capacidad cuando tu estudio la necesite.</p></div>
        <div className="pricing-grid" aria-live="polite">{plans.map((plan) => {
          const trial = plan.key === 'prueba';
          return <article className={`pricing-plan ${plan.key === 'estudio' ? 'pricing-plan--featured' : ''}`} key={plan.key}>
            <span className="pricing-status">{trial ? '14 días de prueba' : plan.key === 'estudio' ? 'Para estudios en marcha' : 'Suscripción mensual'}</span>
            <h3>{planNames[plan.key] || plan.key}</h3>
            <p className="pricing-amount">{trial ? 'Gratis' : price.format(plan.amountCents / 100)}{!trial && <small> / mes</small>}</p>
            <ul><li>{plan.rights.projects} {plan.rights.projects === 1 ? 'proyecto' : 'proyectos'}</li><li>{plan.rights.storageBytes / 1024 ** 3} GB para modelos y mesa de trabajo</li><li>{plan.rights.professionals} profesionales</li><li>{plan.rights.clients === null ? 'Clientes ilimitados' : `${plan.rights.clients} clientes`}</li>{plan.rights.teamPermissions && <li>Permisos por área</li>}{plan.rights.advancedAdmin && <li>Administración avanzada</li>}{plan.rights.prioritySupport && <li>Soporte prioritario</li>}</ul>
            <a className="pricing-link action-button action-button--secondary" href={trial ? '/estudio/panel' : `/estudio/facturacion?plan=${encodeURIComponent(plan.key)}`} onClick={hardNavigate}>{trial ? 'Empezar prueba' : 'Elegir plan'} <ArrowUpRight size={17} /></a>
          </article>;
        })}{!plans.length && <p className="pricing-loading">{plansError ? 'No pudimos cargar los precios. Intentá más tarde.' : 'Cargando planes y precios actuales…'}</p>}</div>
        <p className="pricing-note">Cobro mensual mediante Mercado Pago. Tus límites y el estado de la suscripción se actualizan en el estudio.</p>
      </section>
      <div className="studio-footer"><Wordmark /><span>Un espacio propio para cada proyecto.</span><a className="action-button action-button--secondary" href="/estudio/panel" onClick={hardNavigate}>Entrar al estudio <ArrowUpRight size={16} /></a></div>
    </section>
  </main>;
}
