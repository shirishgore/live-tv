import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** One row per channel in the iptv-org catalog. `id` is the tvg-id before '@'. */
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logo: text('logo'),
  country: text('country').notNull().default('xx'),
  category: text('category').notNull().default('General'),
  language: text('language'),
  quality: text('quality'),
});

/** Stream URLs for a channel, ordered by `rank`. All alternates are kept. */
export const streams = sqliteTable(
  'streams',
  {
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    rank: integer('rank').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.url] })],
);

export const favorites = sqliteTable(
  'favorites',
  {
    deviceId: text('device_id').notNull(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.channelId] })],
);

export const watchlist = sqliteTable(
  'watchlist',
  {
    deviceId: text('device_id').notNull(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['watchlist', 'planned', 'completed'] })
      .notNull()
      .default('watchlist'),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.channelId] })],
);

export const history = sqliteTable(
  'history',
  {
    deviceId: text('device_id').notNull(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    watchedSeconds: integer('watched_seconds').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.channelId] })],
);

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const prefs = sqliteTable('prefs', {
  deviceId: text('device_id').primaryKey(),
  accent: text('accent').notNull().default('cyan'),
  heroAutoAdvance: integer('hero_auto_advance').notNull().default(1),
  autoFailover: integer('auto_failover').notNull().default(1),
});
