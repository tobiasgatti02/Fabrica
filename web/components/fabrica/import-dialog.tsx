'use client';
import { useRef, useState } from 'react';
import { Upload, FileBox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { extension, viewFormats } from './model-import';
import { studioRequest } from '@/features/studio/api';
import type { StoredFile, StoredProject } from '@/features/studio/domain';
export type {
  StoredFile,
  StoredProject,
  StoredVersion,
  StoredView,
} from '@/features/studio/domain';
type MultipartPart = { partNumber: number; etag: string };

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
  projects,
  activeProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (id: string, project: string) => Promise<void>;
  projects: StoredProject[];
  activeProject: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [primary, setPrimary] = useState('');
  const [title, setTitle] = useState('');
  const [upAxis, setUpAxis] = useState<'auto' | 'x' | 'y' | 'z'>('auto');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [project, setProject] = useState(activeProject);
  const cancelled = useRef(false);
  const currentUpload = useRef<string | null>(null);
  const pick = (list: File[]) => {
    setFiles(list);
    setPrimary(
      list.find((file) => viewFormats.includes(extension(file.name)))?.name ||
        list[0]?.name ||
        '',
    );
    setTitle(list[0]?.name.replace(/\.[^.]+$/, '') || '');
    setError('');
    setProgress(0);
  };
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const save = async () => {
    if (!files.length || !title.trim()) return;
    if (
      files.length > 200 ||
      files.some((f) => !f.size || f.size > 5 * 1024 ** 3)
    ) {
      setError('Elegí hasta 200 archivos, de hasta 5 GB cada uno.');
      return;
    }
    if (new Set(files.map((f) => f.name)).size !== files.length) {
      setError(
        'Hay nombres repetidos. Importá un paquete con nombres únicos o exportá como GLB.',
      );
      return;
    }
    setBusy(true);
    setError('');
    cancelled.current = false;
    let completedBytes = 0;
    try {
      const saved: StoredFile[] = [];
      for (const file of [...files].sort((a, b) =>
        a.name === primary ? -1 : b.name === primary ? 1 : 0,
      )) {
        if (cancelled.current) throw new Error('Importación cancelada.');
        const upload = await studioRequest(
          { action: 'begin', name: file.name, size: file.size },
          '',
          project,
        );
        currentUpload.current = upload.id;
        const parts: MultipartPart[] = [];
        for (
          let offset = 0, part = 1;
          offset < file.size;
          offset += upload.partSize, part++
        ) {
          if (cancelled.current) throw new Error('Importación cancelada.');
          const chunk = file.slice(offset, offset + upload.partSize);
          let result: MultipartPart | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const response = await fetch(
                `/api/studio?project=${encodeURIComponent(project)}&upload=${upload.id}&part=${part}`,
                { method: 'PUT', body: chunk },
              );
              const payload = (await response.json()) as MultipartPart & {
                error?: string;
              };
              if (!response.ok) throw new Error(payload.error);
              result = payload;
              break;
            } catch (error) {
              if (attempt === 2) throw error;
            }
          }
          if (!result)
            throw new Error('No se pudo guardar una parte del archivo.');
          parts.push(result);
          completedBytes += chunk.size;
          setProgress(Math.round((completedBytes / total) * 100));
        }
        const completed = await studioRequest(
          { action: 'finish', id: upload.id, parts },
          '',
          project,
        );
        saved.push({
          key: completed.key,
          name: completed.name,
          size: completed.size,
        });
        currentUpload.current = null;
      }
      if (cancelled.current) throw new Error('Importación cancelada.');
      const version = await studioRequest(
        {
          action: 'version',
          name: title,
          files: saved.map((f) => f.key),
          upAxis,
        },
        '',
        project,
      );
      await onImported(version.id, project);
      pick([]);
      onOpenChange(false);
    } catch (error) {
      setError((error as Error).message);
      if (currentUpload.current)
        await studioRequest(
          { action: 'abort', id: currentUpload.current },
          '',
          project,
        ).catch(() => {});
    } finally {
      currentUpload.current = null;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="import-dialog" showCloseButton={!busy}>
        <DialogTitle>Nueva versión</DialogTitle>
        <DialogDescription>
          Elegí el proyecto, nombrá la versión e importá el modelo con sus
          texturas. Se guardará como borrador hasta que lo publiques.
        </DialogDescription>
        <label
          className="import-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy) pick(Array.from(event.dataTransfer.files));
          }}
        >
          <Upload size={28} />
          <strong>Arrastrá tus archivos o elegilos</strong>
          <span>Modelo principal + texturas y recursos</span>
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={(event) => pick(Array.from(event.target.files || []))}
            aria-label="Seleccionar modelos y texturas"
          />
        </label>
        {!!files.length && (
          <div className="import-fields">
            <span>
              <FileBox size={16} /> {files.length} archivos ·{' '}
              {(total / 1024 ** 2).toFixed(1)} MB
            </span>
            <label>
              Proyecto
              <select
                value={project}
                disabled={busy}
                onChange={(event) => setProject(event.target.value)}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre de la entrega
              <input
                value={title}
                maxLength={150}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Archivo principal
              <select
                value={primary}
                disabled={busy}
                onChange={(event) => setPrimary(event.target.value)}
              >
                {files.map((file) => (
                  <option key={file.name}>{file.name}</option>
                ))}
              </select>
            </label>
            <label>
              Eje vertical
              <select
                value={upAxis}
                disabled={busy}
                onChange={(event) =>
                  setUpAxis(event.target.value as 'auto' | 'x' | 'y' | 'z')
                }
              >
                <option value="auto">Detectar automáticamente</option>
                <option value="y">Y hacia arriba</option>
                <option value="z">Z hacia arriba · CAD / FreeCAD</option>
                <option value="x">X hacia arriba</option>
              </select>
            </label>
          </div>
        )}
        <details className="import-formats">
          <summary>Compatibilidad y archivos grandes</summary>
          <p>
            <b>Visor:</b> GLB, glTF, DAE, OBJ + MTL, FBX, STL, PLY y 3DS.
          </p>
          <p>
            <b>SketchUp:</b> exportá GLB o DAE.{' '}
            <b>Blender, Rhino, 3ds Max, Maya, Cinema 4D:</b> usá alguno de los
            formatos del visor.
          </p>
          <p>
            <b>Revit, Archicad, AutoCAD y archivos SKP, RVT, PLN, DWG o IFC:</b>{' '}
            el original se puede guardar; para recorrerlo necesitás una
            exportación compatible. La conversión automática todavía no está
            disponible.
          </p>
          <p>
            Se guardan archivos de hasta 5 GB por archivo, en partes con
            reintentos. Vista interactiva hasta 200 MB por entrega; por encima
            se conserva el original para descargar. La fluidez depende también
            de geometría, texturas y dispositivo.
          </p>
        </details>
        {files.length > 0 &&
          (!viewFormats.includes(extension(primary)) ||
            total > 200 * 1024 ** 2) && (
            <p className="import-notice">
              Esta entrega se guardará como archivo original sin vista 3D.
              Importá una copia optimizada compatible para recorrerla.
            </p>
          )}
        {busy && (
          <div aria-live="polite">
            <progress value={progress} max={100} />{' '}
            <span>
              {progress}% ·{' '}
              {progress === 100 ? 'Guardando entrega…' : 'Subiendo archivos…'}
            </span>
          </div>
        )}
        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}
        <div className="import-actions">
          {busy ? (
            <Button
              variant="outline"
              onClick={() => {
                cancelled.current = true;
              }}
            >
              Cancelar subida
            </Button>
          ) : (
            <Button
              disabled={!files.length || !title.trim() || !project}
              onClick={save}
            >
              <Upload /> Guardar versión
            </Button>
          )}
          {busy && <Loader2 className="animate-spin" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
