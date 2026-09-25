import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark" aria-hidden="true">404</div>
      <section className="not-found-content" aria-labelledby="not-found-title">
        <p className="eyebrow"><span>404 /</span> Fuera de plano</p>
        <h1 id="not-found-title">Este espacio<br /><em>todavía no existe.</em></h1>
        <p>La página que buscás cambió de lugar o nunca estuvo en este proyecto.</p>
        <div className="not-found-actions">
          <Link className="solid-link" href="/"><ArrowLeft size={18} /> Volver al inicio</Link>
          <Link href="/estudio/panel">Entrar al estudio <ArrowUpRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
