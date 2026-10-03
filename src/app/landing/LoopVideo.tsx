'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The walkthrough clip, made cheap for slow phones and slow networks:
 *
 *  - The still frame underneath is a native lazy image (WebP, JPEG fallback),
 *    so it does not compete with the fonts and scripts on first load. A
 *    poster attribute would be fetched immediately, even off-screen.
 *  - The video itself downloads only when the player nears the viewport, and
 *    plays only while visible, so a low-end CPU is not decoding 1080p video
 *    nobody is looking at.
 *  - Visitors who asked for reduced motion or reduced data (Save-Data, 2G)
 *    keep the still frame and download no video at all.
 *
 * Without JavaScript the still frame renders, which is also what crawlers see.
 */
export function LoopVideo({
  src,
  poster,
  posterWebp,
  label,
}: {
  src: string;
  poster: string;
  posterWebp?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = Boolean(conn?.saveData) || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (reducedMotion || saveData) return;

    // Very old browsers without IntersectionObserver: just load and play.
    if (typeof IntersectionObserver === 'undefined') {
      setLoad(true);
      return;
    }

    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true);
          near.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    near.observe(video);

    const visible = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void video.play().catch(() => undefined);
          else video.pause();
        }
      },
      { threshold: 0.25 },
    );
    visible.observe(video);

    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, []);

  // Start as soon as the source is attached, if it is on screen.
  useEffect(() => {
    if (!load) return;
    const video = ref.current;
    if (!video) return;
    video.load();
    const rect = video.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) void video.play().catch(() => undefined);
  }, [load]);

  return (
    <div className="relative aspect-video w-full bg-black">
      <picture>
        {/* Phones get the 640px frame; the player is at most 960px wide. */}
        {posterWebp && (
          <source
            srcSet={`${posterWebp.replace(/\.webp$/, '-640.webp')} 640w, ${posterWebp} 1280w`}
            sizes="(max-width: 1000px) 100vw, 960px"
            type="image/webp"
          />
        )}
        <img
          src={poster}
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      <video
        ref={ref}
        // Hidden until the first frame is ready, so the still frame shows
        // instead of a black box while the clip buffers.
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${
          playing ? 'opacity-100' : 'opacity-0'
        }`}
        width={1920}
        height={1080}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        aria-label={label}
        onPlaying={() => setPlaying(true)}
      >
        {load && <source src={src} type="video/mp4" />}
      </video>
    </div>
  );
}
