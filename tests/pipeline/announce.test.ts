import { describe, expect, it } from 'vitest';
import { announcementPrompt, assembleAnnouncement, normalizeHashtags } from '@/lib/announce';
import { checkHardConstraints, lengthLimits } from '@/lib/pipeline/constraints';

const topic = { title: 'System design', description: 'Backend services at scale.' };

// About 500 characters of plausible announcement text, one or two sentences per line.
const body = [
  'Our API fell over at 10x traffic last month and I could not explain why.',
  'So I am learning system design properly, in public, starting today.',
  'Here is what I am digging into first:',
  '→ How replication lag breaks consistency',
  '→ Why uniform hashing still creates hotspots',
  '→ Timeouts and retries that cause cascades',
  'I will share what I get wrong as well as what I get right.',
  'What do you wish you had learned first?',
].join('\n');

describe('announcement checks', () => {
  it('uses a shorter length range than regular posts', () => {
    expect(lengthLimits('announcement')).toEqual({ min: 300, max: 900 });
    expect(lengthLimits('post')).toEqual({ min: 1000, max: 1700 });
  });

  it('passes a well-formed announcement with five hashtags', () => {
    const full = assembleAnnouncement(body, ['SystemDesign', 'LearningInPublic', 'Backend', 'SoftwareEngineering', 'Scalability']);
    expect(checkHardConstraints(full, { kind: 'announcement' })).toEqual([]);
    // The same text is far too short to be a regular post, and has too many tags.
    const asPost = checkHardConstraints(full);
    expect(asPost.some((v) => v.startsWith('length'))).toBe(true);
    expect(asPost.some((v) => v.startsWith('hashtags: 5'))).toBe(true);
  });

  it('rejects six hashtags and out-of-range lengths', () => {
    const six = assembleAnnouncement(body, ['A', 'B', 'C', 'D', 'E', 'F']);
    // normalizeHashtags caps at five, so build six by hand.
    expect(checkHardConstraints(`${body}\n\n#A #B #C #D #E #F`, { kind: 'announcement' })).toContain('hashtags: 6 found (max 5)');
    expect(six.endsWith('#A #B #C #D #E')).toBe(true);
    expect(checkHardConstraints('Too short.\n\n#A #B #C', { kind: 'announcement' }).some((v) => v.startsWith('length'))).toBe(true);
    // The sample is about 410 characters, so it takes three copies to pass 900.
    expect(checkHardConstraints(`${body}\n${body}\n${body}\n\n#A #B #C`, { kind: 'announcement' }).some((v) => v.startsWith('length'))).toBe(true);
  });

  it('requires the last line before the hashtags to be a question', () => {
    const noQuestion = assembleAnnouncement(body.replace('What do you wish you had learned first?', 'More soon.'), ['A', 'B', 'C']);
    expect(checkHardConstraints(noQuestion, { kind: 'announcement' }).some((v) => v.startsWith('ending'))).toBe(true);
    const fullStop = assembleAnnouncement(body.replace('learned first?', 'learned first.'), ['A', 'B', 'C']);
    expect(checkHardConstraints(fullStop, { kind: 'announcement' }).some((v) => v.startsWith('ending'))).toBe(true);
    // Regular posts are not held to it.
    expect(checkHardConstraints(noQuestion).some((v) => v.startsWith('ending'))).toBe(false);
  });

  it('bans the "excited to start my journey" openers, only for announcements', () => {
    for (const opener of ['Excited to share that', 'Thrilled to announce', 'Day 1 of learning', 'Embarking on a new path']) {
      const text = assembleAnnouncement(`${opener} I am learning system design.\n${body}`, ['A', 'B', 'C']);
      expect(checkHardConstraints(text, { kind: 'announcement' }).some((v) => v.startsWith('hook: contains banned opener'))).toBe(true);
    }
    // Further down the post it is fine: only the first two lines are checked.
    const later = assembleAnnouncement(`${body}\nExcited to see where this goes.`, ['A', 'B', 'C']);
    expect(checkHardConstraints(later, { kind: 'announcement' }).some((v) => v.startsWith('hook'))).toBe(false);
  });
});

describe('hashtags and assembly', () => {
  it('cleans, dedupes and caps hashtags', () => {
    expect(normalizeHashtags(['#SystemDesign', 'system design', 'SystemDesign', 'Learning In Public', '#', '1abc', 'C', 'D', 'E', 'F'])).toEqual([
      'SystemDesign',
      'LearningInPublic',
      'C',
      'D',
      'E',
    ]);
  });

  it('puts every hashtag on the final line after a blank line', () => {
    const full = assembleAnnouncement('  Line one.\nLine two.  ', ['A', '#B', 'C']);
    expect(full).toBe('Line one.\nLine two.\n\n#A #B #C');
  });
});

describe('announcement prompt', () => {
  it('lists the subtopics and never promises a rhythm unless one is given', () => {
    const p = announcementPrompt(topic, ['Replication lag', 'Hotspots']);
    expect(p).toContain('# Topic\n\nSystem design\n\nBackend services at scale.');
    expect(p).toContain('- Replication lag\n- Hotspots');
    expect(p).toContain('(not given: do not promise a rhythm)');
    expect(p).not.toContain('# Why I am starting');
  });

  it('includes the reason and rhythm only when supplied, trimmed', () => {
    const p = announcementPrompt(topic, ['Replication lag'], { why: '  Our API fell over.  ', cadence: ' twice a week ' });
    expect(p).toContain('# Why I am starting\n\nOur API fell over.');
    expect(p).toContain('# How often I will post\n\ntwice a week');
    expect(p).not.toContain('not given');
    expect(announcementPrompt(topic, [], { why: '   ' })).not.toContain('# Why I am starting');
  });

  it('asks for a general description, not an invented syllabus, when there are no subtopics', () => {
    expect(announcementPrompt(topic, [])).toContain('do not invent a syllabus');
  });
});
