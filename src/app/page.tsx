import { redirect } from 'next/navigation';

/**
 * Topics first. The flow is: pick a concept, generate a post, review it.
 * The review queue is step two, so it is not the front door.
 */
export default function Home() {
  redirect('/backlog');
}
