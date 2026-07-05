import { config } from '../config.js';

let redis = null;

export async function getRedis() {
  if (!config.redisUrl) return null;
  if (redis) return redis;

  try {
    const { default: Redis } = await import('ioredis');
    redis = new Redis(config.redisUrl);
    return redis;
  } catch {
    console.warn('Redis not available – running without cache');
    return null;
  }
}

export async function cacheGet(key) {
  const client = await getRedis();
  if (!client) return null;
  return client.get(key);
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  const client = await getRedis();
  if (!client) return;
  await client.set(key, value, 'EX', ttlSeconds);
}

export async function cacheDel(key) {
  const client = await getRedis();
  if (!client) return;
  await client.del(key);
}
