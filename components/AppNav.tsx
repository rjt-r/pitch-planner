"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-semibold text-white tracking-tight">Pitch Planner</span>
          <span className="text-xs text-zinc-600 hidden sm:block">Women&apos;s football</span>
        </div>

        {/* Nav links */}
        <nav className="flex gap-1">
          {[
            { href: "/",           label: "Session" },
            { href: "/forecaster", label: "Week"    },
          ].map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-green-600/15 text-green-500 ring-1 ring-green-600/40"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
