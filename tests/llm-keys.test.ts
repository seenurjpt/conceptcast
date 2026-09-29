import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, providerOrder, modelFor } from '../src/lib/llm/models';
import { keyBlobFor } from '../src/lib/llm/client';
import { encryptSecret, decryptSecret, keyHint } from '../src/lib/llm/keys';
import type { UserDoc } from '../src/lib/schemas/post';

test('providerOrder: preferred first, then the fixed fallback order', () => {
  assert.deepEqual(providerOrder('anthropic'), ['anthropic', 'openai', 'gemini']);
  assert.deepEqual(providerOrder('gemini'), ['gemini', 'anthropic', 'openai']);
  assert.deepEqual(providerOrder('openai'), ['openai', 'anthropic', 'gemini']);
});

test('every provider has a model for every tier', () => {
  for (const p of PROVIDERS) {
    assert.ok(modelFor(p, 'cheap').id);
    assert.ok(modelFor(p, 'standard').id);
  }
});

test('keyBlobFor picks the stored blob per provider and nothing from the environment', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-should-never-be-used';
  const gemini = encryptSecret('AIza-test-key-1234');
  const llm: UserDoc['llm'] = { preferredProvider: 'anthropic', anthropicKey: null, openaiKey: null, geminiKey: gemini };
  assert.equal(keyBlobFor(llm, 'anthropic'), null);
  assert.equal(keyBlobFor(llm, 'openai'), null);
  assert.equal(decryptSecret(keyBlobFor(llm, 'gemini')!), 'AIza-test-key-1234');
  assert.equal(keyBlobFor(undefined, 'anthropic'), null);
  assert.equal(keyHint('AIza-test-key-1234'), '…1234');
});
