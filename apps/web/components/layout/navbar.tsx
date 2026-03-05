"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { WalletConnect } from "@/components/wallet-connect";
import { cn } from "@/lib/utils";
import { LENDING_ENABLED } from "@/lib/features";
import {
  Waves,
  Compass,
  Store,
  Swords,
  Home,
  Combine,
  ShoppingBag,
  Landmark,
  Target,
  Download,
  Crown,
  Menu,
  X,
  Trophy,
  Binoculars,
  CalendarRange,
  Medal,
  BarChart3,
  Sparkles,
  ChevronDown,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/drift", label: "Drift", icon: Compass },
  { href: "/summon", label: "Summon", icon: Sparkles },
  { href: "/battle", label: "Battles", icon: Swords },
  { href: "/marketplace", label: "Market", icon: ShoppingBag },
  { href: "/bounties", label: "Bounties", icon: Target },
];

const competeNav: NavItem[] = [
  { href: "/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/spectate", label: "Spectate", icon: Binoculars },
  { href: "/seasons", label: "Seasons", icon: CalendarRange },
  { href: "/achievements", label: "Achievements", icon: Medal },
];

const buildNav: NavItem[] = [
  { href: "/shelter", label: "Shelter", icon: Store },
  { href: "/fusion", label: "Fusion", icon: Combine },
  ...(LENDING_ENABLED ? [{ href: "/loans", label: "Loans", icon: Landmark }] : []),
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

const utilityNav: NavItem[] = [
  { href: "/download", label: "Download", icon: Download },
  { href: "/subscribe", label: "Subscribe", icon: Crown },
];

const mobileNavItems: NavItem[] = [
  ...primaryNav,
  ...competeNav,
  ...buildNav,
  ...utilityNav,
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isItemActive = (item: NavItem) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

  const renderDesktopDropdown = (label: string, items: NavItem[]) => {
    const isActive = items.some(isItemActive);
    return (
      <div key={label} className="relative group">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-2 rounded-none border-2 text-sm font-medium transition-all",
            isActive
              ? "text-abyss bg-siphon-teal border-siphon-teal shadow-[0_3px_0_rgba(2,7,13,0.95)]"
              : "text-ghost border-transparent hover:text-foam hover:bg-midnight/70 hover:border-siphon-teal/25"
          )}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <div className="absolute left-0 top-full z-50 hidden min-w-44 border-2 border-siphon-teal/35 bg-[rgba(10,18,30,0.98)] shadow-[0_3px_0_rgba(2,7,13,0.95)] group-hover:block group-focus-within:block">
          {items.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm border-b border-siphon-teal/15 last:border-b-0",
                  active
                    ? "text-abyss bg-siphon-teal"
                    : "text-ghost hover:text-foam hover:bg-midnight/70"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

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
              {primaryNav.map((item) => {
                const isActive = isItemActive(item);
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
              {renderDesktopDropdown("Compete", competeNav)}
              {renderDesktopDropdown("Build", buildNav)}
              {renderDesktopDropdown("More", utilityNav)}
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
            {mobileNavItems.map((item) => {
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
