'use server';

import { cookies } from 'next/headers';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import { refreshCatalogData } from './catalog';
import { countryName, getCountryPreference, normalizeCountryCode } from './country';
import { db, ensureSchema } from './db';
import {
  channels,
  favorites,
  history,
  meta,
  prefs,
  streams,
  watchlist,
} from './db/schema';
import { getDeviceId } from './device';
import type { Channel, ListStatus } from './types';

const LIST_STATUSES: ListStatus[] = ['watchlist', 'planned', 'completed'];
const MAIN_CATEGORIES = [
  'News',
  'Sports',
  'Movies',
  'Music',
  'Kids',
  'Entertainment',
  'General',
];
const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_PREFS = { accent: '#ff7a1a', heroAutoAdvance: true, autoFailover: true };

type ChannelRow = typeof channels.$inferSelect;

function toChannel(row: ChannelRow, streamCount: number): Channel {
  return {
    id: row.id,
    name: row.name,
    logo: row.logo,
    country: row.country,
    countryName: countryName(row.country),
    category: row.category,
    categories: [row.category],
    language: row.language,
    quality: row.quality,
    streamCount,
  };
}

async function streamCounts(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ channelId: streams.channelId, n: count() })
    .from(streams)
    .where(inArray(streams.channelId, ids))
    .groupBy(streams.channelId);
  for (const r of rows) map.set(r.channelId, r.n);
  return map;
}

async function withCounts(rows: ChannelRow[]): Promise<Channel[]> {
  const counts = await streamCounts(rows.map((r) => r.id));
  return rows.map((r) => toChannel(r, counts.get(r.id) ?? 0));
}

/** One in-flight catalog refresh shared by concurrent first reads. */
let refreshPromise: Promise<{ total: number }> | null = null;
// The catalog only changes on the daily refresh, so re-counting it on
// every request is a wasted round-trip. Remember a confirmed non-empty
// catalog for 10 minutes; a fresh instance or an empty catalog still
// checks the database. (If the DB were ever wiped, the next check at
// most 10 minutes later re-seeds it.)
let catalogSeededAt = 0;
const CATALOG_SEEDED_TTL_MS = 10 * 60 * 1000;

async function ensureCatalog(): Promise<void> {
  await ensureSchema();
  if (Date.now() - catalogSeededAt < CATALOG_SEEDED_TTL_MS) return;
  const [{ n }] = await db.select({ n: count() }).from(channels);
  if (n > 0) {
    catalogSeededAt = Date.now();
    return;
  }
  if (!refreshPromise) {
    refreshPromise = refreshCatalogData().finally(() => {
      refreshPromise = null;
    });
  }
  try {
    await refreshPromise;
  } catch (err) {
    // Best-effort: first read still works (empty) if the fetch fails.
    console.error('Catalog refresh failed:', err);
  }
}

/**
 * Resolve the country filter for a query. An explicit argument wins
 * ('' / 'ALL' = All Countries); otherwise the effective country applies.
 * Returns a lowercase DB value, or null for All Countries.
 */
async function resolveCountry(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined && explicit !== null) {
    const v = explicit.trim().toUpperCase();
    if (v === 'ALL') return null;
    const normalized = normalizeCountryCode(v);
    // A real code wins. An empty or invalid one is not a choice for
    // "all countries" — it falls through to the saved preference below,
    // so section pages without a ?country= param follow the country
    // the user picked in the header instead of showing everything.
    if (normalized) return normalized.toLowerCase();
  }
  const effective = await getCountryPreference();
  return effective.country ? effective.country.toLowerCase() : null;
}

function countryCondition(country: string | null): SQL | undefined {
  return country ? eq(channels.country, country) : undefined;
}

function escapeLike(q: string): string {
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function channelExists(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, id))
    .limit(1);
  return rows.length > 0;
}

function requireId(id: unknown): string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('A channel id is required.');
  }
  return id.trim();
}

// The homepage's featured channels and category rows are the same for
// every visitor from one country — only Continue Watching and My List
// depend on the device. Cache the shared part per country for 1 hour so
// a repeat visit skips the database almost entirely: a warm load is then
// a few small queries instead of ~35 round-trips, which is what makes
// the page feel instant. The catalog only changes on the daily refresh,
// so a 1-hour stale window is harmless; a fresh server instance starts
// with an empty cache.
const HOME_SHARED_TTL_MS = 60 * 60 * 1000;
type HomeShared = {
  featured: Channel[];
  rows: { title: string; channels: Channel[] }[];
};
const homeSharedCache = new Map<string, { value: HomeShared; at: number }>();

async function getHomeShared(
  filter: string | null,
  cc: SQL | undefined,
): Promise<HomeShared> {
  const key = filter ?? 'ALL';
  const cached = homeSharedCache.get(key);
  if (cached && Date.now() - cached.at < HOME_SHARED_TTL_MS) return cached.value;

  const featuredPromise = (async () => {
    // Featured: 6 channels, prefer ones with logos; fill with others if short.
    const withLogo = await db
      .select()
      .from(channels)
      .where(
        cc
          ? and(cc, sql`${channels.logo} IS NOT NULL AND ${channels.logo} != ''`)
          : sql`${channels.logo} IS NOT NULL AND ${channels.logo} != ''`,
      )
      .orderBy(asc(channels.name))
      .limit(6);
    if (withLogo.length >= 6) return withLogo;
    const extra = await db
      .select()
      .from(channels)
      .where(
        cc
          ? and(
              cc,
              sql`${channels.logo} IS NULL OR ${channels.logo} = ''`,
            )
          : sql`${channels.logo} IS NULL OR ${channels.logo} = ''`,
      )
      .orderBy(asc(channels.name))
      .limit(6 - withLogo.length);
    return [...withLogo, ...extra];
  })();

  const catRowsPromise = db
    .select({ category: channels.category, n: count() })
    .from(channels)
    .where(cc)
    .groupBy(channels.category);

  const [featuredRows, catRows] = await Promise.all([
    featuredPromise,
    catRowsPromise,
  ]);

  // One row per category: main categories first, then the rest alphabetically.
  const orderedCats = catRows
    .map((r) => r.category)
    .sort((a, b) => {
      const ai = MAIN_CATEGORIES.indexOf(a);
      const bi = MAIN_CATEGORIES.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.localeCompare(b);
    });

  // All category rows fetched concurrently (20 channels each).
  const rowLists = await Promise.all(
    orderedCats.map((category) =>
      db
        .select()
        .from(channels)
        .where(
          cc
            ? and(cc, eq(channels.category, category))
            : eq(channels.category, category),
        )
        .orderBy(asc(channels.name))
        .limit(20),
    ),
  );

  // One stream-count query for every shared channel on the page.
  const counts = await streamCounts([
    ...featuredRows.map((r) => r.id),
    ...rowLists.flat().map((r) => r.id),
  ]);
  const toChannels = (rows: ChannelRow[]): Channel[] =>
    rows.map((r) => toChannel(r, counts.get(r.id) ?? 0));

  const value: HomeShared = {
    featured: toChannels(featuredRows),
    rows: orderedCats.map((category, i) => ({
      title: category,
      channels: toChannels(rowLists[i] ?? []),
    })),
  };
  homeSharedCache.set(key, { value, at: Date.now() });
  return value;
}

export async function getHome(country?: string | null): Promise<{
  featured: Channel[];
  rows: { title: string; channels: Channel[] }[];
  continueWatching: {
    channel: Channel;
    watchedSeconds: number;
    progressSeconds: number;
    /** Live channels have no known duration, so this is always null. */
    durationSeconds: number | null;
  }[];
  watchlist: Channel[];
}> {
  await ensureCatalog();
  const filter = await resolveCountry(country);
  const cc = countryCondition(filter);
  const deviceId = await getDeviceId();

  const historyPromise = db
    .select({ channel: channels, watchedSeconds: history.watchedSeconds })
    .from(history)
    .innerJoin(channels, eq(history.channelId, channels.id))
    .where(
      cc
        ? and(eq(history.deviceId, deviceId), cc)
        : eq(history.deviceId, deviceId),
    )
    .orderBy(desc(history.updatedAt))
    .limit(20);

  const watchPromise = db
    .select({ channel: channels })
    .from(watchlist)
    .innerJoin(channels, eq(watchlist.channelId, channels.id))
    .where(
      cc
        ? and(
            eq(watchlist.deviceId, deviceId),
            eq(watchlist.status, 'watchlist'),
            cc,
          )
        : and(
            eq(watchlist.deviceId, deviceId),
            eq(watchlist.status, 'watchlist'),
          ),
    )
    .orderBy(asc(channels.name))
    .limit(50);

  const [shared, historyRows, watchRows] = await Promise.all([
    getHomeShared(filter, cc),
    historyPromise,
    watchPromise,
  ]);

  // Stream counts only for the per-device channels; the shared rows
  // already carry theirs from the cache.
  const counts = await streamCounts([
    ...historyRows.map((r) => r.channel.id),
    ...watchRows.map((r) => r.channel.id),
  ]);
  const toChannels = (rows: ChannelRow[]): Channel[] =>
    rows.map((r) => toChannel(r, counts.get(r.id) ?? 0));

  return {
    featured: shared.featured,
    rows: shared.rows,
    continueWatching: historyRows.map((r) => ({
      channel: toChannel(r.channel, counts.get(r.channel.id) ?? 0),
      watchedSeconds: r.watchedSeconds,
      progressSeconds: r.watchedSeconds,
      durationSeconds: null as number | null,
    })),
    watchlist: toChannels(watchRows.map((r) => r.channel)),
  };
}

export async function listChannels(args?: {
  q?: string;
  category?: string;
  country?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  channels: Channel[];
  total: number;
  page: number;
  totalPages: number;
}> {
  await ensureCatalog();
  const filter = await resolveCountry(args?.country);
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(args?.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );

  const conditions: SQL[] = [];
  const cc = countryCondition(filter);
  if (cc) conditions.push(cc);
  const q = args?.q?.trim();
  if (q) {
    conditions.push(
      sql`lower(${channels.name}) LIKE ${`%${escapeLike(q.toLowerCase())}%`} ESCAPE '\\'`,
    );
  }
  const category = args?.category?.trim();
  if (category) conditions.push(eq(channels.category, category));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ n }] = await db.select({ n: count() }).from(channels).where(where);
  const total = n;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const list = await db
    .select()
    .from(channels)
    .where(where)
    .orderBy(asc(channels.name))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  return {
    channels: await withCounts(list),
    total,
    page: safePage,
    totalPages,
  };
}

export async function getChannel(id: string): Promise<{
  channel: Channel;
  related: Channel[];
  streamCount: number;
} | null> {
  await ensureCatalog();
  const cleanId = requireId(id);
  const rows = await db
    .select()
    .from(channels)
    .where(eq(channels.id, cleanId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const streamRows = await db
    .select()
    .from(streams)
    .where(eq(streams.channelId, cleanId))
    .orderBy(asc(streams.rank), asc(streams.url));
  const channel: Channel = {
    ...toChannel(row, streamRows.length),
    streams: streamRows.map((s) => s.url),
  };

  const relatedRows = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.category, row.category),
        eq(channels.country, row.country),
        sql`${channels.id} != ${cleanId}`,
      ),
    )
    .orderBy(asc(channels.name))
    .limit(12);

  return {
    channel,
    related: await withCounts(relatedRows),
    streamCount: channel.streamCount,
  };
}

export async function getMyList(): Promise<{
  watchlist: Channel[];
  planned: Channel[];
  completed: Channel[];
  favorites: Channel[];
  history: {
    channel: Channel;
    watchedSeconds: number;
    progressSeconds: number;
    /** Live channels have no known duration, so this is always null. */
    durationSeconds: number | null;
    watchedAt: string | null;
  }[];
}> {
  await ensureCatalog();
  const deviceId = await getDeviceId();
  const filter = await resolveCountry();
  const cc = countryCondition(filter);

  async function listByStatus(status: ListStatus): Promise<Channel[]> {
    const rows = await db
      .select({ channel: channels })
      .from(watchlist)
      .innerJoin(channels, eq(watchlist.channelId, channels.id))
      .where(
        cc
          ? and(
              eq(watchlist.deviceId, deviceId),
              eq(watchlist.status, status),
              cc,
            )
          : and(eq(watchlist.deviceId, deviceId), eq(watchlist.status, status)),
      )
      .orderBy(asc(channels.name));
    return withCounts(rows.map((r) => r.channel));
  }

  const favRows = await db
    .select({ channel: channels })
    .from(favorites)
    .innerJoin(channels, eq(favorites.channelId, channels.id))
    .where(
      cc
        ? and(eq(favorites.deviceId, deviceId), cc)
        : eq(favorites.deviceId, deviceId),
    )
    .orderBy(asc(channels.name));

  const historyRows = await db
    .select({
      channel: channels,
      watchedSeconds: history.watchedSeconds,
      updatedAt: history.updatedAt,
    })
    .from(history)
    .innerJoin(channels, eq(history.channelId, channels.id))
    .where(
      cc
        ? and(eq(history.deviceId, deviceId), cc)
        : eq(history.deviceId, deviceId),
    )
    .orderBy(desc(history.updatedAt));
  const historyCounts = await streamCounts(
    historyRows.map((r) => r.channel.id),
  );
  const historyItems = historyRows.map((r) => ({
    channel: toChannel(r.channel, historyCounts.get(r.channel.id) ?? 0),
    watchedSeconds: r.watchedSeconds,
    progressSeconds: r.watchedSeconds,
    durationSeconds: null as number | null,
    watchedAt: new Date(r.updatedAt).toISOString(),
  }));

  return {
    watchlist: await listByStatus('watchlist'),
    planned: await listByStatus('planned'),
    completed: await listByStatus('completed'),
    favorites: await withCounts(favRows.map((r) => r.channel)),
    history: historyItems,
  };
}

/**
 * Toggle the `watchlist` status. With no second argument it flips the
 * current watchlist membership. With an explicit status it sets it
 * (`null` removes the channel from the list entirely) — the form the
 * list/detail UI calls with.
 */
export async function toggleWatchlist(
  id: string,
  status?: ListStatus | null,
): Promise<{ inWatchlist: boolean }> {
  const cleanId = requireId(id);
  await ensureSchema();
  if (!(await channelExists(cleanId))) throw new Error('Channel not found.');
  const deviceId = await getDeviceId();
  if (status !== undefined) {
    if (status === null) {
      await db
        .delete(watchlist)
        .where(
          and(
            eq(watchlist.deviceId, deviceId),
            eq(watchlist.channelId, cleanId),
          ),
        );
      return { inWatchlist: false };
    }
    await db
      .insert(watchlist)
      .values({ deviceId, channelId: cleanId, status })
      .onConflictDoUpdate({
        target: [watchlist.deviceId, watchlist.channelId],
        set: { status },
      });
    return { inWatchlist: status === 'watchlist' };
  }
  const existing = await db
    .select()
    .from(watchlist)
    .where(
      and(
        eq(watchlist.deviceId, deviceId),
        eq(watchlist.channelId, cleanId),
      ),
    )
    .limit(1);
  if (existing[0]?.status === 'watchlist') {
    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.deviceId, deviceId),
          eq(watchlist.channelId, cleanId),
        ),
      );
    return { inWatchlist: false };
  }
  await db
    .insert(watchlist)
    .values({ deviceId, channelId: cleanId, status: 'watchlist' })
    .onConflictDoUpdate({
      target: [watchlist.deviceId, watchlist.channelId],
      set: { status: 'watchlist' },
    });
  return { inWatchlist: true };
}

export async function setListStatus(
  id: string,
  status: ListStatus | null,
): Promise<{ status: ListStatus | null }> {
  const cleanId = requireId(id);
  if (status !== null && !LIST_STATUSES.includes(status)) {
    throw new Error('Invalid list status.');
  }
  await ensureSchema();
  if (!(await channelExists(cleanId))) throw new Error('Channel not found.');
  const deviceId = await getDeviceId();
  const where = and(
    eq(watchlist.deviceId, deviceId),
    eq(watchlist.channelId, cleanId),
  );
  if (status === null) {
    await db.delete(watchlist).where(where);
    return { status: null };
  }
  await db
    .insert(watchlist)
    .values({ deviceId, channelId: cleanId, status })
    .onConflictDoUpdate({
      target: [watchlist.deviceId, watchlist.channelId],
      set: { status },
    });
  return { status };
}

export async function toggleFavorite(
  id: string,
): Promise<{ isFavorite: boolean }> {
  const cleanId = requireId(id);
  await ensureSchema();
  if (!(await channelExists(cleanId))) throw new Error('Channel not found.');
  const deviceId = await getDeviceId();
  const where = and(
    eq(favorites.deviceId, deviceId),
    eq(favorites.channelId, cleanId),
  );
  const existing = await db.select().from(favorites).where(where).limit(1);
  if (existing.length > 0) {
    await db.delete(favorites).where(where);
    return { isFavorite: false };
  }
  await db.insert(favorites).values({ deviceId, channelId: cleanId });
  return { isFavorite: true };
}

export async function recordWatch(
  id: string,
  seconds: number,
): Promise<{ ok: true; watchedSeconds: number }> {
  const cleanId = requireId(id);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('watchedSeconds must be a non-negative number.');
  }
  const watchedSeconds = Math.floor(seconds);
  await ensureSchema();
  if (!(await channelExists(cleanId))) throw new Error('Channel not found.');
  const deviceId = await getDeviceId();
  await db
    .insert(history)
    .values({
      deviceId,
      channelId: cleanId,
      watchedSeconds,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [history.deviceId, history.channelId],
      set: { watchedSeconds, updatedAt: Date.now() },
    });
  return { ok: true, watchedSeconds };
}

export async function removeFromHistory(id: string): Promise<{ ok: true }> {
  const cleanId = requireId(id);
  await ensureSchema();
  const deviceId = await getDeviceId();
  await db
    .delete(history)
    .where(
      and(eq(history.deviceId, deviceId), eq(history.channelId, cleanId)),
    );
  return { ok: true };
}

export async function clearHistory(): Promise<{ ok: true }> {
  await ensureSchema();
  const deviceId = await getDeviceId();
  await db.delete(history).where(eq(history.deviceId, deviceId));
  return { ok: true };
}

export async function getMeta(): Promise<{
  countries: { code: string; name: string; count: number }[];
  categories: { name: string; count: number }[];
  totalChannels: number;
  lastRefresh: string | null;
  country: string | null;
  countryAuto: boolean;
}> {
  await ensureCatalog();
  const pref = await getCountryPreference();

  // Independent lookups — run together, not one after another.
  const [countryRows, categoryRows, totalRows, metaRows] = await Promise.all([
    db
      .select({ code: channels.country, n: count() })
      .from(channels)
      .groupBy(channels.country)
      .orderBy(desc(count())),
    db
      .select({ name: channels.category, n: count() })
      .from(channels)
      .groupBy(channels.category)
      .orderBy(desc(count())),
    db.select({ n: count() }).from(channels),
    db
      .select()
      .from(meta)
      .where(eq(meta.key, 'lastRefresh'))
      .limit(1),
  ]);
  const [{ n: totalChannels }] = totalRows;

  return {
    countries: countryRows.map((r) => ({
      code: r.code,
      name: countryName(r.code),
      count: r.n,
    })),
    categories: categoryRows.map((r) => ({ name: r.name, count: r.n })),
    totalChannels,
    lastRefresh: metaRows[0]?.value ?? null,
    country: pref.country,
    countryAuto: pref.source === 'header' || pref.source === 'language',
  };
}

export async function getUiPrefs(): Promise<{
  accent: string;
  heroAutoAdvance: boolean;
  autoFailover: boolean;
  country: string | null;
  autoDetected: boolean;
}> {
  await ensureSchema();
  const deviceId = await getDeviceId();
  const pref = await getCountryPreference();
  const rows = await db
    .select()
    .from(prefs)
    .where(eq(prefs.deviceId, deviceId))
    .limit(1);
  const row = rows[0];
  const base = row
    ? {
        accent: row.accent,
        heroAutoAdvance: row.heroAutoAdvance === 1,
        autoFailover: row.autoFailover === 1,
      }
    : { ...DEFAULT_PREFS };
  return {
    ...base,
    country: pref.country,
    autoDetected: pref.source === 'header' || pref.source === 'language',
  };
}

export async function setUiPrefs(partial: {
  accent?: string;
  heroAutoAdvance?: boolean;
  autoFailover?: boolean;
}): Promise<{
  accent: string;
  heroAutoAdvance: boolean;
  autoFailover: boolean;
  country: string | null;
  autoDetected: boolean;
}> {
  await ensureSchema();
  const deviceId = await getDeviceId();
  const current = await getUiPrefs();
  const next = {
    accent:
      typeof partial.accent === 'string' && partial.accent.trim() !== ''
        ? partial.accent.trim().slice(0, 32)
        : current.accent,
    heroAutoAdvance:
      typeof partial.heroAutoAdvance === 'boolean'
        ? partial.heroAutoAdvance
        : current.heroAutoAdvance,
    autoFailover:
      typeof partial.autoFailover === 'boolean'
        ? partial.autoFailover
        : current.autoFailover,
    country: current.country,
    autoDetected: current.autoDetected,
  };
  await db
    .insert(prefs)
    .values({
      deviceId,
      accent: next.accent,
      heroAutoAdvance: next.heroAutoAdvance ? 1 : 0,
      autoFailover: next.autoFailover ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: prefs.deviceId,
      set: {
        accent: next.accent,
        heroAutoAdvance: next.heroAutoAdvance ? 1 : 0,
        autoFailover: next.autoFailover ? 1 : 0,
      },
    });
  return next;
}

export async function setCountryPref(
  code: string | null,
): Promise<{ country: string | null }> {
  const store = await cookies();
  if (code === null) {
    // Remember the explicit "All Countries" choice as ALL. Deleting the
    // cookie made the next load fall back to auto-detect instead of all.
    store.set('kage_country', 'ALL', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return { country: null };
  }
  const normalized = normalizeCountryCode(code);
  if (!normalized) {
    throw new Error('Country code must be a 2-letter code, or null for All Countries.');
  }
  store.set('kage_country', normalized, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return { country: normalized };
}

export async function refreshCatalog(): Promise<{ total: number }> {
  return refreshCatalogData();
}

