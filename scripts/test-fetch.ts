/** Dev-only: verifies fetchSource against a few representative source URLs. */
import { fetchSource } from '../src/lib/fetchSource';

const urls = [
  'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
  'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
  'https://www.pinecone.io/learn/series/faiss/hnsw/',
  'https://arxiv.org/abs/1706.03762',
];

async function main(): Promise<void> {
  for (const url of urls) {
    try {
      const s = await fetchSource(url);
      const preview = s.text.slice(0, 200).replace(/\n/g, ' | ');
      console.log(`OK  ${url}\n    ${s.text.length} chars, truncated=${s.truncated}\n    ${preview}\n`);
    } catch (e) {
      console.log(`ERR ${url}: ${(e as Error).message}\n`);
    }
  }
}
void main();
