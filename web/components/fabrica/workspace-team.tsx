'use client';

import { useState, type SyntheticEvent } from 'react';
import {
  Check,
  Copy,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import { shortDate } from '@/features/workspace/client';

const roleLabels: Record<string, string> = {
  owner: 'Titular',
  architect: 'Arquitecto/a',
  collaborator: 'Colaborador/a',
  viewer: 'Observador/a',
};

export default function Team({ data, busy, run, notify }: WorkspaceViewProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('architect');
  const [scope, setScope] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const active = data.members.filter((item) => item.accepted);
  const pending = data.members.filter((item) => !item.accepted);
  const linkFor = (token: string) =>
    `${window.location.origin}/estudio/equipo?invite=${encodeURIComponent(token)}`;
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
      setInviteLink(linkFor(result.invite));
      setEmail('');
      setShowInvite(false);
      notify('Invitación creada. Compartí el enlace para activar el acceso.');
    } catch {
      /* run shows the error */
    }
  };
  const renew = async (id: string) => {
    try {
      const result = await run<{ invite: string }>({
        action: 'renew-invite',
        id,
      });
      setInviteLink(linkFor(result.invite));
      notify('Enlace nuevo generado');
    } catch {
      /* run shows the error */
    }
  };

  return (
    <div className="workspace-content team-page">
      <section className="workspace-hero team-hero">
        <div>
          <p className="workspace-eyebrow">PERSONAS Y RESPONSABILIDADES</p>
          <h1>
            Un estudio.
            <br />
            <em>Muchas miradas.</em>
          </h1>
          <p className="workspace-lead">
            Invitá arquitectos y colaboradores al equipo. Cada persona trabaja
            con la misma información y las decisiones quedan en el proyecto.
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
                <small>
                  {member.email} ·{' '}
                  {member.project
                    ? data.projects.find((item) => item.id === member.project)
                        ?.name || 'Un proyecto'
                    : 'Todos los proyectos'}
                </small>
              </div>
              <span className="team-role">{roleLabels[member.role]}</span>
              {data.viewer.accountOwner && (
                <button
                  className="team-member-remove"
                  type="button"
                  title="Quitar del equipo"
                  aria-label={`Quitar a ${member.name || member.email}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Quitar a ${member.name || member.email} del equipo?`,
                      )
                    )
                      void run({ action: 'remove-member', id: member.id });
                  }}
                >
                  <Trash2 size={16} />
                </button>
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
                  <small>
                    {roleLabels[member.role]} ·{' '}
                    {member.project
                      ? data.projects.find((item) => item.id === member.project)
                          ?.name || 'Un proyecto'
                      : 'Todo el estudio'}{' '}
                    · vence {shortDate(member.inviteExpires)}
                  </small>
                </div>
                <span className="team-role">Pendiente</span>
                {data.viewer.accountOwner && (
                  <>
                    <button
                      className="workspace-text-button"
                      type="button"
                      onClick={() => void renew(member.id)}
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
      <section className="workspace-section team-how">
        <div>
          <UsersRound size={22} />
          <h3>Colaborar sin perder contexto</h3>
          <p>
            Un arquitecto puede editar proyectos, tareas, referencias y
            propuestas. Un colaborador puede trabajar en los proyectos
            asignados. Un observador sólo consulta.
          </p>
        </div>
        <div>
          <Check size={22} />
          <h3>Acceso por proyecto</h3>
          <p>
            Podés invitar a alguien a todo el estudio o sólo a un trabajo
            puntual, ideal para especialistas externos.
          </p>
        </div>
      </section>
      {inviteLink && (
        <div className="workspace-modal-backdrop">
          <div className="workspace-modal invite-result">
            <p className="workspace-eyebrow">INVITACIÓN LISTA</p>
            <h2>Compartí este enlace</h2>
            <p>
              La persona deberá ingresar con <strong>el email invitado</strong>.
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
          <button type="button" className="workspace-backdrop-dismiss" aria-label="Cerrar ventana" onClick={() => setShowInvite(false)} />
          <form className="workspace-modal" onSubmit={invite}>
            <p className="workspace-eyebrow">SUMAR AL EQUIPO</p>
            <h2>Invitar persona</h2>
            <p>
              Crearemos un enlace privado que podés enviar por WhatsApp o email.
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
                  <option value="architect">Arquitecto/a · edita</option>
                  <option value="collaborator">Colaborador/a · edita</option>
                  <option value="viewer">Observador/a · consulta</option>
                </select>
              </label>
              <label>
                Acceso
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
