'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useStudioChromeControls } from './studio-chrome';

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
  label,
  shareEnabled,
}: {
  project: ReactNode;
  label: string;
  shareEnabled: boolean;
}) {
  const chrome = useStudioChromeControls();
  useEffect(() => { chrome?.setProjectLabel(label); }, [chrome?.setProjectLabel, label]);
  useEffect(() => { chrome?.setShareEnabled(shareEnabled); }, [chrome?.setShareEnabled, shareEnabled]);
  useEffect(() => () => { chrome?.setShareEnabled(false); }, [chrome?.setShareEnabled]);
  return chrome?.projectSlot ? createPortal(project, chrome.projectSlot) : null;
}
