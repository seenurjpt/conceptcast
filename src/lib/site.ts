/**
 * Public identity of the site, for metadata, the sitemap, robots.txt, social
 * cards and structured data. One place, so the canonical URL never disagrees
 * with itself across those.
 *
 * Set NEXT_PUBLIC_SITE_URL to the production origin (https://example.com).
 * On Vercel the production domain is picked up automatically.
 */

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = 'conceptcast';

export const SITE_TITLE = 'conceptcast: researched LinkedIn posts on what you are learning';

/** Kept under about 160 characters: search results cut longer snippets. */
export const SITE_DESCRIPTION =
  'Turn what you are learning into researched LinkedIn posts. conceptcast suggests subtopics, researches each on the web, drafts in your voice and waits for approval.';

export const SITE_KEYWORDS = [
  'LinkedIn post generator',
  'technical LinkedIn posts',
  'AI writing assistant for engineers',
  'learn in public',
  'system design posts',
  'researched content',
  'developer personal brand',
  'bring your own API key',
];
