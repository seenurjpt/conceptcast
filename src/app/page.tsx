import { redirect } from 'next/navigation';

/** The review queue is the only screen that matters (spec §9), so it is home. */
export default function Home() {
  redirect('/review');
}
