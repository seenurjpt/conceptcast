import { BrandLoader } from '@/components/BrandLoader';

/**
 * Between pages of the signed-in app: the sidebar and top bar stay put and
 * the loader fills the content area until the next page arrives.
 */
export default function Loading() {
  return <BrandLoader />;
}
