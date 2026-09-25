'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Box, LayoutDashboard, Lightbulb, LogOut, Settings2, Share2, UserRound, UsersRound } from 'lucide-react';
import { StudioTourTrigger } from './studio-tour';
import { hardNavigate } from './hard-navigation';
import { readBillingStatus } from '@/features/billing/client';
import { AccountSettings, type Account } from './account-settings';
import { StudioAuthPanel } from './studio-auth-panel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type ChromeControls = {
  setProjectLabel: Dispatch<SetStateAction<string>>;
  setProjectRegistration: Dispatch<SetStateAction<{ node: ReactNode; path: string } | null>>;
  setShareEnabled: Dispatch<SetStateAction<boolean>>;
  setAccount: Dispatch<SetStateAction<Account | null | undefined>>;
};
const StudioChromeControls = createContext<ChromeControls | null>(null);
export const useStudioChromeControls = () => useContext(StudioChromeControls);

export function StudioAccountRegistration({ account }: { account: Account | null }) {
  const controls = useStudioChromeControls();
  useEffect(() => { controls?.setAccount(account); }, [controls, account]);
  return null;
}

const areas = [
  { id: 'panel', label: 'Panel', path: '/estudio/panel', icon: LayoutDashboard },
  { id: 'inspiracion', label: 'Mesa de trabajo', path: '/estudio/inspiracion', icon: Lightbulb },
  { id: 'modelo', label: 'Modelo 3D', path: '/estudio/modelo', icon: Box },
  { id: 'equipo', label: 'Equipo', path: '/estudio/equipo', icon: UsersRound },
] as const;
type NavigationAccess = {
  accountOwner: boolean;
  guest: boolean;
  external: boolean;
  permissions: Record<'panel' | 'inspiracion' | 'modelo', 'none' | 'view' | 'edit'>;
};

const gib = 1024 ** 3;
const gbFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

function StudioStorageUsage() {
  const [storage, setStorage] = useState<{ used: number; limit: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await readBillingStatus<{ usage?: { storageBytes?: number }; rights?: { storageBytes?: number } }>();
        const used = data.usage?.storageBytes;
        const limit = data.rights?.storageBytes;
        if (active && typeof used === 'number' && typeof limit === 'number' && limit > 0) {
          setStorage({ used, limit });
          setLoadFailed(false);
        } else if (active) {
          setLoadFailed(true);
        }
      } catch { if (active) setLoadFailed(true); }
    };
    const onVisibilityChange = () => { if (!document.hidden) void refresh(); };
    const onFocus = () => { void refresh(); };
    void refresh();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  const usedGb = storage ? storage.used / gib : 0;
  const usedLabel = usedGb > 0 && usedGb < 0.01 ? '<0,01' : gbFormat.format(usedGb);
  const limitLabel = storage ? gbFormat.format(storage.limit / gib) : '';

  return <div className="studio-storage-usage" aria-busy={!storage && !loadFailed}>
    <span className="studio-storage-amount"><span className="studio-storage-label">Almacenamiento</span>{storage
      ? <strong>{usedLabel} / {limitLabel} GB</strong>
      : loadFailed
        ? <strong className="studio-storage-unavailable" title="No se pudo consultar el almacenamiento">— / — GB</strong>
        : <output className="studio-storage-skeleton" aria-label="Cargando almacenamiento" />}
    </span>
    <a href="/estudio/facturacion#planes" onClick={hardNavigate} className="studio-storage-upgrade" title="Mejorar plan" aria-label="Mejorar plan">Mejorar plan <ArrowUpRight size={14} aria-hidden="true" /></a>
  </div>;
}

export function StudioChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [projectLabel, setProjectLabel] = useState('Estudio local');
  const [projectRegistration, setProjectRegistration] = useState<{ node: ReactNode; path: string } | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [navigationAccess, setNavigationAccess] = useState<{ key: string; value: NavigationAccess } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const controls = useMemo(() => ({ setProjectLabel, setProjectRegistration, setShareEnabled, setAccount }), []);
  const isWorkspace = pathname === '/estudio/modelo' || areas.some((area) => area.path === pathname);
  const params = new URLSearchParams();
  for (const key of ['project', 'share', 'invite']) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  const navigationKey = query;
  const access = navigationAccess?.key === navigationKey ? navigationAccess.value : null;
  useEffect(() => {
    if (!isWorkspace) return;
    const controller = new AbortController();
    const navParams = new URLSearchParams(query);
    navParams.set('view', 'nav');
    void fetch(`/api/workspace?${navParams}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('navigation_access_unavailable');
        return response.json() as Promise<NavigationAccess>;
      })
      .then((value) => setNavigationAccess({ key: navigationKey, value }))
      .catch(() => { if (!controller.signal.aborted) setNavigationAccess(null); });
    return () => controller.abort();
  }, [isWorkspace, navigationKey, query]);
  const logout = () => {
    setProfileOpen(false);
    setAccountDialogOpen(false);
    if (pathname === '/estudio/modelo') {
      window.dispatchEvent(new Event('fabrica:logout'));
    } else {
      void fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'logout' }),
      }).finally(() => window.location.assign('/estudio/panel'));
    }
  };

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

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
          {areas.filter(({ id }) => access && (id === 'equipo'
            ? !access.guest && !access.external
            : id === 'modelo' && access.external
              ? false
              : access.permissions[id] !== 'none')).map(({ id, label, path, icon: Icon }) => <Link
            key={id}
            href={`${path}${query ? `?${query}` : ''}`}
            data-tour={id}
            prefetch={false}
            aria-current={path === pathname ? 'page' : undefined}
          ><Icon size={16} aria-hidden="true" /><span>{label}</span></Link>)}
        </div>
      </nav>
      {access?.accountOwner && <StudioStorageUsage />}
      <div className="studio-static-actions">
        <StudioTourTrigger disabled={Boolean(search.get('share') || search.get('invite'))} />
        <button type="button" className="studio-nav-share" title="Compartir proyecto" disabled={!shareEnabled} onClick={() => window.dispatchEvent(new Event('fabrica:open-share'))}>
          <Share2 aria-hidden="true" /> Compartir
        </button>
      </div>
      <div className="studio-profile-menu" ref={profileRef}>
        <button
          className="studio-static-account"
          type="button"
          aria-label="Abrir menú de perfil"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((open) => !open)}
        ><UserRound size={17} aria-hidden="true" /></button>
        {profileOpen && <div className="studio-profile-dropdown" role="menu" aria-label="Menú de perfil">
          <button type="button" role="menuitem" onClick={() => {
            setProfileOpen(false);
            if (pathname === '/estudio/modelo') window.dispatchEvent(new Event('fabrica:open-account'));
            else setAccountDialogOpen(true);
          }}><Settings2 size={16} aria-hidden="true" /><span>Configuración</span></button>
          <div className="studio-profile-menu-divider" />
          <button type="button" role="menuitem" onClick={logout}><LogOut size={16} aria-hidden="true" /><span>Cerrar sesión</span></button>
        </div>}
      </div>
    </header>}
    {children}
    <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
      <DialogContent className={`role-dialog ${!account ? 'auth-dialog' : ''}`}>
        <DialogTitle>{account ? 'Tu cuenta' : 'Bienvenido a Fabrica'}</DialogTitle>
        <DialogDescription>{account ? 'Administrá tu cuenta.' : 'Ingresá o creá tu cuenta.'}</DialogDescription>
        {account === undefined ? <p>Preparando tu cuenta…</p> : account ? <>
          <div className="account-summary">
            <span>{account.name.slice(0, 2).toUpperCase()}</span>
            <div><strong>{account.name}</strong><small>{account.email}</small></div>
            {account.provider !== 'chatgpt' ? <button type="button" onClick={logout}><LogOut /> Salir</button> :
              <a target="_top" href="/signout-with-chatgpt?return_to=%2Festudio"><LogOut /> Salir</a>}
          </div>
          {account.provider !== 'chatgpt' && <AccountSettings account={account} onUpdated={setAccount} />}
        </> : <StudioAuthPanel sharedToken="" returnTo={`${pathname}${query ? `?${query}` : ''}`} />}
      </DialogContent>
    </Dialog>
  </StudioChromeControls.Provider>;
}
