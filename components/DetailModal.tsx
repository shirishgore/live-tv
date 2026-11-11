"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Channel, ListStatus } from "@/lib/types";
import ChannelCard, { channelInitials } from "@/components/ChannelCard";
import {
  getChannel,
  recordWatch,
  setListStatus,
  toggleFavorite,
  toggleWatchlist,
} from "@/lib/actions";

const STATUSES: { value: ListStatus; label: string }[] = [
  { value: "watchlist", label: "Watchlist" },
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
];

export default function DetailModal({
  channel,
  related: relatedProp,
  onClose,
}: {
  channel: Channel;
  related?: Channel[];
  onClose: () => void;
}) {
  const [streamCount, setStreamCount] = useState<number | null>(
    channel.streamCount ?? null,
  );
  const [related, setRelated] = useState<Channel[]>(relatedProp ?? []);
  const [status, setStatus] = useState<ListStatus | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [saved, setSaved] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getChannel(channel.id)
      .then((full) => {
        if (cancelled || !full) return;
        setStreamCount(full.streamCount);
        if (full.related.length > 0) setRelated(full.related);
      })
      .catch(() => {
        // Prop data already shown; stream count stays as-is.
      });
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  async function chooseStatus(s: ListStatus) {
    try {
      await setListStatus(channel.id, s);
      setStatus(s);
      setSaved(`Saved to ${s}.`);
    } catch {
      setSaved("Could not save. Try again.");
    }
  }

  async function removeFromList() {
    try {
      await toggleWatchlist(channel.id, null);
      setStatus(null);
      setSaved("Removed from your list.");
    } catch {
      setSaved("Could not remove. Try again.");
    }
  }

  async function toggleFav() {
    try {
      await toggleFavorite(channel.id);
      setFavorite((v) => !v);
    } catch {
      setSaved("Could not update favorite. Try again.");
    }
  }

  const others = related.filter((c) => c.id !== channel.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={channel.name}
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70"
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/15 bg-[#141414] p-5 sm:rounded-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg text-zinc-200 hover:border-[var(--accent)] hover:text-white"
        >
          ×
        </button>

        <div className="flex gap-4">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1c]">
            {channel.logo && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.logo}
                alt=""
                onError={() => setImgFailed(true)}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="text-2xl font-bold text-zinc-400">
                {channelInitials(channel.name)}
              </span>
            )}
          </span>
          <div className="min-w-0 pr-10">
            <h2 className="text-xl font-bold leading-tight">{channel.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {[
                channel.categories?.[0],
                channel.country,
                channel.quality,
                typeof streamCount === "number"
                  ? `${streamCount} stream${streamCount === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
            {channel.categories && channel.categories.length > 1 && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {channel.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    {c}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/watch/${channel.id}`}
            onClick={() => {
              recordWatch(channel.id, 0).catch(() => {});
            }}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-black hover:brightness-110"
          >
            ▶ Watch Now
          </Link>
          <button
            type="button"
            onClick={toggleFav}
            aria-pressed={favorite}
            className="rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)]"
          >
            {favorite ? "♥ Favorited" : "♡ Favorite"}
          </button>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-zinc-300">Add to list</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => chooseStatus(s.value)}
                aria-pressed={status === s.value}
                className={
                  status === s.value
                    ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black"
                    : "rounded-full border border-white/20 px-4 py-2 text-sm hover:border-[var(--accent)]"
                }
              >
                {s.label}
              </button>
            ))}
            {status && (
              <button
                type="button"
                onClick={removeFromList}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
          {saved && (
            <p role="status" className="mt-2 text-sm text-zinc-400">
              {saved}
            </p>
          )}
        </div>

        {others.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Related channels
            </h3>
            <div className="row-scroll no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {others.slice(0, 10).map((c) => (
                <div key={c.id} className="w-[120px] shrink-0">
                  <ChannelCard channel={c} related={others} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
