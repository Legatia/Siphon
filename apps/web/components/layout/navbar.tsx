"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WalletConnect } from "@/components/wallet-connect";
import { cn } from "@/lib/utils";
import { LENDING_ENABLED } from "@/lib/features";
import { Waves, Compass, Store, Swords, Home, Combine, ShoppingBag, Landmark, Target, Download, Crown, Menu, X, Trophy, Binoculars, CalendarRange, Medal, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/drift", label: "Drift", icon: Compass },
  { href: "/shelter", label: "Shelter", icon: Store },
  { href: "/battle", label: "Battles", icon: Swords },
  { href: "/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/spectate", label: "Spectate", icon: Binoculars },
  { href: "/seasons", label: "Seasons", icon: CalendarRange },
  { href: "/achievements", label: "Achievements", icon: Medal },
  { href: "/fusion", label: "Fusion", icon: Combine },
  ...(LENDING_ENABLED ? [{ href: "/loans", label: "Loans", icon: Landmark }] : []),
  { href: "/marketplace", label: "Market", icon: ShoppingBag },
  { href: "/bounties", label: "Bounties", icon: Target },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/download", label: "Download", icon: Download },
  { href: "/subscribe", label: "Subscribe", icon: Crown },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b-2 border-siphon-teal/35 bg-[rgba(10,18,30,0.9)] backdrop-blur-sm shadow-[0_3px_0_rgba(2,7,13,0.95)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <Waves className="h-6 w-6 text-siphon-teal group-hover:scale-110 transition-transform" />
              <span className="pixel-title text-xs sm:text-sm text-foam tracking-tight">
                Siphon
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-2 rounded-none border-2 text-sm font-medium transition-all",
                      isActive
                        ? "text-abyss bg-siphon-teal border-siphon-teal shadow-[0_3px_0_rgba(2,7,13,0.95)]"
                        : "text-ghost border-transparent hover:text-foam hover:bg-midnight/70 hover:border-siphon-teal/25"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WalletConnect />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-ghost hover:text-foam transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t-2 border-siphon-teal/20 bg-[rgba(10,18,30,0.96)] backdrop-blur-sm">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-none border-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-abyss bg-siphon-teal border-siphon-teal"
                      : "text-ghost border-transparent hover:text-foam hover:bg-midnight hover:border-siphon-teal/20"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
