import { describe, expect, it } from 'vitest';
import { announcementPrompt, assembleAnnouncement, normalizeHashtags } from '@/lib/announce';
import { checkHardConstraints, lengthLimits } from '@/lib/pipeline/constraints';

const topic = { title: 'System design', description: 'The parts that come up when designing backend services at scale.' };

// A short announcement in the new shape: topic, reason, what learning in public means, a question. No list.
const body = [
  'I am starting to learn system design, and I am going to do it in public.',
  'Our API fell over at 10x traffic last month and I could not explain why.',
  'I will share what I understand, and what I get wrong, as I go.',
  'Where would you start if you were learning it today?',
].join('\n\n');

describe('announcement checks', () => {
  it('uses a shorter length range than regular posts', () => {
    expect(lengthLimits('announcement')).toEqual({ min: 200, max: 700 });
    expect(lengthLimits('post')).toEqual({ min: 600, max: 1000 });
  });

  it('passes a well-formed announcement with five hashtags', () => {
    const full = assembleAnnouncement(body, ['SystemDesign', 'LearningInPublic', 'Backend', 'SoftwareEngineering', 'Scalability']);
    expect(checkHardConstraints(full, { kind: 'announcement' })).toEqual([]);
    // The same text is far too short to be a regular post, and has too many tags.
    const asPost = checkHardConstraints(full);
    expect(asPost.some((v) => v.startsWith('length'))).toBe(true);
    expect(asPost.some((v) => v.startsWith('hashtags: 5'))).toBe(true);
  });

  it('rejects any list: an announcement promises no syllabus', () => {
    for (const item of ['→ Replication lag', '• Replication lag', '- Replication lag', '1. Replication lag', '2) Replication lag']) {
      const listed = assembleAnnouncement(body.replace('as I go.', `as I go.\n${item}`), ['A', 'B', 'C']);
      expect(checkHardConstraints(listed, { kind: 'announcement' }).some((v) => v.startsWith('list:')), item).toBe(true);
    }
    // Regular posts may use arrow lists for steps.
    expect(checkHardConstraints(`${body}\n→ a step`).some((v) => v.startsWith('list:'))).toBe(false);
  });

  it('rejects six hashtags and out-of-range lengths', () => {
    expect(checkHardConstraints(`${body}\n\n#A #B #C #D #E #F`, { kind: 'announcement' })).toContain('hashtags: 6 found (max 5)');
    expect(assembleAnnouncement(body, ['A', 'B', 'C', 'D', 'E', 'F']).endsWith('#A #B #C #D #E')).toBe(true);
    expect(checkHardConstraints('Too short?\n\n#A #B #C', { kind: 'announcement' }).some((v) => v.startsWith('length'))).toBe(true);
    // The sample body is about 270 characters, so it takes three copies to pass 700.
    expect(checkHardConstraints(`${body}\n\n${body}\n\n${body}\n\n#A #B #C`, { kind: 'announcement' }).some((v) => v.startsWith('length'))).toBe(true);
  });

  it('requires the last line before the hashtags to be a question', () => {
    const noQuestion = assembleAnnouncement(body.replace('Where would you start if you were learning it today?', 'More soon.'), ['A', 'B', 'C']);
    expect(checkHardConstraints(noQuestion, { kind: 'announcement' }).some((v) => v.startsWith('ending'))).toBe(true);
    const fullStop = assembleAnnouncement(body.replace('learning it today?', 'learning it today.'), ['A', 'B', 'C']);
    expect(checkHardConstraints(fullStop, { kind: 'announcement' }).some((v) => v.startsWith('ending'))).toBe(true);
    expect(checkHardConstraints(noQuestion).some((v) => v.startsWith('ending'))).toBe(false);
  });

  it('allows exactly one question', () => {
    const two = assembleAnnouncement(body.replace('Where would you start', 'Have you done this? Where would you start'), ['A', 'B', 'C']);
    expect(checkHardConstraints(two, { kind: 'announcement' })).toContain('ending: ask exactly one question (found 2)');
    expect(checkHardConstraints(assembleAnnouncement(body, ['A', 'B', 'C']), { kind: 'announcement' }).some((v) => v.includes('exactly one'))).toBe(false);
  });

  it('bans the "excited to start my journey" openers, only for announcements', () => {
    for (const opener of ['Excited to share that', 'Thrilled to announce', 'Day 1 of learning', 'Embarking on a new path']) {
      const text = assembleAnnouncement(`${opener} I am learning system design.\n${body}`, ['A', 'B', 'C']);
      expect(checkHardConstraints(text, { kind: 'announcement' }).some((v) => v.startsWith('hook: contains banned opener'))).toBe(true);
    }
    const later = assembleAnnouncement(body.replace('as I go.', 'as I go. Excited to see where it leads.'), ['A', 'B', 'C']);
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
    expect(assembleAnnouncement('  Line one.\nLine two.  ', ['A', '#B', 'C'])).toBe('Line one.\nLine two.\n\n#A #B #C');
  });
});

describe('announcement prompt', () => {
  it('sends the topic and its description as context, and no subtopics', () => {
    const p = announcementPrompt(topic);
    expect(p).toContain('# Topic\n\nSystem design');
    expect(p).toContain('context only: do not list it, quote it or name concepts from it');
    expect(p).toContain('The parts that come up when designing backend services at scale.');
    expect(p).not.toMatch(/subtopic|plan to cover|pick 3/i);
  });

  it('marks a missing reason, goal and rhythm so nothing is invented', () => {
    const p = announcementPrompt(topic);
    expect(p).toContain('(not given: invent no reason, say nothing about my background, and make the hook about the topic)');
    expect(p).toContain('(not given: state no goal)');
    expect(p).toContain('(not given: do not promise a rhythm)');
    expect(announcementPrompt(topic, { why: '   ', goal: ' ' })).toContain('invent no reason');
  });

  it('includes the reason, goal and rhythm when supplied, trimmed', () => {
    const p = announcementPrompt(topic, { why: '  Our API fell over.  ', goal: ' survive a 10x spike ', cadence: ' twice a week ' });
    expect(p).toContain('# Why I am starting\n\nOur API fell over.');
    expect(p).toContain('# What I want to be able to do\n\nsurvive a 10x spike');
    expect(p).toContain('# How often I will post\n\ntwice a week');
    expect(p).not.toContain('not given');
  });

  it('omits the description section when the topic has none', () => {
    expect(announcementPrompt({ title: 'Rust', description: '' })).not.toContain('What the topic covers');
  });
});
