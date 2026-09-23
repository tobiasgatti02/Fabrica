export const chapters = [
  { id: 'vision', at: 0, number: '00', label: 'La visión', title: ['Tu estudio.', 'En su mejor lugar.'], text: 'Un espacio de trabajo para compartir proyectos y avanzar junto a tus clientes.' },
  { id: 'cimientos', at: .13, number: '01', label: 'El proyecto', title: ['Todo empieza', 'en el estudio.'], text: 'Reuní el modelo y las referencias de cada trabajo en un mismo espacio.' },
  { id: 'estructura', at: .27, number: '02', label: 'La propuesta', title: ['Dale forma', 'a la propuesta.'], text: 'Presentá el proyecto en tres dimensiones y ayudá a ver cada espacio.' },
  { id: 'cerramientos', at: .40, number: '03', label: 'La revisión', title: ['Recorran', 'cada ambiente.'], text: 'Compartí una mirada cercana para que las decisiones sean más claras.' },
  { id: 'terminaciones', at: .54, number: '04', label: 'La conversación', title: ['Conversen', 'con contexto.'], text: 'Cada comentario queda junto al lugar y a la entrega que lo originó.' },
  { id: 'casa', at: .69, number: '05', label: 'La entrega', title: ['Cada cambio,', 'en su lugar.'], text: 'Publicá una nueva versión y mantené visible el recorrido del proyecto.' },
  { id: 'interior', at: .77, number: '06', label: 'El estudio', title: ['Ahora,', 'trabajen juntos.'], text: 'Un estudio online para presentar, revisar y avanzar.' },
] as const;
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
