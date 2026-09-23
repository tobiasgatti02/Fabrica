export const site = {
  name: 'Fabrica',
  url: 'https://f4brica.app',
  locale: 'es_AR',
  description:
    'El estudio virtual para presentar proyectos de arquitectura, compartir versiones y conversar con clientes directamente sobre el espacio.',
  ogImage: '/images/fabrica-og.jpg',
} as const;

export function absoluteUrl(path = '/') {
  return new URL(path, site.url).toString();
}
