import { cookies, headers } from 'next/headers';

export const COUNTRY_COOKIE = 'kage_country';
const CODE_RE = /^[A-Za-z]{2}$/;

export type CountrySource = 'manual' | 'header' | 'language' | 'none';

function normalize(code: string | undefined | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

/** Region subtag of an Accept-Language value, e.g. `en-IN` / `en_US` -> `IN`. */
function regionFromAcceptLanguage(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(',')) {
    const tag = part.split(';')[0]?.trim();
    if (!tag) continue;
    const m = tag.match(/^[a-zA-Z]{2,3}[-_]([a-zA-Z]{2})(?:[-_]|$)/);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

export async function getCountryPreference(): Promise<{
  country: string | null;
  source: CountrySource;
}> {
  const cookieStore = await cookies();
  const manual = normalize(cookieStore.get(COUNTRY_COOKIE)?.value);
  if (manual) return { country: manual, source: 'manual' };

  const headerStore = await headers();
  const fromHeader = normalize(headerStore.get('x-vercel-ip-country'));
  if (fromHeader) return { country: fromHeader, source: 'header' };

  const fromLanguage = normalize(
    regionFromAcceptLanguage(headerStore.get('accept-language')),
  );
  if (fromLanguage) return { country: fromLanguage, source: 'language' };

  return { country: null, source: 'none' };
}

/**
 * Effective country: manual `kage_country` cookie wins, else the Vercel
 * `x-vercel-ip-country` header, else the Accept-Language region.
 * Returns `null` for All Countries (no preference detected).
 *
 * NOTE: Next 16's `cookies()`/`headers()` are async, so this is `async`
 * and must be awaited — a sync return is not possible on Next 16.
 */
export async function getEffectiveCountry(): Promise<string | null> {
  return (await getCountryPreference()).country;
}

/** Human-readable country name, e.g. `IN` -> `India`. `xx` -> `Unknown`. */
export function countryName(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === 'XX') return 'Unknown';
  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(upper) ?? upper
    );
  } catch {
    return upper;
  }
}
