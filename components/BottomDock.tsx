"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Live TV" },
  { href: "/movies", label: "Movies" },
  { href: "/anime", label: "Anime" },
  { href: "/sports", label: "Sports" },
  { href: "/genres", label: "Genres" },
  { href: "/list", label: "List" },
  { href: "/settings", label: "Settings" },
];

export default function BottomDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3"
    >
      <ul className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-[#141414]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur no-scrollbar">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "block rounded-full bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-black sm:px-4"
                    : "block rounded-full px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white sm:px-4"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
