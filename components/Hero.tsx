"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/types";
import DetailModal from "@/components/DetailModal";
import { recordWatch, toggleWatchlist } from "@/lib/actions";
import { channelInitials } from "@/components/ChannelCard";

export default function Hero({
  channels,
  autoAdvance = true,
}: {
  channels: Channel[];
  autoAdvance?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [added, setAdded] = useState(false);
  // Reset the "added" feedback when the slide changes (adjusting state
  // during render is the React-endorsed pattern for this).
  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    setAdded(false);
  }

  const count = channels.length;
  const current = count > 0 ? channels[index % count] : undefined;

  useEffect(() => {
    if (!autoAdvance || paused || count <= 1) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % count),
      6000,
    );
    return () => clearInterval(timer);
  }, [autoAdvance, paused, count]);

  if (!current) return null;

  const category = current.categories?.[0];

  async function addToList() {
    try {
      await toggleWatchlist(current!.id, "watchlist");
      setAdded(true);
    } catch {
      // Leave the button usable; the list page shows the saved state.
    }
  }

  return (
    <section
      aria-label="Featured channels"
      className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex min-h-[320px] flex-col justify-end gap-4 p-5 sm:min-h-[380px] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-end pr-6 opacity-10 sm:pr-16"
        >
          {current.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.logo}
              alt=""
              className="max-h-56 max-w-56 object-contain sm:max-h-72 sm:max-w-72"
            />
          ) : (
            <span className="text-[160px] font-bold leading-none text-white">
              {channelInitials(current.name)}
            </span>
          )}
        </div>

        <div className="relative">
          <p className="text-xs font-bold tracking-widest text-[var(--accent)]">
            FEATURED {String((index % count) + 1).padStart(2, "0")}/
            {String(count).padStart(2, "0")}
          </p>
          <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight sm:text-5xl">
            {current.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {[category, current.country, current.quality]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>

        <div className="relative flex flex-wrap gap-2">
          <Link
            href={`/watch/${current.id}`}
            onClick={() => {
              recordWatch(current.id, 0).catch(() => {});
            }}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-black hover:brightness-110"
          >
            ▶ Watch Now
          </Link>
          <button
            type="button"
            onClick={addToList}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:border-[var(--accent)]"
          >
            {added ? "✓ In your list" : "+ Add to list"}
          </button>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:border-[var(--accent)]"
          >
            More info
          </button>
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex gap-1.5" role="tablist" aria-label="Featured slides">
            {channels.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={i === index % count}
                aria-label={`Show ${c.name}`}
                onClick={() => setIndex(i)}
                className={
                  i === index % count
                    ? "h-2 w-6 rounded-full bg-[var(--accent)]"
                    : "h-2 w-2 rounded-full bg-white/30 hover:bg-white/60"
                }
              />
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              aria-label="Previous featured channel"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-200 hover:border-[var(--accent)]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % count)}
              aria-label="Next featured channel"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-200 hover:border-[var(--accent)]"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {infoOpen && (
        <DetailModal
          channel={current}
          related={channels}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </section>
  );
}
