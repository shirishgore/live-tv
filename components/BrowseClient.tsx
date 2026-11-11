"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Channel } from "@/lib/types";
import ChannelCard from "@/components/ChannelCard";
import type { CountryOption } from "@/components/CountryPicker";

export default function BrowseClient({
  channels,
  total,
  page,
  totalPages,
  q,
  category,
  country,
  categories,
  countries,
  presetCategory,
}: {
  channels: Channel[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  category: string;
  country: string;
  categories: string[];
  countries: CountryOption[];
  presetCategory?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(q);
  const firstRun = useRef(true);

  // Keep the input in sync when the URL changes (e.g. header search).
  // Adjusting state during render is the React-endorsed pattern for this.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setQuery(q);
  }

  // Debounced search: update the URL, reset to page 1.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (query === q) return;
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in patch)) params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeCategory = presetCategory ?? category;

  return (
    <div>
      <div className="mt-4">
        <label htmlFor="browse-search" className="sr-only">
          Search channels
        </label>
        <input
          id="browse-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels…"
          className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {!presetCategory && categories.length > 0 && (
        <div
          className="row-scroll no-scrollbar -mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            onClick={() => updateParams({ category: null })}
            aria-pressed={!category}
            className={
              !category
                ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-black"
                : "shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-[var(--accent)]"
            }
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateParams({ category: c })}
              aria-pressed={category === c}
              className={
                category === c
                  ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-black"
                  : "shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-[var(--accent)]"
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {countries.length > 0 && (
        <div
          className="row-scroll no-scrollbar -mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6"
          role="group"
          aria-label="Filter by country"
        >
          <button
            type="button"
            onClick={() => updateParams({ country: null })}
            aria-pressed={!country}
            className={
              !country
                ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-black"
                : "shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-[var(--accent)]"
            }
          >
            All countries
          </button>
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => updateParams({ country: c.code })}
              aria-pressed={country.toUpperCase() === c.code.toUpperCase()}
              className={
                country.toUpperCase() === c.code.toUpperCase()
                  ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-black"
                  : "shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-[var(--accent)]"
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-zinc-400" role="status">
        {total} channel{total === 1 ? "" : "s"}
        {activeCategory ? ` in ${activeCategory}` : ""}
        {q ? ` matching “${q}”` : ""}
      </p>

      {channels.length === 0 ? (
        <p className="mt-10 text-center text-zinc-400">
          No channels found. Try a different search or filter.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              related={channels}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pages"
          className="mt-8 flex items-center justify-center gap-2"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
            className="rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
            className="rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
