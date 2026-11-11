"use client";

import { useEffect, useState } from "react";
import CountryPicker from "@/components/CountryPicker";
import AdSlot from "@/components/AdSlot";
import {
  getMeta,
  getUiPrefs,
  refreshCatalog,
  setUiPrefs,
} from "@/lib/actions";

const ACCENTS = [
  { name: "Orange", value: "#ff7a1a" },
  { name: "Cyan", value: "cyan" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#e11d48" },
  { name: "Purple", value: "#a855f7" },
  { name: "Yellow", value: "#eab308" },
];

function formatRefresh(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function SettingsPage() {
  const [accent, setAccent] = useState("#ff7a1a");
  const [heroAutoAdvance, setHeroAutoAdvance] = useState(true);
  const [autoFailover, setAutoFailover] = useState(true);
  const [country, setCountry] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [countries, setCountries] = useState<
    { code: string; name: string; count: number }[]
  >([]);
  const [totalChannels, setTotalChannels] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getUiPrefs().catch(() => null),
      getMeta().catch(() => null),
    ]).then(([prefs, meta]) => {
      if (cancelled) return;
      if (prefs?.accent) setAccent(prefs.accent);
      if (typeof prefs?.heroAutoAdvance === "boolean") {
        setHeroAutoAdvance(prefs.heroAutoAdvance);
      }
      if (typeof prefs?.autoFailover === "boolean") {
        setAutoFailover(prefs.autoFailover);
      }
      setCountry(prefs?.country ?? null);
      setAutoDetected(Boolean(prefs?.autoDetected));
      setCountries(meta?.countries ?? []);
      if (typeof meta?.totalChannels === "number") {
        setTotalChannels(meta.totalChannels);
      }
      setLastRefresh(meta?.lastRefresh ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pickAccent(value: string) {
    setAccent(value);
    document.documentElement.style.setProperty("--accent", value);
    try {
      await setUiPrefs({ accent: value });
    } catch {
      setNotice("Accent saved on this page only — try again to keep it.");
    }
  }

  async function toggleHeroAdvance(value: boolean) {
    setHeroAutoAdvance(value);
    try {
      await setUiPrefs({ heroAutoAdvance: value });
    } catch {
      setNotice("Could not save that setting. Try again.");
    }
  }

  async function toggleFailover(value: boolean) {
    setAutoFailover(value);
    try {
      await setUiPrefs({ autoFailover: value });
    } catch {
      setNotice("Could not save that setting. Try again.");
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    setNotice("");
    try {
      const result = await refreshCatalog();
      setTotalChannels(result.total);
      setLastRefresh(new Date().toISOString());
      setNotice("Catalog refreshed.");
    } catch {
      setNotice("Refresh failed. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mt-6 text-2xl font-bold">Settings</h1>

      {notice && (
        <p role="status" className="mt-2 text-sm text-zinc-400">
          {notice}
        </p>
      )}

      <section aria-label="Theme" className="mt-8">
        <h2 className="text-lg font-bold">Accent color</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => pickAccent(a.value)}
              aria-pressed={accent.toLowerCase() === a.value.toLowerCase()}
              aria-label={`${a.name} accent`}
              className={
                accent.toLowerCase() === a.value.toLowerCase()
                  ? "h-10 w-10 rounded-full ring-2 ring-white ring-offset-2 ring-offset-[#050505]"
                  : "h-10 w-10 rounded-full ring-1 ring-white/20"
              }
              style={{ backgroundColor: a.value }}
            />
          ))}
        </div>
      </section>

      <section aria-label="Playback" className="mt-8">
        <h2 className="text-lg font-bold">Playback</h2>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 py-3">
            <span className="text-sm">
              Auto-advance hero
              <span className="block text-xs text-zinc-500">
                Featured channels change on their own.
              </span>
            </span>
            <input
              type="checkbox"
              checked={heroAutoAdvance}
              onChange={(e) => toggleHeroAdvance(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 py-3">
            <span className="text-sm">
              Auto backup-stream switching
              <span className="block text-xs text-zinc-500">
                Try the next stream when one fails.
              </span>
            </span>
            <input
              type="checkbox"
              checked={autoFailover}
              onChange={(e) => toggleFailover(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>
        </div>
      </section>

      <section aria-label="Country" className="mt-8">
        <h2 className="text-lg font-bold">Country</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Home rows show channels from this country.
        </p>
        <div className="mt-3">
          {loaded ? (
            <CountryPicker
              countries={countries}
              value={country}
              autoDetected={autoDetected}
            />
          ) : (
            <p className="text-sm text-zinc-500">Loading…</p>
          )}
        </div>
      </section>

      <section aria-label="Catalog" className="mt-8">
        <h2 className="text-lg font-bold">Channel catalog</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {totalChannels !== null
            ? `${totalChannels.toLocaleString()} channels`
            : "Channel count unknown"}
          {" • "}Last refresh: {formatRefresh(lastRefresh)}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-3 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50 hover:brightness-110"
        >
          {refreshing ? "Refreshing…" : "Refresh catalog"}
        </button>
      </section>

      <section aria-label="Ads" className="mt-8">
        <h2 className="text-lg font-bold">Ads — Google AdSense</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Account connected. Auto Ads on. Ads help keep Kage TV free.
        </p>
        <div className="mt-3">
          <AdSlot />
        </div>
      </section>
    </div>
  );
}
