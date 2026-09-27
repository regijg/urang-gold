import { Outfit } from 'next/font/google';
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import ChunkErrorBoundary from '@/components/ChunkErrorBoundary';
import NavigationProgress from '@/components/common/NavigationProgress';
import { Metadata } from 'next';

const outfit = Outfit({
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "GoldPOS | Sistem Toko Emas",
  description: "SaaS kasir, inventory, buyback, dan laporan untuk toko emas & perhiasan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className='dark'>
      <head>
        <meta name="theme-color" content="#C9A227" />
        <link rel="apple-touch-icon" href="/icons/goldpos-apple-180.png" />
        {/* Tangkap beforeinstallprompt + register SW sebelum React hydrate */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaInstallPrompt = e;
          });
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
            });
          }
        `}} />
      </head>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <NavigationProgress />
        <ThemeProvider>
          <SidebarProvider>
            <ChunkErrorBoundary>
              {children}
            </ChunkErrorBoundary>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
