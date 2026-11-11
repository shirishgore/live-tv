import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Kage TV",
  description:
    "Free directory and player for publicly available live TV channels.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <article className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">About Kage TV</h1>

        <p className="leading-relaxed text-zinc-300">
          Kage TV is a free directory and player for publicly available live
          TV channels. It lists channels from the public iptv-org catalog and
          lets you watch their streams in your browser — no subscription, no
          sign-in, and no app to install.
        </p>

        <h2 className="text-xl font-semibold">No video is hosted here</h2>
        <p className="leading-relaxed text-zinc-300">
          Kage TV does not host, upload, or store any video. Every stream
          plays directly from its broadcaster&apos;s own servers, and every
          channel, logo, and name belongs to its respective broadcaster.
          Channel listings come from iptv-org, a community-maintained public
          database of freely available streams.
        </p>

        <h2 className="text-xl font-semibold">How it stays free</h2>
        <p className="leading-relaxed text-zinc-300">
          The site is supported by advertising through Google AdSense. Ads
          help cover hosting costs; they do not change which channels are
          listed or how streams play.
        </p>

        <h2 className="text-xl font-semibold">Streams can go offline</h2>
        <p className="leading-relaxed text-zinc-300">
          Because streams come from third-party broadcasters, a channel can
          go offline, change its stream address, or become unavailable in
          your region at any time. When a stream fails, the player tries
          other available sources for that channel where they exist. To
          report a dead channel or ask for a channel to be removed, see the{" "}
          <a href="/contact" className="text-teal-400 underline hover:text-teal-300">
            Contact page
          </a>
          .
        </p>
      </article>
    </main>
  );
}
