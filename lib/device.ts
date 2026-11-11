import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

export const DEVICE_COOKIE = 'kage_device';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anonymous per-browser id, stored in the `kage_device` cookie.
 *
 * NOTE: Next 16's `cookies()` is async, so this is `async` and must be
 * awaited — a sync `getDeviceId(): string` is not possible on Next 16.
 * Setting the cookie only takes effect when called from a Server Action or
 * Route Handler; if the store is read-only (e.g. a Server Component render)
 * the set is skipped and the fresh id is still returned.
 */
export async function getDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return existing;
  const id = randomUUID();
  try {
    store.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // Read-only cookie store (Server Component render): id still usable
    // for this request; it will be persisted on the next Server Action call.
  }
  return id;
}
