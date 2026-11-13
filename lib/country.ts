import { cookies, headers } from 'next/headers';

export const COUNTRY_COOKIE = 'kage_country';
const CODE_RE = /^[A-Za-z]{2}$/;

/**
 * Codes the outside world uses that differ from the catalog's codes.
 * iptv-org stores the United Kingdom as `uk`, while browsers, Vercel's
 * geo header and IP lookups report it as `gb` (the ISO code). Without
 * this alias a UK visitor's auto-detected `GB` matches zero channels
 * and the homepage renders empty.
 */
const COUNTRY_ALIASES: Record<string, string> = { GB: 'UK' };

/** Normalize a 2-letter country code to the catalog's spelling, or null. */
export function normalizeCountryCode(
  code: string | undefined | null,
): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const aliased = COUNTRY_ALIASES[c] ?? c;
  return CODE_RE.test(aliased) ? aliased : null;
}

export type CountrySource = 'manual' | 'header' | 'language' | 'none';

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
  const rawCookie = cookieStore.get(COUNTRY_COOKIE)?.value;
  // Explicit "All Countries" choice (stored as ALL): beats auto-detect.
  // Deleting the cookie instead silently reverted to the detected country.
  if (rawCookie?.trim().toUpperCase() === 'ALL') {
    return { country: null, source: 'manual' };
  }
  const manual = normalizeCountryCode(rawCookie);
  if (manual) return { country: manual, source: 'manual' };

  const headerStore = await headers();
  const fromHeader = normalizeCountryCode(
    headerStore.get('x-vercel-ip-country'),
  );
  if (fromHeader) return { country: fromHeader, source: 'header' };

  const fromLanguage = normalizeCountryCode(
    regionFromAcceptLanguage(headerStore.get('accept-language')),
  );
  if (fromLanguage) return { country: fromLanguage, source: 'language' };

  return { country: null, source: 'none' };
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
