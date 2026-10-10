import mongoose from 'mongoose';

/**
 * Cached connection, safe under Next.js dev-mode module reloading.
 * Scripts call dbConnect() then dbDisconnect() so the process can exit.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as typeof globalThis & { _mongoose?: MongooseCache };
const cache: MongooseCache = globalWithMongoose._mongoose ?? { conn: null, promise: null };
globalWithMongoose._mongoose = cache;

export async function dbConnect(): Promise<typeof mongoose> {
  // The cache outlives dev-mode module reloads, but mongoose itself may have
  // been reloaded (an .env edit does this). A cached connection from the old
  // instance would leave queries on the new one buffering until they time out.
  if (cache.conn && (cache.conn !== mongoose || mongoose.connection.readyState === 0)) {
    cache.conn = null;
    cache.promise = null;
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set. Add it to .env.local (local mongod or an Atlas URI).');
    }
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

export async function dbDisconnect(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
