export const chapters = [
  { id: 'vision', at: 0, number: '01', label: 'La idea', title: ['Tu estudio.', 'En su mejor lugar.'], text: 'Un espacio de trabajo para compartir proyectos y avanzar junto a tus clientes.' },
  { id: 'construccion', at: .29, number: '02', label: 'La casa', title: ['La idea toma', 'forma.'], text: 'Del plano a la estructura: cada pieza encuentra su lugar.' },
  { id: 'recorrido', at: .57, number: '03', label: 'El recorrido', title: ['Entrá en', 'el proyecto.'], text: 'Los últimos detalles completan la casa. Después, recorré y decidí en contexto.' },
] as const;
export const INTERIOR_START = .9;
export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export function range(progress: number, start: number, end: number) {
  const t = clamp((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
}
export function chapterAt(progress: number) {
  let index = 0;
  chapters.forEach((chapter, i) => { if (progress >= chapter.at) index = i; });
  return index;
}
