'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Copy,
  FolderPlus,
  ListTodo,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import ClientPortal from './workspace-client-portal';
import {
  shortDate,
  stageLabels,
  type WorkspaceBudgetItem,
  type WorkspaceTask,
} from '@/features/workspace/client';

const stageOrder = Object.keys(stageLabels);
const emptyTask = {
  id: '',
  title: '',
  startDate: '',
  dueDate: '',
  clientVisible: false,
  assignee: '',
  status: 'todo',
};
const emptyBudgetItem = {
  id: '',
  title: '',
  category: 'General',
  planned: '',
  committed: '',
  status: 'estimated',
  clientVisible: true,
};
const budgetStatusLabels: Record<string, string> = {
  estimated: 'Estimado',
  quoted: 'Cotizado',
  approved: 'Aprobado',
  contracted: 'Contratado',
  paid: 'Pagado',
};
const moneyFormat = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export default function Panel({
  data,
  busy,
  run,
  notify,
  openProject,
}: WorkspaceViewProps) {
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState({
    stage: data.project.stage,
    description: data.project.description,
    progress:
      data.project.progress === null ? '' : String(data.project.progress),
    startDate: data.project.startDate || '',
    dueDate: data.project.dueDate || '',
  });
  const [taskDraft, setTaskDraft] = useState(emptyTask);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(emptyBudgetItem);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [newClient, setNewClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');
  const [dates] = useState(() => {
    const format = (days: number) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(Date.now() + days * 86400_000));
    return { today: format(0), nextWeek: format(7) };
  });
  const projectTasks = useMemo(
    () =>
      data.tasks
        .filter((item) => item.project === data.project.id)
        .sort((a, b) =>
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
        ),
    [data.tasks, data.project.id],
  );
  const visibleTasks = projectTasks.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'done' ? item.status === 'done' : item.status !== 'done'),
  );
  const openTasks = data.tasks.filter((item) => item.status !== 'done');
  const soon = openTasks.filter(
    (item) => item.dueDate && item.dueDate <= dates.nextWeek,
  );
  const totalDone = data.tasks.filter((item) => item.status === 'done').length;
  const budgetItems = data.budgetItems;
  const budgetPlanned = budgetItems.reduce(
    (sum, item) => sum + item.planned,
    0,
  );
  const budgetCommitted = budgetItems.reduce(
    (sum, item) => sum + item.committed,
    0,
  );
  const budgetDifference = budgetCommitted - budgetPlanned;
  const pendingProjectTasks = projectTasks.filter(
    (item) => item.status !== 'done',
  );
  const progress = (id: string): number | null => {
    const project = data.projects.find((item) => item.id === id);
    if (project?.progress !== null && project?.progress !== undefined)
      return project.progress;
    const stat = data.projectStats[id];
    return stat?.total ? Math.round((stat.done / stat.total) * 100) : null;
  };
  const clientNameFor = (id: string | null) =>
    data.clients.find((item) => item.id === id)?.name || 'Sin cliente asignado';
  const copySummary = async () => {
    const next = projectTasks
      .filter((item) => item.status !== 'done')
      .slice(0, 3);
    const shareActive =
      data.project.shareEnabled &&
      data.project.share &&
      (!data.project.shareExpires || data.project.shareExpires > Date.now());
    const lines = [
      `Avance de ${data.project.name}`,
      `Etapa: ${stageLabels[data.project.stage] || 'Idea'}`,
      `Avance estimado: ${progress(data.project.id) === null ? 'a definir' : `${progress(data.project.id)}%`}`,
      `Entrega prevista: ${data.project.dueDate ? shortDate(data.project.dueDate) : 'a definir'}`,
      ...(next.length
        ? [
            '',
            'Próximos pasos:',
            ...next.map(
              (task) =>
                `• ${task.title}${task.dueDate ? ` (${shortDate(task.dueDate)})` : ''}`,
            ),
          ]
        : []),
      ...(shareActive
        ? [
            '',
            `Ver el proyecto: ${window.location.origin}/estudio/panel?share=${encodeURIComponent(data.project.share!)}`,
          ]
        : []),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      notify('Resumen copiado. Podés enviarlo por WhatsApp o email.');
    } catch {
      notify('No se pudo copiar el resumen en este navegador.');
    }
  };

  const saveProject = async () => {
    try {
      await run({ action: 'update-project', ...projectDraft });
      setEditingProject(false);
      notify('Seguimiento actualizado');
    } catch {
      /* run shows the error */
    }
  };
  const saveTask = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await run({ action: 'save-task', ...taskDraft });
      setTaskDraft(emptyTask);
      setShowTaskForm(false);
      notify(taskDraft.id ? 'Tarea actualizada' : 'Tarea agregada');
    } catch {
      /* run shows the error */
    }
  };
  const setTaskStatus = async (task: WorkspaceTask, status: string) => {
    try {
      await run({
        action: 'save-task',
        id: task.id,
        title: task.title,
        startDate: task.startDate,
        dueDate: task.dueDate,
        clientVisible: task.clientVisible === 1,
        assignee: task.assignee,
        status,
      });
    } catch {
      /* run shows the error */
    }
  };
  const saveBudgetItem = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await run({
        action: 'save-budget-item',
        ...budgetDraft,
        planned: Number(budgetDraft.planned),
        committed: Number(budgetDraft.committed),
      });
      setBudgetDraft(emptyBudgetItem);
      setShowBudgetForm(false);
      notify(
        budgetDraft.id
          ? 'Partida actualizada'
          : 'Partida agregada al presupuesto',
      );
    } catch {
      /* run shows the error */
    }
  };
  const editBudgetItem = (item: WorkspaceBudgetItem) => {
    setBudgetDraft({
      id: item.id,
      title: item.title,
      category: item.category,
      planned: String(item.planned),
      committed: String(item.committed),
      status: item.status,
      clientVisible: item.clientVisible === 1,
    });
    setShowBudgetForm(true);
  };
  const createProject = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await run<{ project: string }>({
        action: 'create-project',
        name: projectName,
        client: projectClient,
      });
      setNewProject(false);
      setProjectName('');
      openProject(result.project);
      notify('Proyecto creado. Agregá fechas y tareas para empezar.');
    } catch {
      /* run shows the error */
    }
  };
  const createClient = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await run<{ client: string }>({
        action: 'create-client',
        name: clientName,
        email: clientEmail,
      });
      setNewClient(false);
      setClientName('');
      setClientEmail('');
      setProjectClient(result.client);
      setNewProject(true);
      notify('Cliente agregado');
    } catch {
      /* run shows the error */
    }
  };

  if (data.viewer.guest) return <ClientPortal data={data} />;

  return (
    <div className="workspace-content panel-page">
      {data.viewer.guest ? (
        <section
          className="panel-metrics client-metrics"
          aria-label="Resumen del proyecto"
        >
          <div>
            <span>ETAPA ACTUAL</span>
            <strong>{stageLabels[data.project.stage] || 'Idea'}</strong>
            <small>Estado del proyecto</small>
          </div>
          <div>
            <span>AVANCE ESTIMADO</span>
            <strong>
              {progress(data.project.id) === null
                ? '—'
                : `${progress(data.project.id)}%`}
            </strong>
            <small>
              {progress(data.project.id) === null
                ? 'Próximamente'
                : 'Del trabajo total'}
            </small>
          </div>
          <div>
            <span>ENTREGA PREVISTA</span>
            <strong>
              {data.project.dueDate
                ? shortDate(data.project.dueDate)
                : 'A definir'}
            </strong>
            <small>Fecha estimada</small>
          </div>
        </section>
      ) : (
        <section className="panel-metrics" aria-label="Resumen del estudio">
          <div>
            <span>01 / PROYECTOS</span>
            <strong>{data.projects.length.toString().padStart(2, '0')}</strong>
            <small>En tu cartera</small>
          </div>
          <div>
            <span>02 / PENDIENTES</span>
            <strong>{openTasks.length.toString().padStart(2, '0')}</strong>
            <small>En todos los proyectos</small>
          </div>
          <div className={soon.length ? 'attention' : ''}>
            <span>03 / PRÓXIMOS 7 DÍAS</span>
            <strong>{soon.length.toString().padStart(2, '0')}</strong>
            <small>
              {soon.length ? 'Vencidos o por vencer' : 'Sin urgencias'}
            </small>
          </div>
          <div>
            <span>04 / COMPLETADAS</span>
            <strong>{totalDone.toString().padStart(2, '0')}</strong>
            <small>Tareas cerradas</small>
          </div>
        </section>
      )}
      {!data.viewer.guest && (
        <section className="workspace-section">
          <div className="workspace-section-head">
            <div>
              <p className="workspace-eyebrow">CARTERA</p>
              <h2>Proyectos</h2>
            </div>
            {data.viewer.accountOwner && (
              <button
                className="workspace-primary"
                onClick={() => setNewProject(true)}
              >
                <Plus size={17} /> Nuevo proyecto
              </button>
            )}
          </div>
          <div className="panel-project-grid">
            {data.projects.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`panel-project-card ${item.id === data.project.id ? 'selected' : ''}`}
                onClick={() => openProject(item.id)}
              >
                <div className="panel-project-top">
                  <span>
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {stageLabels[item.stage] || 'Proyecto'}
                  </span>
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>{clientNameFor(item.client)}</p>
                </div>
                <div className="panel-project-bottom">
                  <span>
                    <CalendarDays size={14} />{' '}
                    {item.dueDate ? shortDate(item.dueDate) : 'Sin plazo'}
                  </span>
                  <strong>
                    {progress(item.id) === null ? '—' : `${progress(item.id)}%`}
                  </strong>
                </div>
                <div
                  className="panel-progress"
                  aria-label={
                    progress(item.id) === null
                      ? 'Avance sin definir'
                      : `${progress(item.id)}% completado`
                  }
                >
                  <span style={{ width: `${progress(item.id) ?? 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="workspace-section panel-detail" id="project-detail">
        <div className="workspace-section-head">
          <div>
            <p className="workspace-eyebrow">PROYECTO SELECCIONADO</p>
            <h2>{data.project.name}</h2>
            <p className="workspace-muted">
              {data.viewer.guest
                ? 'Seguimiento del proyecto'
                : clientNameFor(data.project.client)}
            </p>
          </div>
          {data.viewer.permissions.panel === 'edit' && (
            <div className="panel-detail-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => void copySummary()}
              >
                <Copy size={15} /> Copiar resumen
              </button>
              <button
                className="workspace-secondary"
                onClick={() => {
                  setProjectDraft({
                    stage: data.project.stage,
                    description: data.project.description,
                    progress:
                      data.project.progress === null
                        ? ''
                        : String(data.project.progress),
                    startDate: data.project.startDate || '',
                    dueDate: data.project.dueDate || '',
                  });
                  setEditingProject((value) => !value);
                }}
              >
                <Pencil size={15} />{' '}
                {editingProject ? 'Cerrar edición' : 'Editar seguimiento'}
              </button>
            </div>
          )}
        </div>
        {editingProject && (
          <div className="workspace-form-card">
            <div className="workspace-form-grid">
              <label>
                Etapa
                <select
                  value={projectDraft.stage}
                  onChange={(event) =>
                    setProjectDraft({
                      ...projectDraft,
                      stage: event.target.value,
                    })
                  }
                >
                  {stageOrder.map((stage) => (
                    <option key={stage} value={stage}>
                      {stageLabels[stage]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Inicio
                <input
                  type="date"
                  value={projectDraft.startDate}
                  onChange={(event) =>
                    setProjectDraft({
                      ...projectDraft,
                      startDate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Entrega prevista
                <input
                  type="date"
                  value={projectDraft.dueDate}
                  onChange={(event) =>
                    setProjectDraft({
                      ...projectDraft,
                      dueDate: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Avance estimado (opcional)
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Si queda vacío, se calcula con tareas"
                value={projectDraft.progress}
                onChange={(event) =>
                  setProjectDraft({
                    ...projectDraft,
                    progress: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Nota del proyecto
              <textarea
                rows={3}
                placeholder="Objetivos, contexto o próximos pasos"
                value={projectDraft.description}
                onChange={(event) =>
                  setProjectDraft({
                    ...projectDraft,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <button
              className="workspace-primary"
              disabled={busy}
              onClick={() => void saveProject()}
            >
              Guardar seguimiento
            </button>
          </div>
        )}
        <div className="panel-project-summary">
          <div>
            <span>ETAPA ACTUAL</span>
            <strong>{stageLabels[data.project.stage] || 'Idea'}</strong>
          </div>
          <div>
            <span>INICIO</span>
            <strong>{shortDate(data.project.startDate)}</strong>
          </div>
          <div>
            <span>ENTREGA PREVISTA</span>
            <strong>{shortDate(data.project.dueDate)}</strong>
          </div>
          <div>
            <span>AVANCE</span>
            <strong>
              {progress(data.project.id) === null
                ? 'Sin definir'
                : `${progress(data.project.id)}%`}
            </strong>
          </div>
        </div>
        {data.project.description && (
          <p className="panel-description">{data.project.description}</p>
        )}
        <div className="panel-stage-track" aria-label="Etapas del proyecto">
          {stageOrder.map((stage, index) => (
            <span
              key={stage}
              className={
                index <= stageOrder.indexOf(data.project.stage) ? 'active' : ''
              }
              title={stageLabels[stage]}
            />
          ))}
        </div>
      </section>
      <section className="workspace-section panel-budget" id="presupuesto">
        <div className="workspace-section-head">
          <div>
            <p className="workspace-eyebrow">CONTROL DEL PROYECTO</p>
            <h2>Presupuesto y decisiones</h2>
            <p className="workspace-muted">
              Lo que se define en el diseño, sin perder de vista su impacto.
            </p>
          </div>
          {data.viewer.permissions.panel === 'edit' && (
            <button
              className="workspace-primary"
              onClick={() => {
                setBudgetDraft(emptyBudgetItem);
                setShowBudgetForm((value) => !value);
              }}
            >
              <Plus size={17} /> Agregar partida
            </button>
          )}
        </div>
        {showBudgetForm && (
          <form
            className="workspace-form-card panel-budget-form"
            onSubmit={saveBudgetItem}
          >
            <div className="workspace-form-grid">
              <label className="wide">
                Partida
                <input
                  required
                  maxLength={160}
                  placeholder="Ej. Mobiliario de cocina"
                  value={budgetDraft.title}
                  onChange={(event) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Rubro
                <input
                  required
                  maxLength={80}
                  placeholder="Cocina"
                  value={budgetDraft.category}
                  onChange={(event) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      category: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Estimado
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={budgetDraft.planned}
                  onChange={(event) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      planned: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Comprometido
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={budgetDraft.committed}
                  onChange={(event) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      committed: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Estado
                <select
                  value={budgetDraft.status}
                  onChange={(event) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      status: event.target.value,
                    })
                  }
                >
                  {Object.entries(budgetStatusLabels).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="budget-visible-toggle">
                Visible para el cliente
                <span>
                  <input
                    type="checkbox"
                    checked={budgetDraft.clientVisible}
                    onChange={(event) =>
                      setBudgetDraft({
                        ...budgetDraft,
                        clientVisible: event.target.checked,
                      })
                    }
                  />
                  Compartir esta partida en el portal
                </span>
              </label>
            </div>
            <div className="panel-budget-form-actions">
              <button className="workspace-primary" disabled={busy}>
                {budgetDraft.id ? 'Guardar partida' : 'Agregar al presupuesto'}
              </button>
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => {
                  setBudgetDraft(emptyBudgetItem);
                  setShowBudgetForm(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
        <div className="panel-budget-overview">
          <div>
            <span>PRESUPUESTO BASE</span>
            <strong>{moneyFormat.format(budgetPlanned)}</strong>
            <small>
              {budgetItems.length
                ? `${budgetItems.length} ${budgetItems.length === 1 ? 'partida' : 'partidas'} cargadas`
                : 'Aún sin partidas'}
            </small>
          </div>
          <div>
            <span>COMPROMETIDO</span>
            <strong>{moneyFormat.format(budgetCommitted)}</strong>
            <small>Contratado, aprobado o pagado</small>
          </div>
          <div className={budgetDifference > 0 ? 'is-over' : ''}>
            <span>DESVÍO ACTUAL</span>
            <strong>
              {budgetItems.length
                ? `${budgetDifference > 0 ? '+' : ''}${moneyFormat.format(budgetDifference)}`
                : '—'}
            </strong>
            <small>
              {budgetDifference > 0
                ? 'Por encima de lo previsto'
                : budgetItems.length
                  ? 'Contra el presupuesto base'
                  : 'Cargá la primera partida'}
            </small>
          </div>
        </div>
        <div className="panel-budget-layout">
          <div className="panel-budget-table-wrap">
            <div className="panel-budget-table-head">
              <span>PARTIDA</span>
              <span>ESTIMADO</span>
              <span>COMPROMETIDO</span>
              <span>ESTADO</span>
              <span className="sr-only">Acciones</span>
            </div>
            {budgetItems.length ? (
              <div className="panel-budget-table">
                {budgetItems.map((item) => (
                  <div className="panel-budget-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.category}</small>
                    </div>
                    <span>{moneyFormat.format(item.planned)}</span>
                    <span>{moneyFormat.format(item.committed)}</span>
                    <span className={`budget-status ${item.status}`}>
                      {budgetStatusLabels[item.status] || 'Estimado'}
                    </span>
                    {data.viewer.permissions.panel === 'edit' ? (
                      <div className="panel-budget-actions">
                        <button
                          type="button"
                          title="Editar partida"
                          aria-label={`Editar ${item.title}`}
                          onClick={() => editBudgetItem(item)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar partida"
                          aria-label={`Eliminar ${item.title}`}
                          onClick={() => {
                            if (window.confirm(`¿Eliminar “${item.title}”?`))
                              void run({
                                action: 'delete-budget-item',
                                id: item.id,
                              });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-budget-empty">
                <Banknote size={24} />
                <div>
                  <strong>El presupuesto empieza por una partida.</strong>
                  <p>
                    Cargá estimados por rubro y vinculalos después a las
                    decisiones de diseño.
                  </p>
                </div>
              </div>
            )}
          </div>
          <aside className="panel-decisions-card">
            <div className="panel-decisions-icon">
              <ReceiptText size={18} />
            </div>
            <p className="workspace-eyebrow">PRÓXIMAS DEFINICIONES</p>
            <h3>
              {pendingProjectTasks.length
                ? `${pendingProjectTasks.length} ${pendingProjectTasks.length === 1 ? 'tema requiere' : 'temas requieren'} atención`
                : 'Todo claro por ahora'}
            </h3>
            <p>
              {pendingProjectTasks.length
                ? 'Concentrá la conversación con el cliente antes de comprometer costos o fechas.'
                : 'Las próximas decisiones y cambios aparecerán acá.'}
            </p>
            {pendingProjectTasks.slice(0, 3).map((task) => (
              <div className="panel-decision-item" key={task.id}>
                <span />
                {task.title}
              </div>
            ))}
            {!data.viewer.guest && (
              <a href="#tareas" className="workspace-text-button">
                Ver próximos pasos <ArrowRight size={15} />
              </a>
            )}
          </aside>
        </div>
      </section>
      {!data.viewer.guest && (
        <section className="workspace-section panel-tasks" id="tareas">
          <div className="workspace-section-head">
            <div>
              <p className="workspace-eyebrow">TRABAJO EN CURSO</p>
              <h2>Próximos pasos</h2>
            </div>
            {data.viewer.permissions.panel === 'edit' && (
              <button
                className="workspace-primary"
                onClick={() => {
                  setTaskDraft(emptyTask);
                  setShowTaskForm((value) => !value);
                }}
              >
                <Plus size={17} /> Agregar tarea
              </button>
            )}
          </div>
          {showTaskForm && (
            <form className="workspace-form-card" onSubmit={saveTask}>
              <div className="workspace-form-grid">
                <label className="wide">
                  Tarea
                  <input
                    required
                    maxLength={180}
                    placeholder="Ej. Revisar distribución del living"
                    value={taskDraft.title}
                    onChange={(event) =>
                      setTaskDraft({ ...taskDraft, title: event.target.value })
                    }
                  />
                </label>
                <label>
                  Inicio (opcional)
                  <input
                    type="date"
                    value={taskDraft.startDate}
                    onChange={(event) =>
                      setTaskDraft({ ...taskDraft, startDate: event.target.value })
                    }
                  />
                </label>
                <label>
                  Fecha límite
                  <input
                    type="date"
                    value={taskDraft.dueDate}
                    onChange={(event) =>
                      setTaskDraft({
                        ...taskDraft,
                        dueDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Responsable
                  <select
                    value={taskDraft.assignee}
                    onChange={(event) =>
                      setTaskDraft({
                        ...taskDraft,
                        assignee: event.target.value,
                      })
                    }
                  >
                    <option value="">Sin asignar</option>
                    {data.members
                      .filter((member) => member.accepted)
                      .map((member) => (
                        <option key={member.id} value={member.user || ''}>
                          {member.name || member.email}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    value={taskDraft.status}
                    onChange={(event) =>
                      setTaskDraft({ ...taskDraft, status: event.target.value })
                    }
                  >
                    <option value="todo">Pendiente</option>
                    <option value="doing">En curso</option>
                    <option value="done">Completada</option>
                  </select>
                </label>
                <label className="panel-task-visible-toggle">
                  <span>Visible para el cliente</span>
                  <span>
                    <input
                      type="checkbox"
                      checked={taskDraft.clientVisible}
                      onChange={(event) =>
                        setTaskDraft({ ...taskDraft, clientVisible: event.target.checked })
                      }
                    />
                    Mostrar como hito en el portal
                  </span>
                </label>
              </div>
              <button className="workspace-primary" disabled={busy}>
                {taskDraft.id ? 'Guardar cambios' : 'Guardar tarea'}
              </button>
            </form>
          )}
          <div
            className="panel-task-tabs"
            role="tablist"
            aria-label="Filtrar tareas"
          >
            {(
              [
                ['open', 'Pendientes'],
                ['all', 'Todas'],
                ['done', 'Completadas'],
              ] as const
            ).map(([key, label]) => (
              <button
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? 'active' : ''}
                key={key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {visibleTasks.length ? (
            <div className="panel-task-list">
              {visibleTasks.map((task) => {
                const member = data.members.find(
                  (item) => item.user === task.assignee,
                );
                return (
                  <div
                    className={`panel-task-row ${task.status === 'done' ? 'done' : ''}`}
                    key={task.id}
                  >
                    <button
                      className="panel-task-check"
                      type="button"
                      disabled={
                        data.viewer.permissions.panel !== 'edit' || busy
                      }
                      onClick={() =>
                        void setTaskStatus(
                          task,
                          task.status === 'done' ? 'todo' : 'done',
                        )
                      }
                      aria-label={
                        task.status === 'done'
                          ? 'Marcar pendiente'
                          : 'Marcar completada'
                      }
                    >
                      {task.status === 'done' ? (
                        <Check size={16} />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <div className="panel-task-main">
                      <strong>{task.title}</strong>
                      <span>
                        {member?.name || member?.email || 'Sin asignar'} ·{' '}
                        {task.status === 'doing'
                          ? 'En curso'
                          : task.status === 'done'
                            ? 'Completada'
                            : 'Pendiente'}
                      </span>
                    </div>
                    <span
                      className={
                        task.dueDate &&
                        task.dueDate < dates.today &&
                        task.status !== 'done'
                          ? 'overdue'
                          : ''
                      }
                    >
                      <Clock3 size={14} /> {shortDate(task.dueDate)}
                    </span>
                    {data.viewer.permissions.panel === 'edit' && (
                      <button
                        type="button"
                        className="panel-task-delete"
                        title="Editar tarea"
                        aria-label={`Editar ${task.title}`}
                        onClick={() => {
                          setTaskDraft({
                            id: task.id,
                            title: task.title,
                            startDate: task.startDate || '',
                            dueDate: task.dueDate || '',
                            clientVisible: task.clientVisible === 1,
                            assignee: task.assignee || '',
                            status: task.status,
                          });
                          setShowTaskForm(true);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {data.viewer.permissions.panel === 'edit' && (
                      <button
                        className="panel-task-delete"
                        type="button"
                        title="Eliminar tarea"
                        aria-label="Eliminar tarea"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar “${task.title}”?`))
                            void run({ action: 'delete-task', id: task.id });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="workspace-empty-state">
              <ListTodo size={28} />
              <strong>
                {filter === 'done'
                  ? 'Todavía no hay tareas completadas'
                  : 'Todo al día'}
              </strong>
              <p>
                {filter === 'done'
                  ? 'Las tareas cerradas aparecerán aquí.'
                  : 'Agregá una tarea para organizar el siguiente paso.'}
              </p>
            </div>
          )}
        </section>
      )}
      {newProject && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setNewProject(false)}
          />
          <form className="workspace-modal" onSubmit={createProject}>
            <p className="workspace-eyebrow">NUEVO TRABAJO</p>
            <h2>Crear proyecto</h2>
            <p>
              Podés organizarlo desde el panel aunque todavía no tenga un modelo
              3D.
            </p>
            <label>
              Nombre del proyecto
              <input
                required
                maxLength={120}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Ej. Casa Olivos"
              />
            </label>
            <label>
              Cliente
              <select
                value={projectClient}
                onChange={(event) => setProjectClient(event.target.value)}
              >
                <option value="">Sin cliente por ahora</option>
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="workspace-text-button"
              onClick={() => {
                setNewProject(false);
                setNewClient(true);
              }}
            >
              <Plus size={15} /> Agregar cliente
            </button>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setNewProject(false)}
              >
                Cancelar
              </button>
              <button className="workspace-primary" disabled={busy}>
                <FolderPlus size={16} /> Crear proyecto
              </button>
            </div>
          </form>
        </div>
      )}
      {newClient && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setNewClient(false)}
          />
          <form className="workspace-modal" onSubmit={createClient}>
            <p className="workspace-eyebrow">CARTERA</p>
            <h2>Agregar cliente</h2>
            <label>
              Nombre
              <input
                required
                maxLength={120}
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Ej. Familia Gómez"
              />
            </label>
            <label>
              Email (opcional)
              <input
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                placeholder="cliente@email.com"
              />
            </label>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setNewClient(false)}
              >
                Cancelar
              </button>
              <button className="workspace-primary" disabled={busy}>
                Agregar cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
