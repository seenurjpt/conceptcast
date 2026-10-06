import { BrandLoader } from '@/components/BrandLoader';

/** App-level loading: the whole screen, before any layout is ready. */
export default function Loading() {
  return <BrandLoader fullscreen />;
}
