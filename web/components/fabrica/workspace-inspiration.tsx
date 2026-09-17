'use client';

import { useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  ImagePlus,
  Link2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceViewProps } from './workspace';
import {
  assetUrl,
  categoryLabels,
  createImagePreview,
  inspirationStatusLabels,
  shortDate,
  uploadWorkspaceAsset,
} from '@/features/workspace/client';

export default function Inspiration({
  data,
  project,
  share,
  busy,
  run,
  notify,
}: WorkspaceViewProps) {
  const [category, setCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [itemCategory, setItemCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () =>
      data.inspiration
        .filter((item) => category === 'all' || item.category === category)
        .sort((a, b) => b.created - a.created),
    [data.inspiration, category],
  );
  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploading(true);
    try {
      const asset = file
        ? await uploadWorkspaceAsset(
            (await createImagePreview(file)) || file,
            project,
            share,
          )
        : '';
      await run({
        action: 'add-inspiration',
        title,
        note,
        url,
        asset,
        category: itemCategory,
      });
      setShowForm(false);
      setTitle('');
      setNote('');
      setUrl('');
      setFile(null);
      setItemCategory('general');
      notify('Referencia agregada al tablero');
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const update = async (
    id: string,
    status: string,
    currentCategory: string,
  ) => {
    try {
      await run({
        action: 'update-inspiration',
        id,
        status,
        category: currentCategory,
      });
    } catch {
      /* run shows the error */
    }
  };

  return (
    <div className="workspace-content inspiration-page">
      <section className="workspace-hero inspiration-hero">
        <div>
          <p className="workspace-eyebrow">
            TABLERO DE REFERENCIAS <span>·</span> {data.project.name}
          </p>
          <h1>
            De una imagen
            <br />
            <em>a una decisión.</em>
          </h1>
          <p className="workspace-lead">
            Juntá fotos, enlaces y materiales en un mismo lugar. El equipo y el
            cliente pueden sumar ideas; el estudio decide qué sigue.
          </p>
          <button
            className="workspace-primary hero-action"
            onClick={() => setShowForm(true)}
          >
            <Plus size={17} /> Agregar referencia
          </button>
        </div>
        <div className="inspiration-hero-art" aria-hidden="true">
          <span className="art-one" />
          <span className="art-two" />
          <span className="art-three" />
        </div>
      </section>
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="workspace-eyebrow">INSPIRACIÓN COMPARTIDA</p>
            <h2>
              {data.inspiration.length}{' '}
              {data.inspiration.length === 1 ? 'referencia' : 'referencias'}
            </h2>
          </div>
          <button
            className="workspace-secondary"
            onClick={() => setShowForm(true)}
          >
            <ImagePlus size={16} /> Nueva idea
          </button>
        </div>
        <div
          className="workspace-filter-row"
          role="tablist"
          aria-label="Categorías de referencias"
        >
          <button
            role="tab"
            aria-selected={category === 'all'}
            className={category === 'all' ? 'active' : ''}
            onClick={() => setCategory('all')}
          >
            Todas <span>{data.inspiration.length}</span>
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = data.inspiration.filter(
              (item) => item.category === key,
            ).length;
            return count ? (
              <button
                key={key}
                role="tab"
                aria-selected={category === key}
                className={category === key ? 'active' : ''}
                onClick={() => setCategory(key)}
              >
                {label} <span>{count}</span>
              </button>
            ) : null;
          })}
        </div>
        {items.length ? (
          <div className="inspiration-grid">
            {items.map((item, index) => (
              <article className="inspiration-card" key={item.id}>
                <div className={`inspiration-card-visual visual-${index % 5}`}>
                  {item.asset ? (
                    <Image
                      src={assetUrl(item.asset, project, share)}
                      alt={item.title}
                      width={640}
                      height={440}
                      unoptimized
                      loading="lazy"
                    />
                  ) : (
                    <div className="inspiration-link-art">
                      <Link2 size={29} />
                      <span>
                        {item.url
                          ? new URL(item.url).hostname.replace(/^www\./, '')
                          : 'Nota de inspiración'}
                      </span>
                    </div>
                  )}
                  {item.status !== 'idea' && (
                    <span className={`inspiration-card-status ${item.status}`}>
                      {inspirationStatusLabels[item.status]}
                    </span>
                  )}
                </div>
                <div className="inspiration-card-body">
                  <div className="inspiration-card-meta">
                    <span>{categoryLabels[item.category] || 'General'}</span>
                    <span>{shortDate(item.created)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.note && <p>{item.note}</p>}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir referencia <ArrowUpRight size={15} />
                    </a>
                  )}
                  <div className="inspiration-card-footer">
                    <span>Por {item.author}</span>
                    {data.viewer.canEdit && (
                      <div className="inspiration-card-controls">
                        <select
                          aria-label={`Estado de ${item.title}`}
                          value={item.status}
                          disabled={busy}
                          onChange={(event) =>
                            void update(
                              item.id,
                              event.target.value,
                              item.category,
                            )
                          }
                        >
                          {Object.entries(inspirationStatusLabels).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                        <button
                          type="button"
                          aria-label={`Eliminar ${item.title}`}
                          title="Eliminar referencia"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar “${item.title}”?`))
                              void run({
                                action: 'delete-inspiration',
                                id: item.id,
                              });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="workspace-empty-state inspiration-empty">
            <ImagePlus size={32} />
            <strong>
              {category === 'all'
                ? 'El tablero está esperando ideas'
                : 'No hay referencias en esta categoría'}
            </strong>
            <p>
              Subí una foto, pegá un enlace o dejá una nota. Todo queda
              conectado al proyecto.
            </p>
            <button
              className="workspace-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} /> Agregar primera referencia
            </button>
          </div>
        )}
      </section>
      {showForm && (
        <div className="workspace-modal-backdrop">
          <button
            type="button"
            className="workspace-backdrop-dismiss"
            aria-label="Cerrar ventana"
            onClick={() => setShowForm(false)}
          />
          <form className="workspace-modal inspiration-form" onSubmit={save}>
            <p className="workspace-eyebrow">SUMAR INSPIRACIÓN</p>
            <h2>Nueva referencia</h2>
            <p>
              Una imagen, un enlace o una nota alcanza para empezar la
              conversación.
            </p>
            <button
              type="button"
              className="workspace-dropzone"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files[0];
                if (dropped?.type.startsWith('image/')) setFile(dropped);
              }}
            >
              <UploadCloud size={23} />
              <strong>
                {file ? file.name : 'Arrastrá una imagen o elegí un archivo'}
              </strong>
              <small>
                JPG, PNG, WebP o AVIF · hasta {data.viewer.guest ? '20' : '500'}{' '}
                MB
              </small>
            </button>
            <input
              ref={fileInput}
              className="workspace-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label="Elegir imagen"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <label>
              Título
              <input
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Cocina en madera clara"
              />
            </label>
            <div className="workspace-form-grid">
              <label>
                Categoría
                <select
                  value={itemCategory}
                  onChange={(event) => setItemCategory(event.target.value)}
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Enlace (opcional)
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
            <label>
              Qué te gusta de esta referencia
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Texturas, ambiente, distribución..."
              />
            </label>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                className="workspace-primary"
                disabled={busy || uploading || (!file && !url && !note)}
              >
                {uploading ? 'Subiendo archivo…' : 'Agregar al tablero'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
