import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** The landing page is the only public content; everything else sits behind sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/login', '/dashboard', '/welcome', '/backlog', '/review', '/calendar', '/voice', '/analytics', '/settings', '/exemplars', '/admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
