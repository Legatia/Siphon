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
import { Input } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { CosmeticCard } from "@/components/cosmetic-card";
import type { CosmeticItem, Shard } from "@siphon/core";
import {
  ShoppingBag,
  Plus,
  Loader2,
  ArrowRightLeft,
  Tag,
} from "lucide-react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { parseEther, formatEther } from "viem";
import {
  SHARD_MARKETPLACE_ABI,
  SHARD_MARKETPLACE_ADDRESS,
  SHARD_REGISTRY_LOCK_ABI,
  SHARD_REGISTRY_ADDRESS,
  getWalletClient,
  publicClient,
  idToBytes32,
} from "@/lib/contracts";
import { toast } from "sonner";
import { useSmartWrite } from "@/hooks/use-smart-write";

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

interface ShardListing {
  shardId: string;
  seller: string;
  price: string; // in ETH
  listedAt: number;
  shardName?: string;
  shardSpecies?: string;
  level?: number;
  elo?: number;
  estimatedValue?: number;
}

export default function MarketplacePage() {
  const { address } = useAccount();
  const { smartWrite, isSmartWallet } = useSmartWrite();
  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [slotFilter, setSlotFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Shard trading state
  const [myShards, setMyShards] = useState<Shard[]>([]);
  const [listings, setListings] = useState<ShardListing[]>([]);
  const [listShardId, setListShardId] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [listingLoading, setListingLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

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

  // Fetch shard listings from DB
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    params.set("sort", sortBy);
    fetch(`/api/marketplace?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setListings(
          data.map((row: any) => ({
            shardId: row.shard_id,
            seller: row.seller,
            price: row.price,
            listedAt: row.created_at,
            shardName: row.shard_name,
            shardSpecies: row.shard_species,
            level: row.level,
            elo: row.elo,
            estimatedValue: row.estimatedValue,
          }))
        );
      })
      .catch(() => {});
  }, [searchQuery, sortBy, minPrice, maxPrice]);

  // Fetch owned cosmetics + shards
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

    fetch(`/api/shards?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => setMyShards(data))
      .catch(() => {});
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
        toast.success("Cosmetic purchased!");
      }
    } catch (error) {
      toast.error("Purchase failed");
      console.error("Purchase error:", error);
    } finally {
      setPurchasing(null);
    }
  };

  const handleListShard = async () => {
    if (!address || !listShardId || !listPrice) return;

    setListingLoading(true);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      // Check if marketplace is already approved as locker
      const isApproved = await publicClient.readContract({
        address: SHARD_REGISTRY_ADDRESS as `0x${string}`,
        abi: SHARD_REGISTRY_LOCK_ABI,
        functionName: "approvedLockers",
        args: [address, SHARD_MARKETPLACE_ADDRESS as `0x${string}`],
      });

      // Then list the shard
      const shardIdHex = idToBytes32(listShardId);
      const priceWei = parseEther(listPrice);
      let hash: string;

      if (!isApproved && isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: SHARD_REGISTRY_ADDRESS as `0x${string}`,
            abi: SHARD_REGISTRY_LOCK_ABI,
            functionName: "approveLock",
            args: [SHARD_MARKETPLACE_ADDRESS as `0x${string}`],
          },
          {
            address: SHARD_MARKETPLACE_ADDRESS as `0x${string}`,
            abi: SHARD_MARKETPLACE_ABI,
            functionName: "listShard",
            args: [shardIdHex, priceWei],
          },
        ]);
        if (!batchId) throw new Error("Batch transaction unavailable");
        hash = String(batchId);
      } else {
        if (!isApproved) {
          const approveHash = await walletClient.writeContract({
            address: SHARD_REGISTRY_ADDRESS as `0x${string}`,
            abi: SHARD_REGISTRY_LOCK_ABI,
            functionName: "approveLock",
            args: [SHARD_MARKETPLACE_ADDRESS as `0x${string}`],
            account: address,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        const txHash = await walletClient.writeContract({
          address: SHARD_MARKETPLACE_ADDRESS as `0x${string}`,
          abi: SHARD_MARKETPLACE_ABI,
          functionName: "listShard",
          args: [shardIdHex, priceWei],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        hash = txHash;
      }

      // Persist listing to DB
      const shard = myShards.find((s) => s.id === listShardId);
      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shardId: listShardId,
          seller: address,
          price: listPrice,
          shardName: shard?.name,
          shardSpecies: shard?.species,
          txHash: hash,
        }),
      });

      // Add to local listings
      setListings((prev) => [
        ...prev,
        {
          shardId: listShardId,
          seller: address,
          price: listPrice,
          listedAt: Date.now(),
          shardName: shard?.name,
          shardSpecies: shard?.species,
        },
      ]);
      setListShardId("");
      setListPrice("");
      toast.success("Shard listed!");
    } catch (error) {
      toast.error("Failed to list shard");
      console.error("List shard error:", error);
    } finally {
      setListingLoading(false);
    }
  };

  const handleBuyShard = async (listing: ShardListing) => {
    if (!address) return;

    setBuyingId(listing.shardId);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const shardIdHex = idToBytes32(listing.shardId);
      const priceWei = parseEther(listing.price);

      const hash = await walletClient.writeContract({
        address: SHARD_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: SHARD_MARKETPLACE_ABI,
        functionName: "buyShard",
        args: [shardIdHex],
        value: priceWei,
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Update DB
      await fetch("/api/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shardId: listing.shardId, state: "sold" }),
      });

      // Remove from listings
      setListings((prev) =>
        prev.filter((l) => l.shardId !== listing.shardId)
      );
      toast.success("Shard purchased!");
    } catch (error) {
      toast.error("Failed to buy shard");
      console.error("Buy shard error:", error);
    } finally {
      setBuyingId(null);
    }
  };

  const handleCancelListing = async (shardId: string) => {
    if (!address) return;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const shardIdHex = idToBytes32(shardId);

      const hash = await walletClient.writeContract({
        address: SHARD_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: SHARD_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [shardIdHex],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Update DB
      await fetch("/api/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shardId, state: "cancelled" }),
      });

      setListings((prev) => prev.filter((l) => l.shardId !== shardId));
      toast.success("Listing cancelled");
    } catch (error) {
      toast.error("Failed to cancel listing");
      console.error("Cancel listing error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="pixel-title text-[14px] text-foam">Marketplace</h1>
          <p className="text-ghost mt-2">
            Browse cosmetics and trade Shards.
          </p>
        </div>
        <Link href="/marketplace/create">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create
          </Button>
        </Link>
      </div>

      <Tabs.Root defaultValue="cosmetics" className="space-y-4 reveal-up" style={{ animationDelay: "70ms" }}>
        <Tabs.List className="flex border-b border-siphon-teal/20">
          <Tabs.Trigger
            value="cosmetics"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <ShoppingBag className="h-4 w-4" />
            Cosmetics
          </Tabs.Trigger>
          <Tabs.Trigger
            value="shards"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Shard Trading
          </Tabs.Trigger>
        </Tabs.List>

        {/* COSMETICS TAB */}
        <Tabs.Content value="cosmetics" className="space-y-4">
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

          {loading ? (
            <div className="text-ghost text-sm animate-pulse">
              Loading cosmetics...
            </div>
          ) : cosmetics.length === 0 ? (
            <Card className="border-siphon-teal/25 bg-[#071123]/90 p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-siphon-teal/30 mx-auto mb-4" />
              <p className="text-ghost">
                No cosmetics found. Be the first to create one!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cosmetics.map((cosmetic, idx) => (
                <CosmeticCard
                  key={cosmetic.id}
                  cosmetic={cosmetic}
                  owned={ownedIds.has(cosmetic.id)}
                  onAction={() => handlePurchase(cosmetic.id)}
                  actionDisabled={purchasing === cosmetic.id}
                  className="reveal-up"
                  style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* SHARD TRADING TAB */}
        <Tabs.Content value="shards" className="space-y-6">
          {!address ? (
            <Card className="border-siphon-teal/25 bg-[#071123]/90 p-8 text-center">
              <ArrowRightLeft className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost">
                Connect your wallet to trade Shards.
              </p>
            </Card>
          ) : (
            <>
              {/* List a shard */}
              <Card className="border-siphon-teal/30 bg-[#071123]/90 p-4 space-y-3 reveal-up" style={{ animationDelay: "110ms" }}>
                <h3 className="text-sm font-semibold text-foam flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  List a Shard for Sale
                </h3>
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-ghost block mb-1">
                      Select Shard
                    </label>
                    <select
                      value={listShardId}
                      onChange={(e) => setListShardId(e.target.value)}
                      className="flex h-10 w-full border border-siphon-teal/20 bg-abyss px-3 py-2 text-sm text-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30 transition-colors"
                    >
                      <option value="" className="bg-abyss text-ghost">
                        Choose a shard...
                      </option>
                      {myShards.map((shard) => (
                        <option
                          key={shard.id}
                          value={shard.id}
                          className="bg-abyss text-foam"
                        >
                          {shard.name} - {shard.species} (Lvl {shard.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-ghost block mb-1">
                      Price (ETH)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      placeholder="0.1"
                    />
                  </div>
                  <Button
                    onClick={handleListShard}
                    disabled={
                      !listShardId || !listPrice || listingLoading
                    }
                  >
                    {listingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "List Shard"
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-ghost/50">
                  2.5% protocol fee on sales. Shard is locked until sold or
                  listing cancelled.
                </p>
              </Card>

              {/* Active listings */}
              <div>
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <div className="flex-1 min-w-[220px]">
                    <label className="text-xs text-ghost block mb-1">Search</label>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name or species"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-ghost block mb-1">Min ETH</label>
                    <Input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-ghost block mb-1">Max ETH</label>
                    <Input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="w-44">
                    <label className="text-xs text-ghost block mb-1">Sort</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="flex h-10 w-full border border-siphon-teal/20 bg-abyss px-3 py-2 text-sm text-foam"
                    >
                      <option value="newest">Newest</option>
                      <option value="price_asc">Price low-high</option>
                      <option value="price_desc">Price high-low</option>
                      <option value="value_desc">Estimated value</option>
                    </select>
                  </div>
                </div>
                {listings.length === 0 ? (
                  <Card className="border-siphon-teal/25 bg-[#071123]/90 p-8 text-center">
                    <ArrowRightLeft className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
                    <p className="text-ghost">
                      No shards listed for sale yet.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {listings.map((listing, idx) => (
                      <Card
                        key={listing.shardId}
                        className="border-siphon-teal/20 bg-[#071123]/85 p-4 reveal-up"
                        style={{ animationDelay: `${Math.min(idx * 55, 330)}ms` }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-medium text-foam">
                              {listing.shardName || listing.shardId.slice(0, 8)}
                            </p>
                            {listing.shardSpecies && (
                              <p className="text-xs text-ghost">
                                {listing.shardSpecies}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-bold text-siphon-teal">
                            <AnimatedNumber
                              value={Number(listing.price)}
                              decimals={3}
                              suffix=" ETH"
                            />
                          </span>
                        </div>
                        <p className="text-[11px] text-ghost mb-1">
                          Lvl {listing.level ?? "?"} · ELO {listing.elo ?? "?"}
                        </p>
                        {typeof listing.estimatedValue === "number" && (
                          <p className="text-[11px] text-ember mb-1">
                            Estimated value: ~
                            <AnimatedNumber
                              value={listing.estimatedValue}
                              decimals={3}
                              suffix=" ETH"
                            />
                          </p>
                        )}
                        <p className="text-[10px] text-ghost/50 mb-3">
                          Seller: {listing.seller.slice(0, 6)}...
                          {listing.seller.slice(-4)}
                        </p>
                        {listing.seller.toLowerCase() ===
                        address.toLowerCase() ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              handleCancelListing(listing.shardId)
                            }
                          >
                            Cancel Listing
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleBuyShard(listing)}
                            disabled={buyingId === listing.shardId}
                          >
                            {buyingId === listing.shardId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Buy Shard"
                            )}
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
