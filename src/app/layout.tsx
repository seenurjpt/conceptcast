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
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme')||(location.pathname==='/'?'dark':(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.dataset.theme=t}catch(e){}`;

/**
 * Measures the scrollbar gutters <html> reserves on each edge and publishes
 * them as --gutter-left / --gutter-right, which .cover-gutters uses to stretch
 * full-screen layers (dialog backdrop, mobile menu) over those strips.
 *
 * Measured, not computed from 100vw: browsers disagree on whether vw includes
 * a reserved gutter, and newer Chromium excludes it, which makes any vw
 * formula come out as zero. A fixed box with left/right 0 starts and ends
 * exactly where the gutters do in every browser. Written to a <style> tag so
 * no React-managed element is mutated. Re-measured on resize and zoom.
 */
const GUTTER_SCRIPT = `(function(){var s=document.createElement('style');s.id='gutter-vars';document.head.appendChild(s);function m(){try{var p=document.createElement('div');p.style.cssText='position:fixed;left:0;right:0;top:0;height:0;visibility:hidden;pointer-events:none';document.body.appendChild(p);var r=p.getBoundingClientRect();var l=Math.max(0,Math.round(r.left)),g=Math.max(0,Math.round(window.innerWidth-r.right));p.remove();s.textContent=':root{--gutter-left:'+l+'px;--gutter-right:'+g+'px}'}catch(e){}}m();window.addEventListener('resize',m)})();`;

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
        <script dangerouslySetInnerHTML={{ __html: GUTTER_SCRIPT }} />
      </body>
    </html>
  );
}
