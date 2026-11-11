"use client";

import { useCallback, useEffect, useState } from "react";
import type { Channel, ListStatus } from "@/lib/types";
import ChannelCard from "@/components/ChannelCard";
import {
  clearHistory,
  getMyList,
  removeFromHistory,
  setListStatus,
  toggleFavorite,
  toggleWatchlist,
} from "@/lib/actions";

type MyListData = Awaited<ReturnType<typeof getMyList>>;
type HistoryItem = MyListData["history"][number];

type Tab = "all" | "watchlist" | "planned" | "completed" | "favorites";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "watchlist", label: "Watchlist" },
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "favorites", label: "Favorites" },
];

function formatWatched(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}


export default function ListPage() {
  const [data, setData] = useState<MyListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getMyList();
      setData(result);
      setError("");
    } catch {
      setError("Could not load your list. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: state updates happen inside the async callback, never
  // synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyList();
        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Could not load your list. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeStatus(id: string, status: ListStatus) {
    try {
      await setListStatus(id, status);
      setNotice("Status updated.");
      await load();
    } catch {
      setNotice("Could not update. Try again.");
    }
  }

  async function remove(id: string, fromFavorites: boolean) {
    try {
      if (fromFavorites) await toggleFavorite(id);
      else await toggleWatchlist(id, null);
      setNotice("Removed.");
      await load();
    } catch {
      setNotice("Could not remove. Try again.");
    }
  }

  async function removeHistory(id: string) {
    try {
      await removeFromHistory(id);
      await load();
    } catch {
      setNotice("Could not remove. Try again.");
    }
  }

  async function clearAllHistory() {
    if (!window.confirm("Clear all watch history?")) return;
    try {
      await clearHistory();
      setNotice("History cleared.");
      await load();
    } catch {
      setNotice("Could not clear history. Try again.");
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="mt-6 text-2xl font-bold">My List</h1>
        <p className="mt-8 text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="mt-6 text-2xl font-bold">My List</h1>
        <p className="mt-8 text-zinc-400">
          {error || "Could not load your list. Try again."}
        </p>
      </div>
    );
  }

  // Live channels have no known duration, so history doubles as
  // Continue Watching: same items, shown with watched time.
  const continueWatching: HistoryItem[] = data.history;
  const history: HistoryItem[] = data.history;

  const counts: Record<Tab, number> = {
    all:
      data.watchlist.length +
      data.planned.length +
      data.completed.length +
      data.favorites.length,
    watchlist: data.watchlist.length,
    planned: data.planned.length,
    completed: data.completed.length,
    favorites: data.favorites.length,
  };

  const shown: { channel: Channel; status: ListStatus | "favorite" }[] = [];
  const push = (list: Channel[], status: ListStatus | "favorite") => {
    for (const c of list) {
      if (!shown.some((s) => s.channel.id === c.id)) {
        shown.push({ channel: c, status });
      }
    }
  };
  if (tab === "all" || tab === "watchlist") push(data.watchlist, "watchlist");
  if (tab === "all" || tab === "planned") push(data.planned, "planned");
  if (tab === "all" || tab === "completed") push(data.completed, "completed");
  if (tab === "all" || tab === "favorites") push(data.favorites, "favorite");

  return (
    <div>
      <h1 className="mt-6 text-2xl font-bold">My List</h1>

      {notice && (
        <p role="status" className="mt-2 text-sm text-zinc-400">
          {notice}
        </p>
      )}

      <div
        className="row-scroll no-scrollbar -mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6"
        role="group"
        aria-label="Filter list"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={
              tab === t.value
                ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-black"
                : "shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-[var(--accent)]"
            }
          >
            {t.label} ({counts[t.value]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-zinc-400">
          Nothing here yet. Add channels from any channel card.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map(({ channel, status }) => (
            <div key={channel.id}>
              <ChannelCard channel={channel} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["watchlist", "planned", "completed"] as ListStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStatus(channel.id, s)}
                      aria-pressed={status === s}
                      className={
                        status === s
                          ? "rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-black"
                          : "rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:border-[var(--accent)]"
                      }
                    >
                      {s === "watchlist"
                        ? "Watchlist"
                        : s === "planned"
                          ? "Planned"
                          : "Completed"}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => remove(channel.id, status === "favorite")}
                  aria-label={`Remove ${channel.name} from your list`}
                  className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {continueWatching.length > 0 && (
        <section aria-label="Continue watching" className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Continue Watching</h2>
          <div className="row-scroll no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6">
            {continueWatching.map((item) => (
              <div
                key={item.channel.id}
                className="w-[140px] shrink-0 sm:w-[160px]"
              >
                <ChannelCard channel={item.channel} />
                <p className="mt-1 text-xs text-zinc-400">
                  Watched {formatWatched(item.watchedSeconds)}
                </p>
                <button
                  type="button"
                  onClick={() => removeHistory(item.channel.id)}
                  aria-label={`Remove ${item.channel.name} from continue watching`}
                  className="mt-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Watch history" className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">History</h2>
            <button
              type="button"
              onClick={clearAllHistory}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0f0f0f]">
            {history.map((item) => (
              <li
                key={item.channel.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.channel.name}
                  <span className="block truncate text-xs text-zinc-500">
                    Watched {formatWatched(item.watchedSeconds)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeHistory(item.channel.id)}
                  aria-label={`Remove ${item.channel.name} from history`}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
