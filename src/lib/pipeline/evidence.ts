/**
 * "Concrete" evidence is what the scorer rewards and what lets the pipeline
 * skip the verify-anchors call: a number, or a named tool.
 */

export const NAMED_TOOLS = [
  'postgres',
  'postgresql',
  'pgvector',
  'redis',
  'kafka',
  'sqs',
  'rabbitmq',
  'mongodb',
  'mongo',
  'mysql',
  'sqlite',
  'elasticsearch',
  'opensearch',
  'pinecone',
  'weaviate',
  'qdrant',
  'chroma',
  'faiss',
  'langchain',
  'llamaindex',
  'openai',
  'anthropic',
  'claude',
  'gpt',
  'gemini',
  'llama',
  'mistral',
  'bert',
  'transformers',
  'pytorch',
  'tensorflow',
  'jax',
  'numpy',
  'pandas',
  'react',
  'next.js',
  'nextjs',
  'node',
  'node.js',
  'deno',
  'bun',
  'typescript',
  'python',
  'rust',
  'go',
  'java',
  'kubernetes',
  'k8s',
  'docker',
  'terraform',
  'aws',
  'gcp',
  'azure',
  'vercel',
  'cloudflare',
  'lambda',
  'inngest',
  'temporal',
  'graphql',
  'grpc',
  'rest',
  'websocket',
  'webpack',
  'vite',
  'esbuild',
  'turbopack',
  'prisma',
  'drizzle',
  'mongoose',
  'zod',
  'tiktoken',
  'sentencepiece',
  'cuda',
  'triton',
  'vllm',
  'ollama',
  'huggingface',
  'sglang',
  'ray',
  'spark',
  'airflow',
  'dbt',
  'snowflake',
  'bigquery',
  'clickhouse',
  'duckdb',
  'parquet',
  'arrow',
  'protobuf',
  'json',
  'yaml',
  'git',
  'github',
  'gitlab',
  'linux',
  'nginx',
  'envoy',
  'istio',
  'prometheus',
  'grafana',
  'datadog',
  'sentry',
  'otel',
  'opentelemetry',
] as const;

const TOOL_SET = new Set<string>(NAMED_TOOLS);

/** Words that look like an identifier: internal capitals, dots, or a version suffix. */
const IDENTIFIER_RE = /\b(?:[a-z]+[A-Z][A-Za-z]*|[A-Za-z]+\.[a-z]{1,4}|v\d+(?:\.\d+)*)\b/;

export function hasNumber(s: string): boolean {
  return /\d/.test(s);
}

export function hasNamedTool(s: string): boolean {
  if (IDENTIFIER_RE.test(s)) return true;
  const tokens = s.toLowerCase().match(/[a-z0-9.+#-]+/g) ?? [];
  return tokens.some((t) => TOOL_SET.has(t.replace(/[.,;:]+$/, '')));
}

export function isConcrete(evidence: string): boolean {
  return hasNumber(evidence) || hasNamedTool(evidence);
}

/** True when every evidence item is concrete: verify-anchors can be skipped. */
export function allConcrete(evidence: string[]): boolean {
  return evidence.length > 0 && evidence.every(isConcrete);
}
