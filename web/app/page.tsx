import type { Metadata } from 'next';
import Landing from '@/components/fabrica/landing';

export const metadata: Metadata = {
  title: 'Estudio virtual de arquitectura',
  description:
    'Presentá proyectos de arquitectura en 3D, compartí versiones y centralizá el feedback de tus clientes en un único espacio.',
  alternates: { canonical: '/' },
};

export default function Home() {
  return <Landing />;
}
