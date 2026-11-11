import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Kage TV",
  description:
    "How Kage TV handles your data: no accounts, no sign-in, and no personal data sold.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <article className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-zinc-500">Last updated: 10 November 2026</p>

        <p className="leading-relaxed text-zinc-300">
          Kage TV is designed to work without knowing who you are. This page
          explains what is stored on your device and what is not collected.
        </p>

        <h2 className="text-xl font-semibold">No accounts, no sign-in</h2>
        <p className="leading-relaxed text-zinc-300">
          There are no accounts and no sign-in. We do not ask for your name,
          email address, or any other personal information, and we do not
          sell personal data — because we do not collect it.
        </p>

        <h2 className="text-xl font-semibold">Watchlist and history</h2>
        <p className="leading-relaxed text-zinc-300">
          Your watchlist, watch history, and Continue Watching list are
          stored on your own device under an anonymous device id. That id is
          a random identifier with no link to your identity; it exists only
          so the site can remember your lists between visits. Clearing your
          browser data removes it.
        </p>

        <h2 className="text-xl font-semibold">Country preference</h2>
        <p className="leading-relaxed text-zinc-300">
          Your country preference is stored in a cookie on your device so the
          site can show you relevant channels on your next visit. It is not
          sent anywhere else.
        </p>

        <h2 className="text-xl font-semibold">Advertising and cookies</h2>
        <p className="leading-relaxed text-zinc-300">
          This site shows ads served by Google AdSense. Google and its
          partners may use cookies to serve ads based on your visits to this
          and other sites. You can opt out of personalised advertising by
          visiting Google&apos;s Ads Settings. Third-party vendors, including
          Google, use cookies to serve ads based on a user&apos;s prior
          visits to this website or other websites.
        </p>

        <h2 className="text-xl font-semibold">Streams from broadcasters</h2>
        <p className="leading-relaxed text-zinc-300">
          Video streams play directly from third-party broadcasters&apos;
          servers. Those broadcasters may log requests to their own servers
          under their own privacy policies, which Kage TV does not control.
        </p>

        <h2 className="text-xl font-semibold">Changes to this policy</h2>
        <p className="leading-relaxed text-zinc-300">
          If this policy changes, the updated version will be posted on this
          page with a new last-updated date.
        </p>
      </article>
    </main>
  );
}
