'use client';

import { useRef, useState, type SyntheticEvent } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileText,
  MessageCircle,
  Plus,
  Send,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import {
  assetUrl,
  createImagePreview,
  shortDate,
  uploadWorkspaceAsset,
} from '@/features/workspace/client';

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  approved: 'Decisión tomada',
  changes: 'Pide cambios',
};

export default function Proposals({
  data,
  project,
  share,
  busy,
  run,
  notify,
}: WorkspaceViewProps) {
  const [active, setActive] = useState(data.proposals.at(-1)?.id || '');
  const [showProposal, setShowProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [showOption, setShowOption] = useState(false);
  const [optionTitle, setOptionTitle] = useState('');
  const [optionDescription, setOptionDescription] = useState('');
  const [optionCost, setOptionCost] = useState('');
  const [optionTime, setOptionTime] = useState('');
  const [optionUrl, setOptionUrl] = useState('');
  const [optionFile, setOptionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState('');
  const [chosenOption, setChosenOption] = useState('');
  const proposals = [...data.proposals].sort((a, b) => b.created - a.created);
  const proposal =
    data.proposals.find((item) => item.id === active) || proposals[0];
  const options = data.options.filter((item) => item.proposal === proposal?.id);
  const comments = data.feedback
    .filter((item) => item.proposal === proposal?.id)
    .sort((a, b) => b.created - a.created);

  const createProposal = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await run({
        action: 'create-proposal',
        title: proposalTitle,
        description: proposalDescription,
      });
      setShowProposal(false);
      setProposalTitle('');
      setProposalDescription('');
      notify('Propuesta creada. Agregá alternativas para compartirla.');
    } catch {
      /* run shows the error */
    }
  };
  const createOption = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposal) return;
    setUploading(true);
    try {
      const asset = optionFile
        ? await uploadWorkspaceAsset(optionFile, project, share)
        : '';
      const previewFile =
        optionFile && optionFile.size > 700_000
          ? await createImagePreview(optionFile, 1400)
          : null;
      const previewAsset = previewFile
        ? await uploadWorkspaceAsset(previewFile, project, share)
        : '';
      await run({
        action: 'add-option',
        proposal: proposal.id,
        title: optionTitle,
        description: optionDescription,
        costNote: optionCost,
        timeNote: optionTime,
        url: optionUrl,
        asset,
        previewAsset,
      });
      setShowOption(false);
      setOptionTitle('');
      setOptionDescription('');
      setOptionCost('');
      setOptionTime('');
      setOptionUrl('');
      setOptionFile(null);
      notify('Alternativa agregada');
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const decide = async (kind: string) => {
    if (!proposal) return;
    try {
      await run({
        action: 'proposal-feedback',
        proposal: proposal.id,
        option: chosenOption,
        kind,
        text: feedback,
      });
      setFeedback('');
      if (kind === 'approve') notify('Elección registrada en el proyecto');
      else notify('Tu respuesta quedó registrada');
    } catch {
      /* run shows the error */
    }
  };
  const publish = async (status: string) => {
    if (!proposal) return;
    try {
      await run({ action: 'set-proposal-status', id: proposal.id, status });
      notify(
        status === 'review'
          ? 'Propuesta lista para el cliente'
          : 'Propuesta guardada como borrador',
      );
    } catch {
      /* run shows the error */
    }
  };

  return (
    <div className="workspace-content proposals-page">
      <section className="workspace-hero proposals-hero">
        <div>
          <p className="workspace-eyebrow">
            ALTERNATIVAS Y DECISIONES <span>·</span> {data.project.name}
          </p>
          <h1>
            Comparar juntos.
            <br />
            <em>Decidir con claridad.</em>
          </h1>
          <p className="workspace-lead">
            Renders, archivos y argumentos de cada opción quedan juntos. Cada
            respuesta conserva quién decidió y cuándo.
          </p>
          {data.viewer.canEdit && (
            <button
              className="workspace-primary hero-action"
              onClick={() => setShowProposal(true)}
            >
              <Plus size={17} /> Nueva propuesta
            </button>
          )}
        </div>
        <div className="proposals-hero-art" aria-hidden="true">
          <div>A</div>
          <div>B</div>
          <span>↔</span>
        </div>
      </section>
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="workspace-eyebrow">CONVERSACIONES DE DISEÑO</p>
            <h2>Propuestas</h2>
          </div>
          <span className="workspace-count">
            {proposals.length}{' '}
            {proposals.length === 1 ? 'propuesta' : 'propuestas'}
          </span>
        </div>
        {proposals.length ? (
          <div className="proposal-layout">
            <aside className="proposal-list" aria-label="Lista de propuestas">
              {proposals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${item.title}, ${statusLabels[item.status]}`}
                  className={item.id === proposal?.id ? 'active' : ''}
                  onClick={() => {
                    setActive(item.id);
                    setChosenOption('');
                    setFeedback('');
                  }}
                >
                  <span className={`proposal-status-dot ${item.status}`} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {statusLabels[item.status]} · {shortDate(item.created)}
                    </small>
                  </span>
                </button>
              ))}
            </aside>
            {proposal && (
              <div className="proposal-detail">
                <div className="proposal-detail-head">
                  <div>
                    <span className={`workspace-status ${proposal.status}`}>
                      {statusLabels[proposal.status]}
                    </span>
                    <h3>{proposal.title}</h3>
                    {proposal.description && <p>{proposal.description}</p>}
                  </div>
                  {data.viewer.canEdit && (
                    <div className="proposal-actions">
                      <button
                        className="workspace-secondary"
                        onClick={() => setShowOption(true)}
                      >
                        <Plus size={16} /> Alternativa
                      </button>
                      {proposal.status === 'draft' ||
                      proposal.status === 'changes' ? (
                        <button
                          className="workspace-primary"
                          disabled={!options.length || busy}
                          onClick={() => void publish('review')}
                        >
                          <Send size={15} /> Compartir
                        </button>
                      ) : proposal.status === 'review' ? (
                        <button
                          className="workspace-secondary"
                          onClick={() => void publish('draft')}
                        >
                          Volver a borrador
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {options.length ? (
                  <div className="proposal-options">
                    {options.map((option, index) => {
                      const asset = data.assets.find(
                        (item) => item.id === option.asset,
                      );
                      const displayAsset = option.previewAsset || option.asset;
                      const isImage = asset?.mime.startsWith('image/');
                      const selected = proposal.selectedOption === option.id;
                      return (
                        <article
                          key={option.id}
                          className={`proposal-option ${selected ? 'selected' : ''} ${chosenOption === option.id ? 'chosen' : ''}`}
                        >
                          <div className="proposal-option-visual">
                            {displayAsset && isImage ? (
                              <Image
                                src={assetUrl(displayAsset, project, share)}
                                alt={option.title}
                                width={640}
                                height={380}
                                unoptimized
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className={`proposal-option-placeholder visual-${index % 4}`}
                              >
                                <span>{String.fromCharCode(65 + index)}</span>
                                <span>
                                  {asset ? <FileText size={25} /> : 'VISTA'}
                                </span>
                              </div>
                            )}
                            {selected && (
                              <span className="proposal-selected">
                                <Check size={14} /> Elegida
                              </span>
                            )}
                          </div>
                          <div className="proposal-option-body">
                            <div className="proposal-option-number">
                              OPCIÓN {String.fromCharCode(65 + index)}
                            </div>
                            <h4>{option.title}</h4>
                            {option.description && <p>{option.description}</p>}
                            <div className="proposal-option-notes">
                              {option.costNote && (
                                <span>
                                  Inversión <strong>{option.costNote}</strong>
                                </span>
                              )}
                              {option.timeNote && (
                                <span>
                                  Plazo <strong>{option.timeNote}</strong>
                                </span>
                              )}
                            </div>
                            <div className="proposal-option-links">
                              {option.asset && (
                                <a
                                  href={assetUrl(option.asset, project, share)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={asset?.name}
                                >
                                  Ver archivo <ArrowUpRight size={14} />
                                </a>
                              )}
                              {option.url && (
                                <a
                                  href={option.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Abrir enlace <ArrowUpRight size={14} />
                                </a>
                              )}
                            </div>
                            {proposal.status !== 'draft' &&
                              !proposal.selectedOption && (
                                <button
                                  className={`proposal-choose ${chosenOption === option.id ? 'active' : ''}`}
                                  type="button"
                                  onClick={() => setChosenOption(option.id)}
                                >
                                  {chosenOption === option.id ? (
                                    <CheckCircle2 size={17} />
                                  ) : (
                                    <span className="radio-circle" />
                                  )}{' '}
                                  {chosenOption === option.id
                                    ? 'Seleccionada para responder'
                                    : 'Elegir esta opción'}
                                </button>
                              )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="workspace-empty-state">
                    <FileText size={28} />
                    <strong>Faltan las alternativas</strong>
                    <p>
                      Sumá renders, PDFs o archivos del colaborador para
                      comparar opciones en un mismo lugar.
                    </p>
                    {data.viewer.canEdit && (
                      <button
                        className="workspace-primary"
                        onClick={() => setShowOption(true)}
                      >
                        <Plus size={16} /> Agregar alternativa
                      </button>
                    )}
                  </div>
                )}
                {proposal.status !== 'draft' && (
                  <div className="proposal-conversation">
                    <div className="workspace-section-head compact">
                      <div>
                        <p className="workspace-eyebrow">
                          HISTORIAL DE DECISIONES
                        </p>
                        <h3>Conversación</h3>
                      </div>
                      <span>{comments.length} respuestas</span>
                    </div>
                    {comments.length ? (
                      <div className="proposal-feedback-list">
                        {comments.map((item) => (
                          <div key={item.id} className="proposal-feedback-item">
                            <span className="workspace-avatar">
                              {item.author.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <strong>
                                {item.author}{' '}
                                <small>· {shortDate(item.created)}</small>
                              </strong>
                              {item.kind !== 'comment' && (
                                <span className={`feedback-kind ${item.kind}`}>
                                  {item.kind === 'approve'
                                    ? 'Aprobó una alternativa'
                                    : 'Pidió cambios'}
                                </span>
                              )}
                              {item.text && <p>{item.text}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="workspace-muted">
                        Todavía no hay respuestas. Las decisiones quedarán
                        registradas acá.
                      </p>
                    )}
                    <div className="proposal-reply">
                      <label htmlFor="proposal-feedback">Tu respuesta</label>
                      <textarea
                        id="proposal-feedback"
                        rows={3}
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        placeholder="Dejá una observación o explicá tu elección…"
                      />
                      <div className="proposal-reply-actions">
                        <button
                          className="workspace-secondary"
                          disabled={!feedback.trim() || busy}
                          onClick={() => void decide('comment')}
                        >
                          <MessageCircle size={16} /> Comentar
                        </button>
                        <button
                          className="workspace-secondary"
                          disabled={busy}
                          onClick={() => void decide('changes')}
                        >
                          Pedir cambios
                        </button>
                        {!proposal.selectedOption && (
                          <button
                            className="workspace-primary"
                            disabled={!chosenOption || busy}
                            onClick={() => void decide('approve')}
                          >
                            <Check size={16} /> Aprobar opción
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-empty-state">
            <MessageCircle size={30} />
            <strong>Las decisiones empiezan con una propuesta</strong>
            <p>
              Creá un tema, sumá dos o más alternativas y compartilo para
              recibir una respuesta clara.
            </p>
            {data.viewer.canEdit && (
              <button
                className="workspace-primary"
                onClick={() => setShowProposal(true)}
              >
                <Plus size={16} /> Crear propuesta
              </button>
            )}
          </div>
        )}
      </section>
      {showProposal && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setShowProposal(false)}
          />
          <form className="workspace-modal" onSubmit={createProposal}>
            <p className="workspace-eyebrow">NUEVA PROPUESTA</p>
            <h2>¿Qué están decidiendo?</h2>
            <p>
              Una propuesta puede reunir varias soluciones para un ambiente,
              mueble o detalle.
            </p>
            <label>
              Título
              <input
                required
                maxLength={180}
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
                placeholder="Ej. Mobiliario del living"
              />
            </label>
            <label>
              Contexto
              <textarea
                rows={3}
                value={proposalDescription}
                onChange={(event) => setProposalDescription(event.target.value)}
                placeholder="Objetivo, restricciones o preguntas abiertas"
              />
            </label>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setShowProposal(false)}
              >
                Cancelar
              </button>
              <button className="workspace-primary" disabled={busy}>
                Crear propuesta
              </button>
            </div>
          </form>
        </div>
      )}
      {showOption && proposal && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setShowOption(false)}
          />
          <form className="workspace-modal option-form" onSubmit={createOption}>
            <p className="workspace-eyebrow">{proposal.title.toUpperCase()}</p>
            <h2>Agregar alternativa</h2>
            <button
              type="button"
              className="workspace-dropzone"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setOptionFile(event.dataTransfer.files[0] || null);
              }}
            >
              <UploadCloud size={23} />
              <strong>
                {optionFile
                  ? optionFile.name
                  : 'Arrastrá un render, PDF o archivo de diseño'}
              </strong>
              <small>
                Imágenes, documentos y archivos de modelo · hasta 500 MB
              </small>
            </button>
            <input
              ref={fileInput}
              className="workspace-file-input"
              type="file"
              aria-label="Elegir archivo de alternativa"
              onChange={(event) =>
                setOptionFile(event.target.files?.[0] || null)
              }
            />
            <label>
              Nombre de la opción
              <input
                required
                maxLength={180}
                value={optionTitle}
                onChange={(event) => setOptionTitle(event.target.value)}
                placeholder="Ej. Sofá modular + biblioteca baja"
              />
            </label>
            <label>
              Qué cambia
              <textarea
                rows={3}
                value={optionDescription}
                onChange={(event) => setOptionDescription(event.target.value)}
                placeholder="Materiales, distribución, ventajas..."
              />
            </label>
            <div className="workspace-form-grid">
              <label>
                Nota de costo
                <input
                  value={optionCost}
                  maxLength={180}
                  onChange={(event) => setOptionCost(event.target.value)}
                  placeholder="Ej. +10% estimado"
                />
              </label>
              <label>
                Nota de plazo
                <input
                  value={optionTime}
                  maxLength={180}
                  onChange={(event) => setOptionTime(event.target.value)}
                  placeholder="Ej. 2 semanas"
                />
              </label>
            </div>
            <label>
              Enlace complementario
              <input
                type="url"
                value={optionUrl}
                onChange={(event) => setOptionUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setShowOption(false)}
              >
                Cancelar
              </button>
              <button
                className="workspace-primary"
                disabled={busy || uploading}
              >
                {uploading ? 'Subiendo archivo…' : 'Agregar alternativa'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
