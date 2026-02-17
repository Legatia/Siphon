"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CosmeticCard } from "@/components/cosmetic-card";
import type { CosmeticItem } from "@siphon/core";
import { ShoppingBag, Plus } from "lucide-react";
import Link from "next/link";

const SLOT_OPTIONS = [
  { label: "All Slots", value: "all" },
  { label: "Aura", value: "aura" },
  { label: "Trail", value: "trail" },
  { label: "Crown", value: "crown" },
  { label: "Emblem", value: "emblem" },
];

const RARITY_OPTIONS = [
  { label: "All Rarities", value: "all" },
  { label: "Common", value: "common" },
  { label: "Rare", value: "rare" },
  { label: "Epic", value: "epic" },
  { label: "Legendary", value: "legendary" },
];

export default function MarketplacePage() {
  const { address } = useAccount();
  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [slotFilter, setSlotFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Fetch cosmetics catalog
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (slotFilter !== "all") params.set("slot", slotFilter);
    if (rarityFilter !== "all") params.set("rarity", rarityFilter);

    fetch(`/api/cosmetics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCosmetics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slotFilter, rarityFilter]);

  // Fetch owned cosmetics
  useEffect(() => {
    if (!address) return;

    fetch(`/api/cosmetics/inventory?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>(
          data.map((item: { id: string }) => item.id)
        );
        setOwnedIds(ids);
      });
  }, [address]);

  const handlePurchase = async (cosmeticId: string) => {
    if (!address) return;

    setPurchasing(cosmeticId);
    try {
      const res = await fetch("/api/cosmetics/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cosmeticId, ownerId: address }),
      });

      if (res.ok) {
        setOwnedIds((prev) => new Set([...prev, cosmeticId]));
      }
    } catch (error) {
      console.error("Purchase error:", error);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foam">Marketplace</h1>
          <p className="text-ghost text-sm mt-1">
            Browse and collect cosmetics for your Shards.
          </p>
        </div>
        <Link href="/marketplace/create">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-40">
          <Select value={slotFilter} onValueChange={setSlotFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Slot" />
            </SelectTrigger>
            <SelectContent>
              {SLOT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={rarityFilter} onValueChange={setRarityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Rarity" />
            </SelectTrigger>
            <SelectContent>
              {RARITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-ghost text-sm animate-pulse">
          Loading cosmetics...
        </div>
      ) : cosmetics.length === 0 ? (
        <Card className="p-8 text-center">
          <ShoppingBag className="h-12 w-12 text-siphon-teal/30 mx-auto mb-4" />
          <p className="text-ghost">
            No cosmetics found. Be the first to create one!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cosmetics.map((cosmetic) => (
            <CosmeticCard
              key={cosmetic.id}
              cosmetic={cosmetic}
              owned={ownedIds.has(cosmetic.id)}
              onAction={() => handlePurchase(cosmetic.id)}
              actionDisabled={purchasing === cosmetic.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
