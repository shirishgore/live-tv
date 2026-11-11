"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CountryPicker from "@/components/CountryPicker";
import { getMeta } from "@/lib/actions";

type CountryOption = { code: string; name: string; count: number };

function CatMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M7 12 8.5 3.5 15 8.5"
        fill="var(--accent)"
      />
      <path
        d="M25 12 23.5 3.5 17 8.5"
        fill="var(--accent)"
      />
      <circle cx="16" cy="18" r="11" fill="var(--accent)" />
      <circle cx="12" cy="17" r="1.8" fill="#050505" />
      <circle cx="20" cy="17" r="1.8" fill="#050505" />
      <path
        d="M13.5 21.5c.8.9 1.6 1.3 2.5 1.3s1.7-.4 2.5-1.3"
        stroke="#050505"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3 17h5M24 17h5M3.5 21.5H8M24 21.5h4.5"
        stroke="#050505"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Header({
  country,
  autoDetected,
}: {
  country: string | null;
  autoDetected: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    getMeta()
      .then((meta) => {
        if (!cancelled) setCountries(meta?.countries ?? []);
      })
      .catch(() => {
        // Country list is optional in the header; picker still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/browse?q=${encodeURIComponent(query)}` : "/browse");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="Kage TV home"
        >
          <CatMark />
          <span className="text-lg font-bold tracking-tight">
            Kage <span className="text-[var(--accent)]">TV</span>
          </span>
        </Link>

        <form
          onSubmit={onSearch}
          role="search"
          className="hidden min-w-0 flex-1 items-center md:flex"
        >
          <label htmlFor="header-search" className="sr-only">
            Search channels
          </label>
          <input
            id="header-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search channels…"
            className="w-full max-w-md rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/genres"
            aria-label="Browse genres"
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:border-[var(--accent)] hover:text-white"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
            </svg>
            <span className="hidden sm:inline">Genres</span>
          </Link>
          <CountryPicker
            countries={countries}
            value={country}
            autoDetected={autoDetected}
          />
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-300">
            <span
              className="h-2 w-2 rounded-full bg-zinc-500"
              aria-hidden="true"
            />
            Guest
          </span>
        </div>
      </div>

      <form
        onSubmit={onSearch}
        role="search"
        className="px-3 pb-3 md:hidden"
      >
        <label htmlFor="header-search-mobile" className="sr-only">
          Search channels
        </label>
        <input
          id="header-search-mobile"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search channels…"
          className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
        />
      </form>
    </header>
  );
}
