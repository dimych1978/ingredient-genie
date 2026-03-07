// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';

export const viewport = 'width=device-width, initial-scale=1, maximum-scale=1';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9003',
  ),
  title: 'Telemetron',
  description: 'Панель управления вендинговыми аппаратами.',
  icons: {
    icon: [
      { url: '/icon-32.svg', type: 'image/svg+xml' },
      { url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'Telemetron',
    description: 'Панель управления вендинговыми аппаратами',
    siteName: 'Telemetron',
    images: [
      {
        url: '/icon-512.svg',
        width: 512,
        height: 512,
      },
    ],
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ru' className='dark' translate='no' suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin=''
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap'
          rel='stylesheet'
        />
        {/* Добавляем Leckerli One для иконок */}
        <link
          href='https://fonts.googleapis.com/css2?family=Leckerli+One&display=swap'
          rel='stylesheet'
        />
      </head>
      <body className='font-body antialiased'>
        <Providers>
          <div className='min-h-screen bg-background'>
            <div className='container mx-auto px-3 sm:px-4 max-w-7xl'>
              {children}
            </div>
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
