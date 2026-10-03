import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

/**
 * The social preview card for LinkedIn, X, Slack and search results. Rendered
 * once at build time, so it costs nothing per request.
 */

export const alt = 'conceptcast: post what you are learning. Researched, not recalled.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          // Satori takes the colour and the gradient as separate properties.
          backgroundColor: '#000000',
          backgroundImage: 'radial-gradient(circle at 85% 10%, rgba(0,82,255,0.35) 0%, rgba(0,0,0,0) 45%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="52" height="52" viewBox="-1 -1 26 26" fill="none">
            <path d="M5 18 L12 11.5 L19 6" stroke="#4d8bff" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
            <circle cx="5" cy="18" r="3" fill="#4d8bff" opacity="0.6" />
            <circle cx="12" cy="11.5" r="3" fill="#4d8bff" opacity="0.8" />
            <circle cx="19" cy="6" r="4" fill="#4d8bff" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.03em' }}>
            Post what you are learning.
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            Researched, not recalled.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, fontSize: 26, color: 'rgba(255,255,255,0.7)' }}>
          {['Topic', 'Subtopics', 'Web research', 'Draft', 'Critique', 'You approve'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {i > 0 && <div style={{ color: 'rgba(255,255,255,0.3)' }}>›</div>}
              <div
                style={{
                  display: 'flex',
                  padding: '8px 16px',
                  borderRadius: 12,
                  border: i === 5 ? '1px solid rgba(77,139,255,0.7)' : '1px solid rgba(255,255,255,0.15)',
                  background: i === 5 ? 'rgba(0,82,255,0.2)' : 'rgba(255,255,255,0.04)',
                  color: i === 5 ? '#8fb5ff' : 'rgba(255,255,255,0.85)',
                }}
              >
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
