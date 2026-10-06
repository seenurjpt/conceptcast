import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { DialogProvider } from '@/components/Modal';
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// DESIGN.md documents these as the substitutes for the licensed Coinbase faces.
// Self-hosted by next/font: no third-party request, and swap means text shows
// in the fallback face at once on a slow connection. Only Inter is preloaded;
// the mono face is used for a few numbers and can arrive later.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'], display: 'swap', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_AUTHOR.name, url: SITE_AUTHOR.url }],
  creator: SITE_AUTHOR.name,
  publisher: SITE_AUTHOR.name,
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#000000' },
  ],
};

/**
 * Applies the stored theme before first paint so there is no flash. With no
 * stored choice the landing page starts dark; the app follows the system.
 * The app sidebar's collapsed state is applied the same way.
 */
const THEME_SCRIPT = `try{var d=document.documentElement;var t=localStorage.getItem('theme')||(location.pathname==='/'?'dark':(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));d.dataset.theme=t;d.dataset.sidebar=localStorage.getItem('sidebar')==='collapsed'?'collapsed':'expanded'}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        {/* The landing and login screens have no nav or session, so that chrome
            lives in the (dashboard) group. */}
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
