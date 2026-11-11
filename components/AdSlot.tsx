"use client";

import { useEffect } from "react";
import { ADSENSE_CLIENT } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type AdSlotProps = {
  /** AdSense ad unit slot ID. When omitted, only the labelled empty container renders — no ad is requested. */
  slot?: string;
  className?: string;
};

/**
 * Labelled advertisement container. Only requests an ad when a `slot`
 * prop is supplied; without a slot it renders the labelled box only and
 * never pushes a blank unit to adsbygoogle.
 */
export default function AdSlot({ slot, className }: AdSlotProps) {
  useEffect(() => {
    if (!slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded (e.g. ad blocker) — fail silently.
    }
  }, [slot]);

  return (
    <div
      role="complementary"
      aria-label="Advertisement"
      className={`rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 ${className ?? ""}`}
    >
      <p className="text-center text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        Advertisement
      </p>
      {slot ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </div>
  );
}
