"use client";

import { useState } from "react";
import type { Channel } from "@/lib/types";
import DetailModal from "@/components/DetailModal";

export function channelInitials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export default function ChannelCard({
  channel,
  related,
  progress,
}: {
  channel: Channel;
  related?: Channel[];
  progress?: number;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const category = channel.categories?.[0];
  const quality = channel.quality;
  const logo = channel.logo;

  return (
    <>
      <article className="w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`More about ${channel.name}`}
          className="block w-full text-left"
        >
          <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[#161616]">
            {logo && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#1c1c1c] text-3xl font-bold text-zinc-400">
                {channelInitials(channel.name)}
              </span>
            )}
            {quality && (
              <span className="absolute right-2 top-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {quality}
              </span>
            )}
            {typeof progress === "number" && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                <span
                  className="block h-full bg-[var(--accent)]"
                  style={{
                    width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                  }}
                />
              </span>
            )}
          </span>
          <span className="mt-2 block truncate text-sm font-medium text-white">
            {channel.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {channel.country && (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-300">
                {channel.country}
              </span>
            )}
            {category && (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-300">
                {category}
              </span>
            )}
          </span>
        </button>
      </article>
      {open && (
        <DetailModal
          channel={channel}
          related={related}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
