import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { Toaster } from '@/components/ui/toast';
import './globals.css';
const sans = DM_Sans({
  variable: '--font-sans-fabrica',
  subsets: ['latin'],
  display: 'swap',
});
const serif = Instrument_Serif({
  variable: '--font-serif-fabrica',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
});
export const metadata: Metadata = {
  title: 'Fabrica — De una idea a un lugar',
  description:
    'Tu estudio virtual de arquitectura. Recorré tus proyectos, compartí cada versión y conversá con tus clientes sobre el espacio.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${serif.variable}`}>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
