import type { MetadataRoute } from 'next';

/** Makes the app installable and gives Android/Chrome the right icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'conceptcast',
    short_name: 'conceptcast',
    description: 'Researched LinkedIn posts on what you are learning.',
    start_url: '/backlog',
    display: 'standalone',
    background_color: '#0a0b0d',
    theme_color: '#0a0b0d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate art: maskable icons are cropped, so the mark needs safe-zone padding.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
