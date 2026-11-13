import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

function createLibsqlClient(): Client {
  if (TURSO_URL && TURSO_TOKEN) {
    return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  }
  // Local dev fallback: a file DB under .data/ (never a secret, just a cache).
  const dir = path.join(process.cwd(), '.data');
  mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, 'local.db')}` });
}

export const client: Client = createLibsqlClient();

export const db: LibSQLDatabase<typeof schema> = drizzle(client, { schema });

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  country TEXT NOT NULL DEFAULT 'xx',
  category TEXT NOT NULL DEFAULT 'General',
  language TEXT,
  quality TEXT
);
CREATE TABLE IF NOT EXISTS streams (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, url)
);
CREATE TABLE IF NOT EXISTS favorites (
  device_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  PRIMARY KEY (device_id, channel_id)
);
CREATE TABLE IF NOT EXISTS watchlist (
  device_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'watchlist',
  PRIMARY KEY (device_id, channel_id)
);
CREATE TABLE IF NOT EXISTS history (
  device_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, channel_id)
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prefs (
  device_id TEXT PRIMARY KEY,
  accent TEXT NOT NULL DEFAULT 'cyan',
  hero_auto_advance INTEGER NOT NULL DEFAULT 1,
  auto_failover INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_channels_country ON channels(country);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category);
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
CREATE INDEX IF NOT EXISTS idx_streams_channel ON streams(channel_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_device ON watchlist(device_id);
CREATE INDEX IF NOT EXISTS idx_favorites_device ON favorites(device_id);
CREATE INDEX IF NOT EXISTS idx_history_device ON history(device_id);
`;

let schemaEnsured = false;

/** Create every table (and index) if it does not exist yet. Runs once per server instance — the DDL never changes, so re-running it on every request just costs a round-trip. */
export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await client.executeMultiple(SCHEMA_SQL);
  schemaEnsured = true;
}
