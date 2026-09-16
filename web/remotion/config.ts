export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 60 * FPS;

export const captures = {
  landing: 'video-captures/landing-01-vision.png',
  dashboard: 'video-captures/studio-01-dashboard.png',
  version: 'video-captures/studio-02-version.png',
  comments: 'video-captures/studio-03-comments.png',
} as const;

export const copy = {
  intro: 'La arquitectura se entiende mejor cuando se puede recorrer.',
  product: 'Un estudio virtual para construir juntos.',
  workflow: 'De la versión a la conversación.',
  wow: 'Cada decisión, en su lugar.',
  close: 'Fabrica. El proyecto cambia. La conversación sigue.',
  cta: 'Entrá al estudio.',
} as const;