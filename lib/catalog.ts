import { db, ensureSchema } from './db';
import { channels, meta, streams } from './db/schema';

export const CATALOG_URL = 'https://iptv-org.github.io/iptv/index.m3u';

export type ParsedChannel = {
  id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  language: string | null;
  quality: string | null;
  streams: string[];
};

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

function parseAttrs(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of line.matchAll(ATTR_RE)) {
    if (m[1] && m[2] !== undefined) attrs[m[1]] = m[2];
  }
  return attrs;
}

/** Country = suffix after the last '.' of the id (`DDSports.in` -> `in`); else `xx`. */
function countryFromId(id: string): string {
  const dot = id.lastIndexOf('.');
  if (dot === -1 || dot === id.length - 1) return 'xx';
  const suffix = id.slice(dot + 1).toLowerCase();
  return /^[a-z]{2}$/.test(suffix) ? suffix : 'xx';
}

/**
 * Parse an M3U playlist into channels. Entries sharing a tvg-id are merged
 * (streams accumulate); only `https://` URLs are kept, deduped per channel;
 * channels left with zero https streams are dropped.
 */
export function parseM3U(text: string): ParsedChannel[] {
  const lines = text.split(/\r?\n/);
  const byId = new Map<string, ParsedChannel>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line || !line.startsWith('#EXTINF')) continue;

    const attrs = parseAttrs(line);
    const rawId = (attrs['tvg-id'] ?? '').trim();
    if (!rawId) continue;
    const id = rawId.split('@')[0]?.trim();
    if (!id) continue;

    // Next non-empty, non-comment line is the stream URL.
    let url = '';
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]?.trim();
      if (!next) continue;
      if (next.startsWith('#')) break;
      url = next;
      break;
    }
    if (!url.startsWith('https://')) continue;

    const comma = line.lastIndexOf(',');
    const displayName = (comma >= 0 ? line.slice(comma + 1) : '').trim();
    const name = displayName || attrs['tvg-name'] || id;
    const groupTitle = (attrs['group-title'] ?? '').trim();
    const category =
      groupTitle.split(/[;,]/)[0]?.trim() || 'General';
    const logo = attrs['tvg-logo']?.trim() || null;
    const language = attrs['tvg-language']?.trim() || null;
    const quality = attrs['tvg-quality']?.trim() || null;

    const existing = byId.get(id);
    if (existing) {
      if (!existing.streams.includes(url)) existing.streams.push(url);
      if (!existing.logo && logo) existing.logo = logo;
      if (!existing.language && language) existing.language = language;
      if (!existing.quality && quality) existing.quality = quality;
      continue;
    }
    byId.set(id, {
      id,
      name,
      logo,
      country: countryFromId(id),
      category,
      language,
      quality,
      streams: [url],
    });
  }

  return [...byId.values()].filter((c) => c.streams.length > 0);
}

/**
 * Fetch the iptv-org playlist, parse it, and replace the stored catalog.
 * Returns the number of channels stored. Throws on fetch/parse failure
 * (the previous catalog is left untouched — the swap happens in one
 * transaction, only after a successful download + parse).
 */
export async function refreshCatalogData(): Promise<{ total: number }> {
  const res = await fetch(CATALOG_URL, {
    headers: { 'user-agent': 'kage-tv/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Catalog fetch failed: HTTP ${res.status}`);
  }
  const parsed = parseM3U(await res.text());
  if (parsed.length === 0) {
    throw new Error('Catalog parse produced zero channels; refusing to wipe the catalog.');
  }

  await ensureSchema();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.delete(streams);
    await tx.delete(channels);

    const CHUNK = 500;
    for (let i = 0; i < parsed.length; i += CHUNK) {
      await tx.insert(channels).values(
        parsed.slice(i, i + CHUNK).map((c) => ({
          id: c.id,
          name: c.name,
          logo: c.logo,
          country: c.country,
          category: c.category,
          language: c.language,
          quality: c.quality,
        })),
      );
    }

    const allStreams = parsed.flatMap((c) =>
      c.streams.map((url, rank) => ({ channelId: c.id, url, rank })),
    );
    for (let i = 0; i < allStreams.length; i += CHUNK) {
      await tx.insert(streams).values(
        allStreams.slice(i, i + CHUNK).map(({ channelId, url, rank }) => ({
          channelId,
          url,
          rank,
        })),
      );
    }

    for (const [key, value] of [
      ['lastRefresh', now],
      ['total', String(parsed.length)],
    ] as const) {
      await tx
        .insert(meta)
        .values({ key, value })
        .onConflictDoUpdate({
          target: meta.key,
          set: { value },
        });
    }
  });

  return { total: parsed.length };
}
