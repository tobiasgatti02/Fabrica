export type Point = { x: number; y: number };
export const clipboardReferenceType = 'application/x-fabrica-inspiration';

type BoardContent =
  | { kind: 'files'; files: File[] }
  | { kind: 'reference'; id: string; project: string }
  | { kind: 'link'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' };

function webUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

// ClipboardEvent delivers the actual OS clipboard (including screenshots).
// Files take priority over text/html, which browsers often include alongside them.
export function boardClipboard(
  transfer: Pick<DataTransfer, 'files' | 'items' | 'getData'>,
): BoardContent {
  const files = Array.from(transfer.files || []);
  if (!files.length) {
    for (const item of Array.from(transfer.items || [])) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  if (files.length) return { kind: 'files', files };
  try {
    const ref = JSON.parse(transfer.getData(clipboardReferenceType)) as {
      id?: unknown;
      project?: unknown;
    };
    if (typeof ref.id === 'string' && typeof ref.project === 'string')
      return { kind: 'reference', id: ref.id, project: ref.project };
  } catch {
    /* Most pastes come from outside this board. */
  }
  const text = transfer.getData('text/plain').trim();
  const uri =
    transfer
      .getData('text/uri-list')
      .split(/\r?\n/)
      .find((line) => line.trim() && !line.startsWith('#'))
      ?.trim() || '';
  const url = webUrl(uri || text);
  if (url) return { kind: 'link', url };
  if (text) return { kind: 'text', text: text.slice(0, 2000) };
  return { kind: 'empty' };
}
