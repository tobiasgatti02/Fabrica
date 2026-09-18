'use client';

import Link from 'next/link';
import { Box, LayoutDashboard, Lightbulb, UsersRound } from 'lucide-react';
import type { WorkspaceArea, WorkspacePermissions } from '@/features/workspace/client';

const areas = [
  { id: 'panel', label: 'Panel', icon: LayoutDashboard },
  { id: 'inspiracion', label: 'Inspiración', icon: Lightbulb },
  { id: 'modelo', label: 'Modelo 3D', icon: Box },
  { id: 'equipo', label: 'Equipo', icon: UsersRound },
] as const;

export function StudioAreaNav({
  area,
  project,
  share = '',
  invite = '',
  showTeam = true,
  showModel = true,
  permissions,
}: {
  area: string;
  project: string;
  share?: string;
  invite?: string;
  showTeam?: boolean;
  showModel?: boolean;
  permissions?: WorkspacePermissions;
}) {
  const query = new URLSearchParams(
    invite
      ? { invite, ...(project ? { project } : {}) }
      : share
        ? { share }
        : project
          ? { project }
          : {},
  ).toString();
  return (
    <nav className="studio-area-nav" aria-label="Áreas del estudio">
      {areas
        .filter(
          (item) =>
            (item.id !== 'equipo' || showTeam) &&
            (item.id !== 'modelo' || showModel) &&
            (item.id === 'equipo' || !permissions || permissions[item.id as WorkspaceArea] !== 'none'),
        )
        .map((item) => {
          const Icon = item.icon;
          const path =
            item.id === 'modelo' ? '/estudio' : `/estudio/${item.id}`;
          return (
            <Link
              key={item.id}
              data-tour={item.id}
              href={`${path}${query ? `?${query}` : ''}`}
              aria-current={item.id === area ? 'page' : undefined}
              prefetch={item.id === 'modelo' ? false : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
