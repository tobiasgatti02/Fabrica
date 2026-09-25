import type { MouseEvent } from 'react';

/** Explicit document navigation for entry, billing, and session transitions. */
export function hardNavigate(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) return;

  event.preventDefault();
  event.stopPropagation();
  window.location.assign(event.currentTarget.href);
}
