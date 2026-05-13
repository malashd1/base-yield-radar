/**
 * Tiny FS-backed cache with TTL.
 *
 * Why FS and not Redis/KV: zero infra in v1. The whole point is to avoid hammering
 * DeFiLlama on every page render. When we deploy to Vercel, this should be swapped
 * for Vercel KV / Upstash. Until then this is fine for local dev and small traffic.
 *
 * Usage:
 *   const data = await withCache("yields:top30", 60 * 60, () => fetchAndShape());
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");

interface Envelope<T> {
  value: T;
  expiresAt: number; // epoch ms
}

async function ensureDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function pathFor(key: string): string {
  // Hash to keep filesystem-safe and bounded length.
  const h = crypto.createHash("sha1").update(key).digest("hex");
  return path.join(CACHE_DIR, `${h}.json`);
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(pathFor(key), "utf8");
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() > env.expiresAt) {
      // Stale; delete in background, ignore error.
      fs.unlink(pathFor(key)).catch(() => {});
      return null;
    }
    return env.value;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: string,
  ttlSeconds: number,
  value: T,
): Promise<void> {
  await ensureDir();
  const env: Envelope<T> = {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  await fs.writeFile(pathFor(key), JSON.stringify(env), "utf8");
}

/**
 * Fetch-or-cache helper. If a fresh value exists, return it. Otherwise call
 * `producer`, store the result with the given TTL, and return it.
 *
 * Errors from `producer` propagate — we do NOT serve stale on error here.
 * If you want stale-while-revalidate, build it on top of getCache/setCache.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = await getCache<T>(key);
  if (hit !== null) return hit;
  const fresh = await producer();
  await setCache(key, ttlSeconds, fresh);
  return fresh;
}

/** Wipe all cache files. Useful in tests and admin scripts. */
export async function clearCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    await Promise.all(
      files.map((f) => fs.unlink(path.join(CACHE_DIR, f)).catch(() => {})),
    );
  } catch {
    // dir doesn't exist yet — nothing to clear
  }
}
