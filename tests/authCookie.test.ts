import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionValue, verifySessionValue } from '../src/lib/authCookie';

test('a freshly created session verifies', async () => {
  assert.equal(await verifySessionValue(await createSessionValue()), true);
});

test('missing, empty and malformed values are rejected', async () => {
  for (const v of [undefined, '', 'nodot', '.', '.sig', 'abc.sig', '123']) {
    assert.equal(await verifySessionValue(v), false, `should reject ${JSON.stringify(v)}`);
  }
});

test('a tampered signature is rejected', async () => {
  const value = await createSessionValue();
  const [issued, mac] = [value.slice(0, value.lastIndexOf('.')), value.slice(value.lastIndexOf('.') + 1)];
  const flipped = (mac[0] === 'A' ? 'B' : 'A') + mac.slice(1);
  assert.equal(await verifySessionValue(`${issued}.${flipped}`), false);
});

test('a forged timestamp is rejected: the signature covers it', async () => {
  const value = await createSessionValue();
  const mac = value.slice(value.lastIndexOf('.') + 1);
  assert.equal(await verifySessionValue(`${Date.now() + 5_000}.${mac}`), false);
});

test('a session older than 30 days is rejected', async () => {
  const issuedAt = Date.now() - 31 * 86_400_000;
  const old = await createSessionValue(issuedAt);
  // Valid signature, but past the window.
  assert.equal(await verifySessionValue(old), false);
  // The same value was acceptable at the time it was issued.
  assert.equal(await verifySessionValue(old, issuedAt + 1_000), true);
});

test('a session just inside 30 days still verifies', async () => {
  const issuedAt = Date.now() - 29 * 86_400_000;
  assert.equal(await verifySessionValue(await createSessionValue(issuedAt)), true);
});
