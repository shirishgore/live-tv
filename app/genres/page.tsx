import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { getMeta } from "@/lib/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Genres — Kage TV",
  description: "Browse live TV channels by genre on Kage TV.",
  alternates: { canonical: "/genres" },
};

export default async function GenresPage() {
  let categories: { name: string; count: number }[] = [];
  try {
    const meta = await getMeta();
    categories = meta?.categories ?? [];
  } catch {
    // Page still renders; tiles will be empty.
  }

  return (
    <div>
      <h1 className="mt-6 text-2xl font-bold">Genres</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Pick a genre to browse its live channels.
      </p>

      <div className="mt-4">
        <AdSlot />
      </div>

      {categories.length === 0 ? (
        <p className="mt-10 text-center text-zinc-400">
          No genres available right now.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.name}
              href={`/browse?category=${encodeURIComponent(c.name)}`}
              className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 hover:border-[var(--accent)]"
            >
              <span className="block text-base font-bold">{c.name}</span>
              <span className="mt-1 block text-sm text-zinc-400">
                {c.count} channel{c.count === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
