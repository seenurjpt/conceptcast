import { describe, expect, it } from 'vitest';
import { assemble, formatHashtags, normalizeHashtag } from '@/lib/linkedin/assemble';

const sections = {
  hook: 'Hook line.',
  rehook: 'Rehook line.',
  context: 'Context paragraph.',
  body: 'Body first.\n→ one\n→ two',
  takeaway: 'Takeaway.',
  cta: 'What do you do?',
};

describe('assemble', () => {
  it('joins sections with a blank line and appends hashtags on the last line', () => {
    const { assembled } = assemble(sections, ['LLM', 'Rag', 'Chunking']);
    expect(assembled).toBe(
      'Hook line.\n\nRehook line.\n\nContext paragraph.\n\nBody first.\n→ one\n→ two\n\nTakeaway.\n\nWhat do you do?\n\n#LLM #Rag #Chunking',
    );
  });

  it('keeps single newlines between list items inside the body', () => {
    const { assembled } = assemble(sections, ['a', 'b', 'c']);
    expect(assembled).toContain('Body first.\n→ one\n→ two');
    expect(assembled).not.toContain('→ one\n\n→ two');
  });

  it('formats hashtags: strips a leading # and internal whitespace, drops empties', () => {
    expect(normalizeHashtag('#Foo')).toBe('Foo');
    expect(normalizeHashtag(' vector db ')).toBe('vectordb');
    expect(formatHashtags(['#A', 'B', '', 'c d'])).toBe('#A #B #cd');
  });

  it('reports the LinkedIn char count of the assembled text (NFC, UTF-16 units)', () => {
    const { assembled, charCount } = assemble({ ...sections, hook: 'Café 🚀' }, ['x', 'y', 'z']);
    expect(charCount).toBe(assembled.normalize('NFC').length);
    const nfd = assemble({ ...sections, hook: 'Café 🚀' }, ['x', 'y', 'z']);
    expect(nfd.charCount).toBe(charCount);
  });

  it('skips empty sections without leaving double blank lines', () => {
    const { assembled } = assemble({ ...sections, rehook: '' }, ['a', 'b', 'c']);
    expect(assembled.startsWith('Hook line.\n\nContext paragraph.')).toBe(true);
    expect(assembled).not.toContain('\n\n\n');
  });
});
