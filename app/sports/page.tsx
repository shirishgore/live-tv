import { Suspense } from "react";
import BrowseClient from "@/components/BrowseClient";
import AdSlot from "@/components/AdSlot";
import { getMeta, listChannels } from "@/lib/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sports — Kage TV",
  description: "Watch live sports channels on Kage TV.",
  alternates: { canonical: "/sports" },
};

const PAGE_SIZE = 20;
const PRESET = "Sports";

type SearchParams = {
  q?: string | string[];
  country?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function SportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const country = first(params.country);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const [result, meta] = await Promise.all([
    listChannels({ q, category: PRESET, country, page, pageSize: PAGE_SIZE }),
    getMeta().catch(() => null),
  ]).catch(() => [null, null] as const);

  return (
    <div>
      <h1 className="mt-6 text-2xl font-bold">Sports</h1>
      <div className="mt-4">
        <AdSlot />
      </div>
      <Suspense fallback={<p className="mt-8 text-zinc-400">Loading…</p>}>
        <BrowseClient
          channels={result?.channels ?? []}
          total={result?.total ?? 0}
          page={page}
          totalPages={result?.totalPages ?? 1}
          q={q}
          category={PRESET}
          country={country}
          categories={[]}
          countries={meta?.countries ?? []}
          presetCategory={PRESET}
        />
      </Suspense>
      <div className="mt-8">
        <AdSlot />
      </div>
    </div>
  );
}
