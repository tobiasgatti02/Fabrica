import type { MouseEvent } from 'react';

/** Use a document navigation while Vinext's client router is unavailable. */
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
