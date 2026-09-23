'use client';

import { useState, type SyntheticEvent } from 'react';
import { Copy, Mail, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import {
  shortDate,
  type WorkspaceArea,
  type WorkspaceMember,
  type WorkspacePermission,
} from '@/features/workspace/client';

const roleLabels: Record<string, string> = {
  owner: 'Titular',
  architect: 'Arquitecto/a',
  collaborator: 'Colaborador/a',
  viewer: 'Observador/a',
  external: 'Externo/a',
};
const areaLabels: Record<WorkspaceArea, string> = {
  panel: 'Panel',
  inspiracion: 'Mesa de trabajo',
  modelo: 'Modelo 3D',
};
const permissionLabels: Record<WorkspacePermission, string> = {
  edit: 'Editar',
  view: 'Ver',
  none: 'Sin acceso',
};

export default function Team({ data, busy, run, notify }: WorkspaceViewProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('external');
  const [scope, setScope] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteIsExternal, setInviteIsExternal] = useState(false);
  const [editing, setEditing] = useState<WorkspaceMember | null>(null);
  const active = data.members.filter((item) => item.accepted);
  const pending = data.members.filter((item) => !item.accepted);
  const projectsFor = (member: WorkspaceMember) =>
    member.project
      ? data.projects.filter((project) => project.id === member.project)
      : data.projects;
  const linkFor = (token: string, external = false) =>
    `${window.location.origin}/estudio/${external ? 'panel' : 'equipo'}?invite=${encodeURIComponent(token)}`;
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    notify('Enlace copiado. Enviáselo a la persona invitada.');
  };
  const invite = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await run<{ invite: string }>({
        action: 'invite-member',
        email,
        role,
        project: scope,
      });
      setInviteLink(linkFor(result.invite, role === 'external'));
      setInviteIsExternal(role === 'external');
      setEmail('');
      setShowInvite(false);
      notify('Invitación creada. Compartí el enlace para activar el acceso.');
    } catch {
      /* run shows the error */
    }
  };
  const renew = async (id: string, external = false) => {
    try {
      const result = await run<{ invite: string }>({
        action: 'renew-invite',
        id,
      });
      setInviteLink(linkFor(result.invite, external));
      setInviteIsExternal(external);
      notify('Enlace nuevo generado');
    } catch {
      /* run shows the error */
    }
  };
  const updatePermissions = (
    member: WorkspaceMember,
    area: WorkspaceArea,
    value: WorkspacePermission,
  ) =>
    void run({
      action: 'update-member-permissions',
      id: member.id,
      permissions: { ...member.permissions, [area]: value },
    });
  const saveMember = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    try {
      const result = await run<{ ok: boolean; invite?: string }>({
        action: 'update-member',
        id: editing.id,
        name: editing.name,
        email: editing.email,
        role: editing.role,
        project: editing.project || '',
        permissions: editing.permissions,
      });
      if (result.invite) {
        setInviteLink(linkFor(result.invite, editing.role === 'external'));
        setInviteIsExternal(editing.role === 'external');
        notify('Acceso anterior revocado. Compartí la nueva invitación.');
      } else {
        notify('Persona actualizada');
      }
      setEditing(null);
    } catch {
      /* run shows the error */
    }
  };
  const permissionsFor = (member: WorkspaceMember) => (
    <div
      className="team-member-permissions"
      aria-label={`Permisos de ${member.name || member.email}`}
    >
      {Object.entries(areaLabels).map(([area, label]) => {
        const key = area as WorkspaceArea;
        return (
          <label key={key}>
            <span>{label}</span>
            <select
              value={member.permissions[key]}
              disabled={busy}
              aria-label={`${label}: permiso para ${member.name || member.email}`}
              onChange={(event) =>
                updatePermissions(
                  member,
                  key,
                  event.target.value as WorkspacePermission,
                )
              }
            >
              {Object.entries(permissionLabels).map(
                ([value, permissionLabel]) => (
                  <option key={value} value={value}>
                    {permissionLabel}
                  </option>
                ),
              )}
            </select>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="workspace-content team-page">
      <section className="workspace-hero team-hero">
        <div>
          <h1>
            Un estudio.
            <br />
            <em>Muchas miradas.</em>
          </h1>
          <p className="workspace-lead">
            Sumá a tu equipo o compartí un acceso externo con permisos y
            proyectos definidos para cada persona.
          </p>
          {data.viewer.accountOwner && (
            <button
              className="workspace-primary hero-action"
              onClick={() => setShowInvite(true)}
            >
              <Plus size={17} /> Invitar persona
            </button>
          )}
        </div>
        <div className="team-hero-art" aria-hidden="true">
          <span>A</span>
          <span>M</span>
          <span>J</span>
          <i />
        </div>
      </section>
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="workspace-eyebrow">EQUIPO DEL ESTUDIO</p>
            <h2>Personas</h2>
            {data.viewer.accountOwner && (
              <p className="workspace-muted team-permissions-note">
                Como creador, definís qué puede ver o editar cada persona en
                cada área.
              </p>
            )}
          </div>
          <span className="workspace-count">
            {active.length + 1} {active.length ? 'integrantes' : 'integrante'}
          </span>
        </div>
        <div className="team-list">
          <div className="team-member">
            <span className="team-member-avatar owner">
              {data.project.owner.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>Titular del estudio</strong>
              <small>Acceso a todos los proyectos</small>
            </div>
            <span className="team-role">
              <ShieldCheck size={15} /> Titular
            </span>
          </div>
          {active.map((member) => (
            <div className="team-member" key={member.id}>
              <span className="team-member-avatar">
                {(member.name || member.email).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{member.name || member.email}</strong>
                <small>{member.email}</small>
              </div>
              <div className="team-member-access">
                <span className="team-role">{roleLabels[member.role]}</span>
                <span className="team-member-projects">
                  <span>Proyectos</span>
                  <span>
                    {projectsFor(member).map((project) => (
                      <span className="team-member-project" key={project.id}>
                        {project.name}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
              {data.viewer.accountOwner && permissionsFor(member)}
              {data.viewer.accountOwner && member.role === 'external' && (
                <button
                  className="workspace-text-button"
                  type="button"
                  onClick={() => void renew(member.id, true)}
                >
                  <Copy size={15} /> Nuevo enlace
                </button>
              )}
              {data.viewer.accountOwner && (
                <div className="team-member-actions">
                  <button
                    className="team-member-edit"
                    type="button"
                    title="Editar persona"
                    aria-label={`Editar a ${member.name || member.email}`}
                    onClick={() => setEditing(structuredClone(member))}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="team-member-remove"
                    type="button"
                    title="Quitar del equipo"
                    aria-label={`Quitar a ${member.name || member.email}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Quitar a ${member.name || member.email} del equipo? Se cerrarán sus sesiones y perderá el acceso inmediatamente.`,
                        )
                      )
                        void run({ action: 'remove-member', id: member.id });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {pending.length > 0 && (
        <section className="workspace-section">
          <div className="workspace-section-head">
            <div>
              <p className="workspace-eyebrow">PENDIENTES</p>
              <h2>Invitaciones</h2>
            </div>
          </div>
          <div className="team-list">
            {pending.map((member) => (
              <div className="team-member pending" key={member.id}>
                <span className="team-member-avatar">
                  <Mail size={18} />
                </span>
                <div>
                  <strong>{member.email}</strong>
                  <small>Vence {shortDate(member.inviteExpires)}</small>
                </div>
                <div className="team-member-access">
                  <span className="team-role">
                    {roleLabels[member.role]} · Pendiente
                  </span>
                  <span className="team-member-projects">
                    <span>Proyectos</span>
                    <span>
                      {projectsFor(member).map((project) => (
                        <span className="team-member-project" key={project.id}>
                          {project.name}
                        </span>
                      ))}
                    </span>
                  </span>
                </div>
                {data.viewer.accountOwner && permissionsFor(member)}
                {data.viewer.accountOwner && (
                  <>
                    <button
                      className="team-member-edit"
                      type="button"
                      onClick={() => setEditing(structuredClone(member))}
                    >
                      <Pencil size={15} /> Editar
                    </button>
                    <button
                      className="workspace-text-button"
                      type="button"
                      onClick={() =>
                        void renew(member.id, member.role === 'external')
                      }
                    >
                      <Copy size={15} /> Nuevo enlace
                    </button>
                    <button
                      className="team-member-remove"
                      type="button"
                      title="Cancelar invitación"
                      aria-label={`Cancelar invitación a ${member.email}`}
                      onClick={() =>
                        void run({ action: 'remove-member', id: member.id })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setEditing(null)}
          />
          <form
            className="workspace-modal team-edit-modal"
            onSubmit={saveMember}
          >
            <p className="workspace-eyebrow">EDITAR PERSONA</p>
            <h2>{editing.name || editing.email}</h2>
            <div className="workspace-form-grid">
              <label>
                Nombre
                <input
                  value={editing.name}
                  maxLength={120}
                  onChange={(event) =>
                    setEditing({ ...editing, name: event.target.value })
                  }
                  placeholder="Nombre de la persona"
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={editing.email}
                  onChange={(event) =>
                    setEditing({ ...editing, email: event.target.value })
                  }
                />
              </label>
              <label>
                Rol
                <select
                  value={editing.role}
                  onChange={(event) =>
                    setEditing({ ...editing, role: event.target.value })
                  }
                >
                  <option value="external">Externo/a · sin cuenta</option>
                  <option value="architect">Arquitecto/a</option>
                  <option value="collaborator">Colaborador/a</option>
                  <option value="viewer">Observador/a</option>
                </select>
              </label>
              <label>
                Proyectos visibles
                <select
                  value={editing.project || ''}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      project: event.target.value || null,
                    })
                  }
                >
                  <option value="">Todos los proyectos</option>
                  {data.projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="team-edit-permissions">
              <legend>Permisos por área</legend>
              {Object.entries(areaLabels).map(([area, label]) => {
                const key = area as WorkspaceArea;
                return (
                  <label key={key}>
                    <span>{label}</span>
                    <select
                      value={editing.permissions[key]}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          permissions: {
                            ...editing.permissions,
                            [key]: event.target.value as WorkspacePermission,
                          },
                        })
                      }
                    >
                      {Object.entries(permissionLabels).map(
                        ([value, permissionLabel]) => (
                          <option key={value} value={value}>
                            {permissionLabel}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                );
              })}
            </fieldset>
            <p className="team-edit-security-note">
              Si cambiás el email o el tipo de acceso, se revocará la sesión
              anterior y se generará una nueva invitación.
            </p>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="workspace-primary" disabled={busy}>
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {inviteLink && (
        <div className="workspace-modal-backdrop">
          <div className="workspace-modal invite-result">
            <p className="workspace-eyebrow">INVITACIÓN LISTA</p>
            <h2>Compartí este enlace</h2>
            <p>
              {inviteIsExternal
                ? 'El enlace permite acceder sin iniciar sesión. Solo muestra los proyectos y áreas que le asignaste.'
                : 'La persona deberá ingresar con el email invitado para activar el acceso.'}{' '}
              El enlace vence en 30 días.
            </p>
            <div className="team-invite-link">
              <input
                readOnly
                value={inviteLink}
                aria-label="Enlace de invitación"
              />
              <button
                className="workspace-primary"
                onClick={() => void copy(inviteLink)}
              >
                <Copy size={16} /> Copiar
              </button>
            </div>
            <div className="workspace-modal-actions">
              <button
                className="workspace-secondary"
                onClick={() => setInviteLink('')}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
      {showInvite && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setShowInvite(false)}
          />
          <form className="workspace-modal" onSubmit={invite}>
            <p className="workspace-eyebrow">SUMAR AL EQUIPO</p>
            <h2>Invitar persona</h2>
            <p>
              Crearemos un enlace privado que podés enviar por WhatsApp o email.
              Después vas a poder definir qué áreas puede ver o editar.
            </p>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="arquitecta@estudio.com"
              />
            </label>
            <div className="workspace-form-grid">
              <label>
                Rol
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  <option value="external">Externo/a · sin cuenta</option>
                  <option value="architect">Arquitecto/a · edita</option>
                  <option value="collaborator">Colaborador/a · edita</option>
                  <option value="viewer">Observador/a · consulta</option>
                </select>
              </label>
              <label>
                Proyectos visibles
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="">Todos los proyectos</option>
                  {data.projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setShowInvite(false)}
              >
                Cancelar
              </button>
              <button className="workspace-primary" disabled={busy}>
                Crear invitación
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
