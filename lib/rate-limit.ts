import "server-only";
import { headers } from "next/headers";

// Fixed-window counters, in process memory like the rest of the demo data (lib/db.ts).
// A real deployment keeps them in the shared store next to the data they protect.
type Window = { count: number; resetAt: number };
const globalForLimits = globalThis as unknown as { leadDeskRateLimits?: Map<string, Window> };
const windows = (globalForLimits.leadDeskRateLimits ??= new Map());

/** Counts one attempt for `key`; false once `max` attempts were made within `windowMs`. */
export function takeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  for (const [storedKey, window] of windows) if (window.resetAt <= now) windows.delete(storedKey); // no unbounded growth
  const current = windows.get(key);
  if (!current) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

/** Undoes one attempt counted by takeRateLimit (a later limit refused the request). */
export function returnRateLimit(key: string) {
  const current = windows.get(key);
  if (current && current.count > 0) current.count -= 1;
}

/**
 * The client address, only from the header the deployment's proxy sets and overwrites (TRUSTED_CLIENT_IP_HEADER,
 * e.g. x-real-ip behind nginx). x-forwarded-for as sent is client-controlled, so it is never used on its own;
 * without the setting there is no per-address key and only the global limit applies.
 */
export async function trustedClientAddress(): Promise<string | null> {
  const name = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!name) return null;
  return (await headers()).get(name)?.trim() || null;
}
