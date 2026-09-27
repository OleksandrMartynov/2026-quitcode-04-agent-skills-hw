import "server-only";

// Fixed-window counter per key, in process memory like the rest of the demo data (lib/db.ts).
// A real deployment keeps it in the shared store next to the data it protects.
type Window = { count: number; resetAt: number };
const globalForLimits = globalThis as unknown as { leadDeskRateLimits?: Map<string, Window> };
const windows = (globalForLimits.leadDeskRateLimits ??= new Map());

/** Counts one attempt for `key`; false once `max` attempts were made within `windowMs`. */
export function takeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}
