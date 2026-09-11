export const chapters = [
  { id: 'vision', at: 0, number: '00', label: 'La visión', title: ['Todo empieza', 'con una idea.'], text: 'Un espacio por imaginar. Un proyecto por compartir. Una nueva forma de construirlo juntos.' },
  { id: 'cimientos', at: .13, number: '01', label: 'Los cimientos', title: ['Empezamos', 'desde cero.'], text: 'Cada gran espacio tiene un primer trazo. Dale a tu idea una base sobre la que crecer.' },
  { id: 'estructura', at: .27, number: '02', label: 'La estructura', title: ['Las ideas', 'toman forma.'], text: 'Del plano al volumen. Entendé las proporciones y descubrí cómo se conecta cada espacio.' },
  { id: 'cerramientos', at: .40, number: '03', label: 'Los espacios', title: ['Un adentro.', 'Un afuera.'], text: 'Las paredes definen encuentros. Las aberturas dibujan la luz. El proyecto empieza a sentirse.' },
  { id: 'terminaciones', at: .54, number: '04', label: 'Los detalles', title: ['La diferencia', 'se siente.'], text: 'Madera, piedra, luz. Cada decisión le da carácter al lugar que estás imaginando.' },
  { id: 'casa', at: .69, number: '05', label: 'El resultado', title: ['Ya no es', 'solo una idea.'], text: 'Es un lugar. Recorré el conjunto, compartí otra mirada y descubrí lo que pueden crear juntos.' },
  { id: 'interior', at: .77, number: '06', label: 'Habitar', title: ['Ahora,', 'pasá.'], text: 'Los mejores proyectos se entienden desde adentro.' },
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
