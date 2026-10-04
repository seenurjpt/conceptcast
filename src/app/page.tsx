import type { Metadata } from 'next';
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import { Landing } from './landing/Landing';
import { FAQ } from './landing/faq';

/**
 * The front door, rendered once at build time and served as a static file.
 * Signed-in visitors never reach it: the middleware redirects them to Topics
 * at the edge, from the cookie alone, so this page needs no database and no
 * per-request rendering.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
};

const AUTHOR = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#author`,
  name: SITE_AUTHOR.name,
  url: SITE_AUTHOR.url,
  sameAs: [SITE_AUTHOR.url],
};

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    AUTHOR,
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#author` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      author: { '@id': `${SITE_URL}/#author` },
      creator: { '@id': `${SITE_URL}/#author` },
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Content creation',
      operatingSystem: 'Web',
      image: `${SITE_URL}/opengraph-image`,
      featureList: [
        'AI-suggested subtopics for any technical topic',
        'Web research against primary sources with a URL per fact',
        'Drafts in your own voice from your past posts',
        'Automatic critique against a depth rubric',
        'Bring your own Anthropic, OpenAI or Gemini key',
        'Publish to LinkedIn only after your approval',
      ],
    },
    {
      '@type': 'VideoObject',
      name: 'conceptcast walkthrough',
      description:
        'Adding a topic, getting subtopics suggested, generating a researched LinkedIn post, and reviewing the draft.',
      thumbnailUrl: `${SITE_URL}/showcase-poster.jpg`,
      contentUrl: `${SITE_URL}/showcase-conceptcast.mp4`,
      uploadDate: '2026-10-03',
      duration: 'PT22S',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify never emits "</script>" here: the data is our own constants.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Landing />
    </>
  );
}
