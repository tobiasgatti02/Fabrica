import type { Metadata } from 'next';
import Landing from '@/components/fabrica/landing';

export const metadata: Metadata = {
  title: 'Estudio virtual de arquitectura',
  description:
    'Presentá proyectos de arquitectura en 3D, compartí versiones y centralizá el feedback de tus clientes en un único espacio.',
  alternates: { canonical: '/' },
};

export default function Home() {
  return <>
    {/* Start the scene downloads from HTML, before the client-only renderer loads. */}
    <link rel="preload" href="/models/casa-patio-exterior.glb" as="fetch" crossOrigin="anonymous" />
    <link rel="preload" href="/environment/rosendal-plains-1k.hdr" as="fetch" crossOrigin="anonymous" />
    <link rel="preload" href="/draco/draco_wasm_wrapper.js" as="fetch" crossOrigin="anonymous" />
    <link rel="preload" href="/draco/draco_decoder.wasm" as="fetch" crossOrigin="anonymous" />
    <Landing />
  </>;
}
