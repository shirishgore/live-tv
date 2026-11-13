import { Suspense } from "react";
import BrowseClient from "@/components/BrowseClient";
import AdSlot from "@/components/AdSlot";
import { getMeta, listChannels } from "@/lib/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse channels — Kage TV",
  description: "Search and browse all live TV channels on Kage TV.",
  alternates: { canonical: "/browse" },
};

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
  country?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const category = first(params.category);
  const country = first(params.country);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const [result, meta] = await Promise.all([
    listChannels({ q, category, country, page, pageSize: PAGE_SIZE }),
    getMeta().catch(() => null),
  ]).catch(() => [null, null] as const);

  const channels = result?.channels ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  return (
    <div>
      <h1 className="mt-6 text-2xl font-bold">Live TV</h1>
      <div className="mt-4">
        <AdSlot />
      </div>
      <Suspense fallback={<p className="mt-8 text-zinc-400">Loading…</p>}>
        <BrowseClient
          channels={channels}
          total={total}
          page={page}
          totalPages={totalPages}
          q={q}
          category={category}
          country={country}
          categories={(meta?.categories ?? []).map((c) => c.name)}
          countries={meta?.countries ?? []}
          preferredCountry={meta?.country ?? null}
        />
      </Suspense>
      <div className="mt-8">
        <AdSlot />
      </div>
    </div>
  );
}
