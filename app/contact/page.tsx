import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Kage TV",
  description:
    "How to report a dead channel or request a channel removal from Kage TV.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <article className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Contact</h1>

        <p className="leading-relaxed text-zinc-300">
          Kage TV has no support inbox and no contact form — reports are
          handled through the site owner&apos;s GitHub project. Please
          include the channel name and what happened (for example, the stream
          does not load, or the wrong channel is listed).
        </p>

        <h2 className="text-xl font-semibold">Report a dead channel</h2>
        <p className="leading-relaxed text-zinc-300">
          If a channel will not play, first try another stream for the same
          channel — the player attempts alternate sources automatically. If
          none of them work, report it on the site owner&apos;s GitHub
          repository so the listing can be checked and updated.
        </p>

        <h2 className="text-xl font-semibold">Request a channel removal</h2>
        <p className="leading-relaxed text-zinc-300">
          Broadcasters and rights holders can ask for a channel to be
          removed from the directory. Please raise the request on the site
          owner&apos;s GitHub, stating the channel name and that you are
          acting for the broadcaster or rights holder. We handle removal
          requests as quickly as we can.
        </p>

        <h2 className="text-xl font-semibold">Problems with the channel listing itself</h2>
        <p className="leading-relaxed text-zinc-300">
          Channel data comes from the public iptv-org catalog. If a channel
          is miscategorised, duplicated, or its stream address is wrong at
          the source, you can also report it directly to iptv-org on GitHub
          at{" "}
          <a
            href="https://github.com/iptv-org/iptv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 underline hover:text-teal-300"
          >
            github.com/iptv-org/iptv
          </a>
          .
        </p>

        <p className="leading-relaxed text-zinc-400">
          Don&apos;t send personal information in a report — just the
          channel name and what happened.
        </p>
      </article>
    </main>
  );
}
