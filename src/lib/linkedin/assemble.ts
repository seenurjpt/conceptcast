import { hookLength } from './charCount';

export interface DraftSections {
  hook: string;
  rehook: string;
  context: string;
  body: string;
  takeaway: string;
  cta: string;
}

export const SECTION_ORDER: (keyof DraftSections)[] = ['hook', 'rehook', 'context', 'body', 'takeaway', 'cta'];

/** `#Foo` and `Foo` both become `Foo`; whitespace inside a tag is removed. */
export function normalizeHashtag(h: string): string {
  return h.trim().replace(/^#+/, '').replace(/\s+/g, '');
}

export function formatHashtags(hashtags: string[]): string {
  return hashtags
    .map(normalizeHashtag)
    .filter((h) => h.length > 0)
    .map((h) => '#' + h)
    .join(' ');
}

/**
 * Sections joined by a blank line, hashtags on a final line. Lists inside the
 * body keep their single `\n` between `→ ` / `• ` items; that is the model's
 * job, this only joins.
 */
export function assemble(sections: DraftSections, hashtags: string[]): { assembled: string; charCount: number } {
  const parts = SECTION_ORDER.map((k) => (sections[k] ?? '').trim()).filter((s) => s.length > 0);
  const tags = formatHashtags(hashtags);
  const assembled = parts.join('\n\n') + (tags ? '\n\n' + tags : '');
  return { assembled, charCount: hookLength(assembled) };
}
