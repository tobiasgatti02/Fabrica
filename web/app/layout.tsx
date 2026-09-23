import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { Toaster } from '@/components/ui/toast';
import { absoluteUrl, site } from '@/lib/site';
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
  metadataBase: new URL(site.url),
  title: {
    default: 'Fabrica — De una idea a un lugar',
    template: '%s | Fabrica',
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: 'Fabrica — De una idea a un lugar',
    description: site.description,
    images: [
      {
        url: site.ogImage,
        width: 1200,
        height: 630,
        alt: 'Fabrica: de una idea a un lugar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fabrica — De una idea a un lugar',
    description: site.description,
    images: [site.ogImage],
  },
  icons: { icon: '/favicon.svg' },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${site.url}/#organization`,
  name: site.name,
  url: site.url,
  logo: absoluteUrl('/favicon.svg'),
  description: site.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${serif.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c'),
          }}
        />
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
