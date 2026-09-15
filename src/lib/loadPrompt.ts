import fs from 'node:fs';
import path from 'node:path';

const PROMPT_DIR = path.join(process.cwd(), 'src', 'lib', 'prompts');
const cache = new Map<string, string>();

/** Loads `src/lib/prompts/<name>.md`. Prompts never live inline in .ts files. */
export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const file = path.join(PROMPT_DIR, `${name}.md`);
  if (!fs.existsSync(file)) {
    const available = fs
      .readdirSync(PROMPT_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .join(', ');
    throw new Error(`Prompt "${name}" not found in ${PROMPT_DIR}. Available: ${available}`);
  }
  const text = fs.readFileSync(file, 'utf8').trim();
  cache.set(name, text);
  return text;
}
