"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/components/wallet-connect";
import { cn } from "@/lib/utils";
import { Waves, Compass, Store, Swords, Home, Combine, ShoppingBag, Landmark, Target, Crown } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/drift", label: "Drift", icon: Compass },
  { href: "/shelter", label: "Shelter", icon: Store },
  { href: "/battle", label: "Battles", icon: Swords },
  { href: "/fusion", label: "Fusion", icon: Combine },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/marketplace", label: "Market", icon: ShoppingBag },
  { href: "/bounties", label: "Bounties", icon: Target },
  { href: "/subscribe", label: "Subscribe", icon: Crown },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-siphon-teal/10 bg-midnight/50 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <Waves className="h-6 w-6 text-siphon-teal group-hover:drop-shadow-[0_0_8px_rgba(0,212,170,0.6)] transition-all" />
              <span className="font-bold text-lg text-foam tracking-tight">
                Siphon
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "text-siphon-teal bg-siphon-teal/10"
                        : "text-ghost hover:text-foam hover:bg-midnight"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
