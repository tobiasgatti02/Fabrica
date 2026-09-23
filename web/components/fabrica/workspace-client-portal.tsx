'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Milestone,
} from 'lucide-react';
import {
  shortDate,
  stageLabels,
  type WorkspaceData,
  type WorkspaceTask,
} from '@/features/workspace/client';

export type PortalView = 'resumen' | 'calendario' | 'cronograma' | 'avance';
const views: { id: PortalView; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'avance', label: 'Avance' },
];
const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dayMs = 86_400_000;

function utcDate(value: string) {
  return new Date(`${value}T12:00:00Z`).getTime();
}
function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function statusLabel(status: string) {
  return status === 'done'
    ? 'Completado'
    : status === 'doing'
      ? 'En curso'
      : 'Pendiente';
}

export default function ClientPortal({
  data,
  selectedView,
  onSelectView,
  embedded = false,
}: {
  data: WorkspaceData;
  selectedView?: PortalView;
  onSelectView?: (view: PortalView) => void;
  embedded?: boolean;
}) {
  const [localView, setLocalView] = useState<PortalView>('resumen');
  const view = selectedView ?? localView;
  const setView = onSelectView ?? setLocalView;
  const [monthOffset, setMonthOffset] = useState(0);
  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parts;
  }, []);
  const tasks = useMemo(
    () =>
      data.tasks
        .filter((task) => task.project === data.project.id)
        .sort((a, b) =>
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
        ),
    [data.tasks, data.project.id],
  );
  const dated = tasks.filter((task) => task.dueDate);
  const upcoming = dated.filter(
    (task) => task.status !== 'done' && task.dueDate! >= today,
  );
  const completed = tasks.filter((task) => task.status === 'done').length;
  const progressItemLabel = data.viewer.guest
    ? tasks.length === 1
      ? 'hito compartido completado'
      : 'hitos compartidos completados'
    : tasks.length === 1
      ? 'tarea completada'
      : 'tareas completadas';
  const reportedProgress = data.project.progress;
  const progress =
    reportedProgress ??
    (tasks.length ? Math.round((completed / tasks.length) * 100) : null);
  const budget = data.budgetItems;
  const planned = budget.reduce((sum, item) => sum + item.planned, 0);
  const committed = budget.reduce((sum, item) => sum + item.committed, 0);
  const money = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
  const currentMonth = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + monthOffset;
  const first = new Date(year, month, 1);
  const calendarYear = first.getFullYear();
  const calendarMonth = first.getMonth();
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => index - firstWeekday + 1,
  );
  const timelineItems: {
    id: string;
    title: string;
    start: string;
    end: string;
    status: string;
    project?: boolean;
  }[] = [
    ...(data.project.startDate && data.project.dueDate
      ? [
          {
            id: 'project',
            title: data.project.name,
            start: data.project.startDate,
            end: data.project.dueDate,
            status: 'doing',
            project: true,
          },
        ]
      : []),
    ...tasks
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: task.id,
        title: task.title,
        start: task.startDate || task.dueDate!,
        end: task.dueDate!,
        status: task.status,
      })),
  ];
  const start = timelineItems.length
    ? Math.min(...timelineItems.map((item) => utcDate(item.start)))
    : 0;
  const end = timelineItems.length
    ? Math.max(...timelineItems.map((item) => utcDate(item.end)))
    : 0;
  const span = Math.max(dayMs, end - start + dayMs);
  const timelineTicks = timelineItems.length
    ? Array.from({ length: 5 }, (_, index) =>
        new Date(start + ((span - dayMs) * index) / 4).toLocaleDateString(
          'es-AR',
          { day: 'numeric', month: 'short', timeZone: 'UTC' },
        ),
      )
    : [];

  return (
    <div
      className={`${embedded ? 'client-portal embedded' : 'workspace-content client-portal'}`}
    >
      {!embedded && (
        <header className="client-portal-heading">
          <p className="workspace-eyebrow">SEGUIMIENTO DEL PROYECTO</p>
          <h1>{data.project.name}</h1>
          <p>
            {data.project.description ||
              'Toda la información compartida sobre el proyecto, en un solo lugar.'}
          </p>
        </header>
      )}
      {!embedded && (
        <nav className="client-view-nav" aria-label="Vistas del proyecto">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      {view === 'resumen' && (
        <>
          <section className="client-overview-grid" aria-label="Estado general">
            <div className="client-overview-feature">
              <span>ESTADO ACTUAL</span>
              <strong>
                {stageLabels[data.project.stage] || 'Proyecto en marcha'}
              </strong>
              <p>
                {progress === null
                  ? 'El avance se publicará cuando haya información suficiente.'
                  : `${progress}% de avance estimado`}
              </p>
              {progress !== null && (
                <progress
                  className="client-progress-track"
                  aria-label="Avance del proyecto"
                  value={progress}
                  max={100}
                >
                  {progress}%
                </progress>
              )}
            </div>
            <div className="client-overview-stat">
              <span>ENTREGA PREVISTA</span>
              <strong>{shortDate(data.project.dueDate)}</strong>
              <small>Fecha estimada</small>
            </div>
            <div className="client-overview-stat">
              <span>PRÓXIMOS HITOS</span>
              <strong>{upcoming.length}</strong>
              <small>Con fecha confirmada</small>
            </div>
          </section>
          <section className="client-portal-section">
            <div className="client-section-heading">
              <div>
                <p className="workspace-eyebrow">LO QUE SIGUE</p>
                <h2>Próximos hitos</h2>
              </div>
              <button type="button" onClick={() => setView('calendario')}>
                Ver calendario <ChevronRight size={16} />
              </button>
            </div>
            {upcoming.length ? (
              <div className="client-milestone-list">
                {upcoming.slice(0, 4).map((task) => (
                  <MilestoneRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <Empty text="No hay hitos próximos publicados." />
            )}
          </section>
        </>
      )}
      {view === 'calendario' && (
        <section className="client-portal-section">
          <div className="client-section-heading">
            <div>
              <p className="workspace-eyebrow">
                {data.viewer.guest
                  ? 'FECHAS COMPARTIDAS'
                  : 'FECHAS DEL PROYECTO'}
              </p>
              <h2>Calendario</h2>
            </div>
            <div className="client-month-controls">
              <button
                type="button"
                onClick={() => setMonthOffset((value) => value - 1)}
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <strong>
                {monthNames[calendarMonth]} {calendarYear}
              </strong>
              <button
                type="button"
                onClick={() => setMonthOffset((value) => value + 1)}
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div
            className="client-calendar"
            aria-label={`${monthNames[calendarMonth]} ${calendarYear}`}
          >
            {weekdays.map((day, index) => (
              <div className="client-calendar-weekday" key={index}>
                {day}
              </div>
            ))}
            {cells.map((day, index) => {
              const key = dateKey(calendarYear, calendarMonth, day);
              const events =
                day > 0 && day <= daysInMonth
                  ? dated.filter((task) => task.dueDate === key)
                  : [];
              const delivery =
                data.project.dueDate === key && day > 0 && day <= daysInMonth;
              return (
                <div
                  className={`client-calendar-day ${day < 1 || day > daysInMonth ? 'outside' : ''} ${key === today ? 'today' : ''}`}
                  key={index}
                >
                  <span>{day > 0 && day <= daysInMonth ? day : ''}</span>
                  {delivery && (
                    <div className="client-calendar-event delivery">
                      Entrega prevista
                    </div>
                  )}
                  {events.map((task) => (
                    <div
                      className={`client-calendar-event ${task.status}`}
                      key={task.id}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="client-view-note">
            El calendario muestra las fechas de entrega de los hitos
            {data.viewer.guest ? ' compartidos.' : ' del proyecto.'}
          </p>
        </section>
      )}
      {view === 'cronograma' && (
        <section className="client-portal-section">
          <div className="client-section-heading">
            <div>
              <p className="workspace-eyebrow">PLAN DEL PROYECTO</p>
              <h2>Cronograma</h2>
            </div>
          </div>
          {timelineItems.length ? (
            <div className="client-timeline-scroll">
              <div className="client-timeline">
                <div className="client-timeline-head">
                  <span>HITO</span>
                  <div>
                    {timelineTicks.map((tick, index) => (
                      <span key={index}>{tick}</span>
                    ))}
                  </div>
                </div>
                {timelineItems.map((item) => {
                  const left = ((utcDate(item.start) - start) / span) * 100;
                  const width = Math.max(
                    1.8,
                    ((utcDate(item.end) - utcDate(item.start) + dayMs) / span) *
                      100,
                  );
                  return (
                    <div className="client-timeline-row" key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.project
                            ? 'Proyecto completo'
                            : statusLabel(item.status)}
                        </small>
                      </div>
                      <div className="client-timeline-lane">
                        <span
                          className={`client-timeline-bar ${item.status} ${item.project ? 'project' : ''}`}
                          style={{
                            left: `${left}%`,
                            width: `${Math.min(width, 100 - left)}%`,
                          }}
                          title={`${shortDate(item.start)} — ${shortDate(item.end)}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Empty text="El cronograma aparecerá cuando se publiquen fechas del proyecto o hitos." />
          )}
          <p className="client-view-note">
            Las barras muestran el período planificado. Los hitos sin inicio
            figuran en su fecha de entrega.
          </p>
        </section>
      )}
      {view === 'avance' && (
        <>
          <section className="client-portal-section">
            <p className="workspace-eyebrow">ESTADO DEL TRABAJO</p>
            <h2>Avance</h2>
            <div className="client-progress-card">
              <div>
                <strong>{progress === null ? '—' : `${progress}%`}</strong>
                <span>
                  {reportedProgress === null
                    ? data.viewer.guest
                      ? 'Calculado con hitos compartidos'
                      : 'Calculado con tareas del proyecto'
                    : 'Avance estimado por el estudio'}
                </span>
              </div>
              {progress !== null && (
                <progress
                  className="client-progress-track"
                  aria-label="Avance del proyecto"
                  value={progress}
                  max={100}
                >
                  {progress}%
                </progress>
              )}
              <p>
                {tasks.length
                  ? `${completed} de ${tasks.length} ${progressItemLabel}`
                  : data.viewer.guest
                    ? 'Todavía no hay hitos publicados.'
                    : 'Todavía no hay tareas cargadas.'}
              </p>
            </div>
          </section>
          <section className="client-portal-section">
            <div className="client-section-heading">
              <div>
                <p className="workspace-eyebrow">
                  {data.viewer.guest
                    ? 'HITOS COMPARTIDOS'
                    : 'TAREAS DEL PROYECTO'}
                </p>
                <h2>
                  {data.viewer.guest
                    ? 'Estado de cada hito'
                    : 'Estado de cada tarea'}
                </h2>
              </div>
            </div>
            {tasks.length ? (
              <div className="client-milestone-list">
                {tasks.map((task) => (
                  <MilestoneRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <Empty text="Todavía no hay tareas para este proyecto." />
            )}
          </section>
          {budget.length > 0 && (
            <section className="client-portal-section">
              <p className="workspace-eyebrow">
                {data.viewer.guest ? 'PRESUPUESTO COMPARTIDO' : 'PRESUPUESTO'}
              </p>
              <h2>Presupuesto</h2>
              <div className="client-budget-summary">
                <div>
                  <span>ESTIMADO</span>
                  <strong>{money.format(planned)}</strong>
                </div>
                <div>
                  <span>COMPROMETIDO</span>
                  <strong>{money.format(committed)}</strong>
                </div>
              </div>
              <div className="client-milestone-list">
                {budget.map((item) => (
                  <div className="client-milestone-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.category}</small>
                    </div>
                    <span>{money.format(item.committed)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MilestoneRow({ task }: { task: WorkspaceTask }) {
  return (
    <div className="client-milestone-row">
      <div className={`client-milestone-icon ${task.status}`}>
        {task.status === 'done' ? <Check size={17} /> : <Milestone size={17} />}
      </div>
      <div>
        <strong>{task.title}</strong>
        <small>{statusLabel(task.status)}</small>
      </div>
      <span>
        <Clock3 size={14} />
        {shortDate(task.dueDate)}
      </span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="client-empty">
      <CalendarDays size={24} />
      <p>{text}</p>
    </div>
  );
}
