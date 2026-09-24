'use client';

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Box, LayoutDashboard, Lightbulb, Share2, UserRound, UsersRound } from 'lucide-react';
import { StudioTourTrigger } from './studio-tour';
import { hardNavigate } from './hard-navigation';

type ChromeControls = {
  setProjectLabel: Dispatch<SetStateAction<string>>;
  setProjectRegistration: Dispatch<SetStateAction<{ node: ReactNode; path: string } | null>>;
  setShareEnabled: Dispatch<SetStateAction<boolean>>;
};
const StudioChromeControls = createContext<ChromeControls | null>(null);
export const useStudioChromeControls = () => useContext(StudioChromeControls);

const areas = [
  { id: 'panel', label: 'Panel', path: '/estudio/panel', icon: LayoutDashboard },
  { id: 'inspiracion', label: 'Mesa de trabajo', path: '/estudio/inspiracion', icon: Lightbulb },
  { id: 'modelo', label: 'Modelo 3D', path: '/estudio', icon: Box },
  { id: 'equipo', label: 'Equipo', path: '/estudio/equipo', icon: UsersRound },
] as const;

export function StudioChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [projectLabel, setProjectLabel] = useState('Estudio local');
  const [projectRegistration, setProjectRegistration] = useState<{ node: ReactNode; path: string } | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const controls = useMemo(() => ({ setProjectLabel, setProjectRegistration, setShareEnabled }), []);
  const isWorkspace = pathname === '/estudio' || areas.some((area) => area.path === pathname);
  const params = new URLSearchParams();
  for (const key of ['project', 'share', 'invite']) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();

  return <StudioChromeControls.Provider value={controls}>
    {isWorkspace && <header className="studio-shared-header studio-static-header">
      <div className="studio-shared-header-leading">
        <a href="/" onClick={hardNavigate} className="studio-shared-brand" aria-label="Fabrica, volver al inicio">
          <span className="wordmark">fabrica<span aria-hidden="true">®</span></span>
        </a>
        <span className="studio-shared-divider" aria-hidden="true" />
        <div className={`studio-static-project${projectRegistration && projectRegistration.path !== pathname ? ' is-switching' : ''}`} aria-busy={projectRegistration ? projectRegistration.path !== pathname : true}>
          {projectRegistration?.node || <span className="studio-project-loading"><span>{projectLabel}</span><span className="studio-loading-dot" aria-label="Cargando proyectos" /></span>}
        </div>
      </div>
      <nav className="studio-area-nav" aria-label="Áreas del estudio">
        <div className="studio-area-nav-links">
          {areas.map(({ id, label, path, icon: Icon }) => <a
            key={id}
            href={`${path}${query ? `?${query}` : ''}`}
            data-tour={id}
            onClick={hardNavigate}
            aria-current={path === pathname ? 'page' : undefined}
          ><Icon size={16} aria-hidden="true" /><span>{label}</span></a>)}
        </div>
      </nav>
      <div className="studio-static-actions">
        <StudioTourTrigger disabled={Boolean(search.get('share') || search.get('invite'))} />
        <button type="button" className="studio-nav-share" title="Compartir proyecto" disabled={!shareEnabled} onClick={() => window.dispatchEvent(new Event('fabrica:open-share'))}>
          <Share2 aria-hidden="true" /> Compartir
        </button>
      </div>
      <a
        className="studio-static-account"
        href={`/estudio?${new URLSearchParams({ ...(params.get('project') ? { project: params.get('project')! } : {}), account: '1' }).toString()}`}
        aria-label="Abrir perfil y configuración"
        onClick={hardNavigate}
      ><UserRound size={17} aria-hidden="true" /></a>
    </header>}
    {children}
  </StudioChromeControls.Provider>;
}
