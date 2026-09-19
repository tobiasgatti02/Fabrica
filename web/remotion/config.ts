export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 25 * FPS;

export const captures = {
  landing: 'video-captures/landing-01-vision.png',
  dashboard: 'video-captures/studio-01-dashboard.png',
  version: 'video-captures/studio-02-version.png',
  comments: 'video-captures/studio-03-comments.png',
  team: 'video-captures/studio-team.png',
  inspiration: 'video-captures/studio-inspiration.png',
  panel: 'video-captures/studio-panel.png',
} as const;

export const copy = {
  intro: 'Todo tu proyecto, en un solo lugar.',
  model: 'Recorré el modelo.',
  comments: 'Comentá en contexto.',
  team: 'Trabajá con tu equipo.',
  inspiration: 'Ordená la inspiración.',
  panel: 'Seguí cada avance.',
  product: 'Un estudio virtual para construir juntos.',
  workflow: 'De la versión a la conversación.',
  wow: 'Cada decisión, en su lugar.',
  close: 'De una idea, a un lugar.',
  cta: 'Entrá al estudio.',
} as const;
