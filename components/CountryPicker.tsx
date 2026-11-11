"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setCountryPref } from "@/lib/actions";

export type CountryOption = { code: string; name: string; count: number };

const MANUAL_KEY = "kage-tv-country-manual";

export function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(
    ...[...upper].map((c) => 127397 + c.charCodeAt(0)),
  );
}

const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "America/New_York": "US",
  "Europe/London": "GB",
};

function detectFromLanguage(): string | null {
  const lang =
    typeof navigator !== "undefined" ? navigator.language || "" : "";
  const parts = lang.split("-");
  const region = parts[1]?.toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(region) ? region : null;
}

function detectFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[tz] ?? null;
  } catch {
    return null;
  }
}

async function detectFromIp(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    const code = (data.country_code ?? "").toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export default function CountryPicker({
  countries,
  value,
  autoDetected,
}: {
  countries: CountryOption[];
  value: string | null;
  autoDetected: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const didDetect = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-detect on first visit only: no saved country, not already
  // auto-detected, and the user has never picked a country manually.
  useEffect(() => {
    if (didDetect.current) return;
    if (value) return;
    if (autoDetected) return;
    try {
      if (window.localStorage.getItem(MANUAL_KEY)) return;
    } catch {
      return;
    }
    didDetect.current = true;

    (async () => {
      const fromIp = await detectFromIp();
      const code =
        fromIp ?? detectFromLanguage() ?? detectFromTimezone() ?? null;
      if (!code) return;
      if (
        countries.length > 0 &&
        !countries.some((c) => c.code.toUpperCase() === code)
      ) {
        return;
      }
      try {
        await setCountryPref(code);
        router.refresh();
      } catch {
        // Auto-detect is best effort; the picker still works manually.
      }
    })();
  }, [value, autoDetected, countries, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  async function choose(code: string | null) {
    try {
      window.localStorage.setItem(MANUAL_KEY, "1");
    } catch {
      // Storage unavailable — server pref still applies.
    }
    try {
      await setCountryPref(code);
    } catch {
      // Keep the picker usable even if the save fails this once.
    }
    setOpen(false);
    setQuery("");
    router.refresh();
  }

  const selected = value
    ? countries.find((c) => c.code.toUpperCase() === value.toUpperCase())
    : undefined;
  const label = selected ? selected.name : value ? value : "All Countries";
  const flag = value ? countryFlag(value) : "🌐";
  const q = query.trim().toLowerCase();
  const filtered = q
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      )
    : countries;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose country"
        className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:border-[var(--accent)] hover:text-white"
      >
        <span aria-hidden="true">{flag}</span>
        <span className="hidden max-w-28 truncate sm:inline">{label}</span>
        {autoDetected && value && (
          <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-black">
            AUTO
          </span>
        )}
        <span aria-hidden="true" className="text-xs text-zinc-500">
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close country picker"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#141414] shadow-2xl shadow-black/60">
            <div className="p-2">
              <label htmlFor="country-search" className="sr-only">
                Search countries
              </label>
              <input
                id="country-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                autoFocus
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <ul
              role="listbox"
              aria-label="Countries"
              className="max-h-80 overflow-y-auto pb-2"
            >
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => choose(null)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10"
                >
                  <span aria-hidden="true">🌐</span>
                  <span className="flex-1">All Countries</span>
                </button>
              </li>
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      value?.toUpperCase() === c.code.toUpperCase()
                    }
                    onClick={() => choose(c.code)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    <span aria-hidden="true">{countryFlag(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-zinc-500">{c.count}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-zinc-500">
                  No countries match.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
