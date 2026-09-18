import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';

// DESIGN.md documents these as the substitutes for the licensed Coinbase faces.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const mono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'conceptcast',
  description: 'Research, draft, review and publish technical explainers.',
};

/** Applies the stored theme before first paint so there is no flash. */
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        {/* The login screen has no nav, so chrome lives in the (dashboard) group. */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
