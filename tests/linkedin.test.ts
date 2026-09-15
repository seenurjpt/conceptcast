import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCommentary, buildPostBody, authState } from '../src/lib/publishers/linkedin';

test('escapeCommentary escapes every reserved character once', () => {
  const input = 'call fn(a, b) -> {x: [1]} | <tag> @you ~tilde *star* _under_ back\\slash';
  const out = escapeCommentary(input);
  assert.equal(
    out,
    'call fn\\(a, b\\) -\\> \\{x: \\[1\\]\\} \\| \\<tag\\> \\@you \\~tilde \\*star\\* \\_under\\_ back\\\\slash',
  );
});

test('escapeCommentary leaves hashtags, newlines and plain punctuation alone', () => {
  const input = 'First line.\n\nSecond line, 10x cheaper: yes!\n\n#promptcaching #llm';
  assert.equal(escapeCommentary(input), input);
});

test('escapeCommentary on a code-adjacent post keeps the text readable', () => {
  const out = escapeCommentary('cache_control: { type: "ephemeral" } costs 1.25x (writes) vs 0.1x (reads)');
  assert.equal(out, 'cache\\_control: \\{ type: "ephemeral" \\} costs 1.25x \\(writes\\) vs 0.1x \\(reads\\)');
});

test('buildPostBody matches the /rest/posts contract', () => {
  const body = buildPostBody('urn:li:person:abc', 'Hello (world)');
  assert.deepEqual(body, {
    author: 'urn:li:person:abc',
    commentary: 'Hello \\(world\\)',
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  });
});

test('authState: ok / refresh-due at day 50 / expired / refresh-expired', () => {
  const day = 86_400_000;
  const now = new Date('2026-09-14T00:00:00Z');
  const base = { key: 's', accessToken: 't', memberUrn: 'u', memberName: null, scopes: [], updatedAt: now };
  assert.equal(authState(null, now), 'missing');
  assert.equal(
    authState({ ...base, refreshToken: 'r', expiresAt: new Date(+now + 30 * day), refreshExpiresAt: new Date(+now + 300 * day) } as never, now),
    'ok',
  );
  assert.equal(
    authState({ ...base, refreshToken: 'r', expiresAt: new Date(+now + 9 * day), refreshExpiresAt: new Date(+now + 300 * day) } as never, now),
    'refresh-due',
  );
  assert.equal(
    authState({ ...base, refreshToken: 'r', expiresAt: new Date(+now - day), refreshExpiresAt: new Date(+now + 300 * day) } as never, now),
    'expired',
  );
  assert.equal(
    authState({ ...base, refreshToken: 'r', expiresAt: new Date(+now - day), refreshExpiresAt: new Date(+now - day) } as never, now),
    'refresh-expired',
  );
  assert.equal(authState({ ...base, refreshToken: null, expiresAt: new Date(+now - day), refreshExpiresAt: null } as never, now), 'expired');
});
