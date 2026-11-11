import { getHome, getUiPrefs } from "@/lib/actions";
import Hero from "@/components/Hero";
import ChannelRow from "@/components/ChannelRow";
import ChannelCard from "@/components/ChannelCard";
import AdSlot from "@/components/AdSlot";

export default async function HomePage() {
  let country: string | null = null;
  let heroAutoAdvance = true;

  try {
    const prefs = await getUiPrefs();
    country = prefs?.country ?? null;
    if (typeof prefs?.heroAutoAdvance === "boolean") {
      heroAutoAdvance = prefs.heroAutoAdvance;
    }
  } catch {
    // Defaults apply.
  }

  let featured: Awaited<ReturnType<typeof getHome>>["featured"] = [];
  let rows: Awaited<ReturnType<typeof getHome>>["rows"] = [];
  let continueWatching: Awaited<
    ReturnType<typeof getHome>
  >["continueWatching"] = [];
  let watchlist: Awaited<ReturnType<typeof getHome>>["watchlist"] = [];

  try {
    const home = await getHome(country);
    featured = home?.featured ?? [];
    rows = home?.rows ?? [];
    continueWatching = home?.continueWatching ?? [];
    watchlist = home?.watchlist ?? [];
  } catch {
    // Catalog unavailable — page still renders with empty rows.
  }

  return (
    <div>
      <Hero channels={featured} autoAdvance={heroAutoAdvance} />

      <div className="mt-6">
        <AdSlot />
      </div>

      {continueWatching.length > 0 && (
        <section aria-label="Continue watching" className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-white">
            Continue Watching
          </h2>
          <div className="row-scroll no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6">
            {continueWatching.map((item) => {
              const mins = Math.floor(item.watchedSeconds / 60);
              const secs = Math.floor(item.watchedSeconds % 60);
              return (
                <div
                  key={item.channel.id}
                  className="w-[140px] shrink-0 sm:w-[160px]"
                >
                  <ChannelCard
                    channel={item.channel}
                    related={continueWatching.map((i) => i.channel)}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Watched {mins}:{String(secs).padStart(2, "0")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rows.map((row, i) => (
        <div key={`${row.title}-${i}`}>
          <ChannelRow index={i} title={row.title} channels={row.channels} />
          {i === 1 && (
            <div className="mt-8">
              <AdSlot />
            </div>
          )}
        </div>
      ))}

      {watchlist.length > 0 && (
        <ChannelRow
          index={rows.length}
          title="Your Watchlist"
          channels={watchlist}
        />
      )}
    </div>
  );
}
