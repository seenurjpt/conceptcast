/** Small helpers shared by the App Router route handlers. */
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { dbConnect } from './db/connect';
import { installUsageSink } from './db/usageSink';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a handler: connects to Mongo, converts thrown errors to JSON responses. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      await dbConnect();
      installUsageSink();
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      const err = e as Error;
      console.error(err);
      return fail(err.message || 'Internal error', 500);
    }
  };
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'Body is not valid JSON.');
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '));
  }
  return parsed.data;
}

export function isObjectId(s: string): boolean {
  return /^[0-9a-f]{24}$/i.test(s);
}

/** Bearer or `?secret=` check for endpoints hit by external schedulers. */
export function requireCronSecret(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, 'CRON_SECRET is not configured.');
  const auth = req.headers.get('authorization') ?? '';
  const q = new URL(req.url).searchParams.get('secret');
  if (auth !== `Bearer ${secret}` && q !== secret) throw new HttpError(401, 'Unauthorised.');
}

/** `PIPELINE_MODE=inngest` dispatches long jobs to Inngest; default runs them inline in the request. */
export function pipelineMode(): 'inline' | 'inngest' {
  return process.env.PIPELINE_MODE === 'inngest' ? 'inngest' : 'inline';
}
