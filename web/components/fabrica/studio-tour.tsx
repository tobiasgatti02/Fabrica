'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { Compass, ArrowRight, X } from 'lucide-react';

const steps = [
  {
    area: 'modelo',
    target: 'projects',
    title: 'Tus proyectos, en un lugar',
    text: 'Este selector reúne los proyectos de tu estudio. Abrilo para cambiar de proyecto; desde Nuevo proyecto podés empezar otro trabajo. Cada proyecto guarda sus versiones, archivos y comentarios.',
  },
  {
    area: 'panel',
    target: 'panel',
    title: 'El Panel: tu vista general',
    text: 'En la barra superior encontrás el Panel. Acá seguís las etapas, el avance, las fechas y las tareas de cada proyecto para saber qué sigue.',
  },
  {
    area: 'equipo',
    target: 'equipo',
    title: 'Sumá a tu equipo',
    text: 'En Equipo, elegí Invitar persona, ingresá su email y definí su rol y acceso al estudio o a un proyecto. Después compartile el enlace de invitación.',
  },
  {
    area: 'modelo',
    target: 'projects',
    title: 'Creá tus propios clientes',
    text: 'Abrí el selector del proyecto y elegí Ver clientes → Nuevo cliente. Completá el nombre y el email; después podés asignarlo al crear un proyecto. Tu cuenta empieza sin clientes de ejemplo.',
  },
  {
    area: 'modelo',
    target: 'comments',
    title: 'Abrí la conversación',
    text: 'El botón Comentarios abre el panel lateral. Podés conversar sobre todo el proyecto o, cuando importes un modelo, señalar un punto para dejar una observación en contexto.',
  },
  {
    area: 'modelo',
    target: 'model-tools',
    title: 'Importá tu primer modelo',
    text: 'Abrí Herramientas → Importar modelo para subir el archivo y sus recursos. Al guardarlos se crea la primera versión del proyecto, lista para explorar y revisar.',
  },
  {
    area: 'modelo',
    target: 'model-tools',
    title: 'Guardá cada avance',
    text: 'Después de importar, abrí Herramientas → Nueva versión para crear un borrador a partir de la versión actual. Dale un nombre y una descripción para conservar el historial.',
  },
  {
    area: 'inspiracion',
    target: 'inspiracion',
    title: 'Organizá tus mesas de trabajo',
    text: 'Creá varias mesas por proyecto para organizar imágenes, enlaces, referencias, renders y planos. Abrí solo las mesas que necesites.',
  },
] as const;

const restartEvent = 'fabrica:restart-studio-tour';

export function StudioTourTrigger({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      className="studio-tour-trigger"
      title="Recorrido guiado"
      disabled={disabled}
      onClick={() => window.dispatchEvent(new Event(restartEvent))}
    >
      <Compass size={16} />
      <span>Recorrido</span>
    </button>
  );
}

export function StudioTour({ account }: { account: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const area = pathname === '/estudio/modelo' ? 'modelo' : pathname.split('/')[2];
  const [index, setIndex] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const key = `fabrica:studio-tour:v1:${account}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('share') || params.has('invite')) return;
      const requested = params.get('tour');
      if (
        requested !== null &&
        /^\d+$/.test(requested) &&
        Number(requested) < steps.length
      ) {
        setIndex(Number(requested));
        return;
      }
      try {
        if (!localStorage.getItem(key)) setIndex(0);
      } catch {
        /* Replay remains available without storage. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);

  useEffect(() => {
    if (index === null || steps[index].area !== area) return;
    const frame = requestAnimationFrame(() => setNavigating(false));
    return () => cancelAnimationFrame(frame);
  }, [index, area]);

  useEffect(() => {
    if (index === null || steps[index].area !== area) return;
    const update = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${steps[index].target}"]`,
      );
      if (!target) {
        setRect(null);
        return;
      }
      const bounds = target.getBoundingClientRect();
      setRect(
        bounds.width && bounds.height
          ? {
              top: bounds.top - 5,
              left: bounds.left - 5,
              width: bounds.width + 10,
              height: bounds.height + 10,
            }
          : null,
      );
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [index, area, pathname]);

  const finish = () => {
    try {
      localStorage.setItem(key, 'done');
    } catch {
      /* Storage can be disabled. */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    window.history.replaceState(window.history.state, '', url);
    setIndex(null);
    setNavigating(false);
  };
  const go = (next: number) => {
    if (next === steps.length) {
      finish();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tour', String(next));
    setRect(null);
    setIndex(next);
    setNavigating(steps[next].area !== area);
    if (steps[next].area !== area) {
      const path =
        steps[next].area === 'modelo'
          ? '/estudio/modelo'
          : `/estudio/${steps[next].area}`;
      const project = url.searchParams.get('project');
      const params = new URLSearchParams({ tour: String(next) });
      if (project) params.set('project', project);
      router.push(`${path}?${params}`);
    } else {
      window.history.replaceState(window.history.state, '', url);
    }
  };
  useEffect(() => {
    const restart = () => go(0);
    window.addEventListener(restartEvent, restart);
    return () => window.removeEventListener(restartEvent, restart);
  });

  const step = index === null ? null : steps[index];
  return (
    <>
      <Dialog.Root
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) finish();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="studio-tour-backdrop" />
          {rect && step?.area === area && (
            <div
              className="studio-tour-spotlight"
              style={rect}
              aria-hidden="true"
            />
          )}
          <Dialog.Popup className="studio-tour-card">
            <button
              type="button"
              className="studio-tour-close"
              aria-label="Omitir recorrido"
              onClick={finish}
            >
              <X size={18} />
            </button>
            <span className="studio-tour-eyebrow">
              CONOCÉ TU ESTUDIO · {(index ?? 0) + 1} / {steps.length}
            </span>
            <Dialog.Title>{step?.title}</Dialog.Title>
            <Dialog.Description>{step?.text}</Dialog.Description>
            <div className="studio-tour-progress" aria-hidden="true">
              {steps.map((item, i) => (
                <span
                  key={item.title}
                  className={i <= (index ?? 0) ? 'active' : ''}
                />
              ))}
            </div>
            <div className="studio-tour-actions">
              <button type="button" onClick={finish}>
                Omitir
              </button>
              <div>
                <button
                  type="button"
                  disabled={index === 0 || navigating}
                  onClick={() => go((index ?? 1) - 1)}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className="studio-tour-next"
                  disabled={navigating}
                  onClick={() => go((index ?? 0) + 1)}
                >
                  {index === steps.length - 1
                    ? 'Empezar a trabajar'
                    : 'Siguiente'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
