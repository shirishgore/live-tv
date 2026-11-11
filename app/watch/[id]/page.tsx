import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Player from '@/components/Player';
import AdSlot from '@/components/AdSlot';
import { getChannel, getUiPrefs } from '@/lib/actions';

type WatchPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getChannel(id);
  if (!result) return { title: 'Channel not found — Kage TV' };
  return {
    title: `${result.channel.name} — Kage TV`,
    description: `Watch ${result.channel.name} live on Kage TV.`,
    alternates: { canonical: `/watch/${id}` },
  };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const result = await getChannel(id);
  if (!result) notFound();

  const { channel, related } = result;
  const prefs = await getUiPrefs();
  const streams = channel.streams ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Player
        channel={channel}
        streams={streams}
        related={related}
        autoFailover={prefs.autoFailover}
      />

      <AdSlot className="mt-4" />

      {/* Channel info */}
      <section aria-label="Channel information" className="mt-6">
        <div className="flex items-start gap-4">
          {channel.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.logo}
              alt={`${channel.name} logo`}
              className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain ring-1 ring-black/10"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-2xl font-bold text-cyan-600">
              {channel.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
              {channel.name}
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
                LIVE
              </span>
            </h1>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex gap-1">
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Category:</dt>
                <dd>{channel.category}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Country:</dt>
                <dd>{channel.countryName || channel.country}</dd>
              </div>
              {channel.language && (
                <div className="flex gap-1">
                  <dt className="font-medium text-zinc-900 dark:text-zinc-100">Language:</dt>
                  <dd>{channel.language}</dd>
                </div>
              )}
              {channel.quality && (
                <div className="flex gap-1">
                  <dt className="font-medium text-zinc-900 dark:text-zinc-100">Quality:</dt>
                  <dd>{channel.quality}</dd>
                </div>
              )}
              <div className="flex gap-1">
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Streams:</dt>
                <dd>
                  {streams.length > 0 ? streams.length : channel.streamCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <AdSlot className="mt-6" />

      {/* More like this */}
      {related.length > 0 && (
        <section aria-label="More like this" className="mt-6">
          <h2 className="text-lg font-bold">More like this</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((c) => (
              <Link
                key={c.id}
                href={`/watch/${c.id}`}
                className="group overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-black/5 transition hover:ring-cyan-400 dark:bg-zinc-900 dark:ring-white/10"
              >
                <span className="flex aspect-video items-center justify-center bg-white dark:bg-zinc-800">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logo}
                      alt={`${c.name} logo`}
                      className="max-h-full max-w-full object-contain p-3 transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-cyan-600">
                      {c.name.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="block truncate text-sm font-semibold">
                    {c.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {c.category}
                    {c.countryName ? ` • ${c.countryName}` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
