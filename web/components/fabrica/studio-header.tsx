'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, UserRound } from 'lucide-react';

export type HeaderProject = { id: string; name: string };
export type HeaderProjectGroup = {
  id: string;
  name: string;
  projects: HeaderProject[];
  unassigned?: boolean;
};

export function StudioProjectSwitcher({
  name,
  description,
  selectedId,
  projects,
  groups = [],
  menuTitle,
  menuCount,
  emptyMessage = 'Sin proyectos todavía',
  onSelect,
  actions,
}: {
  name: string;
  description: string;
  selectedId: string;
  projects: HeaderProject[];
  groups?: HeaderProjectGroup[];
  menuTitle: string;
  menuCount: number;
  emptyMessage?: string;
  onSelect: (id: string) => void;
  actions?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const select = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  const menuActions = actions?.(() => setOpen(false));
  const projectButton = (project: HeaderProject) => (
    <button
      key={project.id}
      type="button"
      className={project.id === selectedId ? 'active' : ''}
      aria-current={project.id === selectedId ? 'true' : undefined}
      onClick={() => select(project.id)}
    >
      <span>{project.name}</span>
      {project.id === selectedId && <Check size={16} aria-hidden="true" />}
    </button>
  );

  return (
    <div className="studio-project-selector" ref={root}>
      <button
        className="studio-project-trigger"
        data-tour="projects"
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!projects.length && !actions}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <span>
          <strong>{name}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="studio-project-menu" id={menuId}>
          <p className="studio-project-menu-title">
            {menuTitle} <span>{menuCount}</span>
          </p>
          <div className="studio-project-menu-scroll">
            {groups.length ? (
              groups.map((group) => (
                <div className="studio-project-group" key={group.id}>
                  <div
                    className={`studio-project-group-heading${group.unassigned ? ' unassigned' : ''}`}
                  >
                    <span>
                      {group.unassigned
                        ? '—'
                        : group.name.slice(0, 2).toUpperCase()}
                    </span>
                    <strong>{group.name}</strong>
                    <small>{group.projects.length}</small>
                  </div>
                  {group.projects.length ? (
                    group.projects.map(projectButton)
                  ) : (
                    <span className="studio-project-group-empty">
                      Sin proyectos todavía
                    </span>
                  )}
                </div>
              ))
            ) : projects.length ? (
              projects.map(projectButton)
            ) : (
              <p className="studio-project-menu-empty">{emptyMessage}</p>
            )}
          </div>
          {menuActions && (
            <div className="studio-project-menu-actions">{menuActions}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function StudioHeader({
  project,
  actions,
  account,
}: {
  project: ReactNode;
  actions?: ReactNode;
  account: ReactNode;
}) {
  return (
    <header className="studio-shared-header">
      <div className="studio-shared-header-leading">
        <Link
          href="/"
          className="studio-shared-brand"
          aria-label="Fabrica, volver al inicio"
        >
          <span className="wordmark">
            fabrica<span aria-hidden="true">®</span>
          </span>
        </Link>
        <span className="studio-shared-divider" aria-hidden="true" />
        {project}
      </div>
      <div className="studio-shared-header-actions">
        {actions}
        {account}
      </div>
    </header>
  );
}

export function StudioAccount({
  name,
  href,
  onClick,
}: {
  name: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="studio-account-avatar">
        <UserRound size={16} aria-hidden="true" />
      </span>
      <span className="studio-account-name">{name}</span>
    </>
  );
  const label = 'Abrir perfil y configuración';
  return href ? (
    <Link href={href} className="studio-account-control" aria-label={label}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className="studio-account-control"
      aria-label={label}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
