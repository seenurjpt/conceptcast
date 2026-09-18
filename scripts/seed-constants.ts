/**
 * Banned openers and phrases. Imported by the critic rules and the prompt
 * templates, so this file has no side effects and no DB access.
 */

export const BANNED_OPENERS = [
  "In today's",
  "Let's dive in",
  "Here's the thing",
  "I've been thinking a lot about",
  'Unpopular opinion',
  'Hot take',
  'Let that sink in',
  'Ever wondered',
] as const;

export const BANNED_PHRASES = [
  'game changer',
  'leverage',
  'synergy',
  'deep dive',
  'in the ever-evolving',
  "it's not just X, it's Y",
  'revolutionize',
  'harness the power',
  'at the end of the day',
  'needle-moving',
  'delve',
] as const;
