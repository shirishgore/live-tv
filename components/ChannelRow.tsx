"use client";

import { useRef } from "react";
import type { Channel } from "@/lib/types";
import ChannelCard from "@/components/ChannelCard";

export default function ChannelRow({
  index,
  title,
  channels,
}: {
  index: number;
  title: string;
  channels: Channel[];
}) {
  const scroller = useRef<HTMLDivElement>(null);

  if (channels.length === 0) return null;

  const num = String(index + 1).padStart(2, "0");

  function scrollBy(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section aria-label={title} className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          <span className="mr-2 text-[var(--accent)]">[{num}]</span>
          {title}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label={`Scroll ${title} left`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-200 hover:border-[var(--accent)] hover:text-white"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label={`Scroll ${title} right`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-200 hover:border-[var(--accent)] hover:text-white"
          >
            ›
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="row-scroll no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6"
      >
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="w-[140px] shrink-0 sm:w-[160px]"
          >
            <ChannelCard channel={channel} related={channels} />
          </div>
        ))}
      </div>
    </section>
  );
}
