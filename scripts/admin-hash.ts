/**
 * Makes the values for the admin panel's environment variables.
 *
 *   npm run admin:hash
 *
 * Asks for a password (not echoed), prints ADMIN_PASSWORD_HASH for it, and
 * a fresh random ADMIN_SESSION_SECRET. Paste both into .env.local (and the
 * Vercel project settings), with ADMIN_EMAIL set to the admin's email.
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/admin/password';

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    // No TTY (piped input): read a line as is.
    if (!stdin.isTTY) {
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (c) => (data += c));
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0]));
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  const password = await readHidden('Admin password (at least 12 characters): ');
  if (password.length < 12) {
    console.error('Too short: use at least 12 characters.');
    process.exit(1);
  }
  const confirm = process.stdin.isTTY ? await readHidden('Again, to confirm: ') : password;
  if (confirm !== password) {
    console.error('The two entries did not match.');
    process.exit(1);
  }
  console.log('\nAdd these to .env.local and to your Vercel project (Settings, Environment Variables):\n');
  console.log('ADMIN_EMAIL=you@example.com');
  console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
  console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
  console.log('\nChanging ADMIN_SESSION_SECRET or ADMIN_EMAIL later signs every admin out.');
})();
