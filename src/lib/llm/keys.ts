/**
 * BYO API keys are stored on the user doc encrypted with AES-256-GCM. The
 * data key is derived from KEY_ENCRYPTION_SECRET (falls back to SESSION_SECRET
 * in dev). Rotate the secret and every stored key becomes unreadable, which is
 * the intended failure mode: the user pastes it again.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface EncryptedBlob {
  /** base64 12-byte IV */
  iv: string;
  /** base64 ciphertext */
  data: string;
  /** base64 16-byte auth tag */
  tag: string;
  v: 1;
}

function dataKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET ?? process.env.SESSION_SECRET ?? 'conceptcast-dev-secret';
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64'), v: 1 };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]).toString('utf8');
}

/** Last four characters, for the settings UI. */
export function keyHint(plain: string): string {
  return plain.length > 8 ? `…${plain.slice(-4)}` : '…';
}
