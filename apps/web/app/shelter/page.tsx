"use client";

import { useEffect, useState } from "react";
import type { Shard } from "@siphon/core";
import { ShardCard } from "@/components/shard-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Store } from "lucide-react";

const typeFilters = [
  { label: "All", value: "" },
  { label: "Oracle", value: "0" },
  { label: "Cipher", value: "1" },
  { label: "Scribe", value: "2" },
  { label: "Muse", value: "3" },
  { label: "Architect", value: "4" },
  { label: "Advocate", value: "5" },
  { label: "Sentinel", value: "6" },
  { label: "Mirror", value: "7" },
];

export default function ShelterPage() {
  const [shards, setShards] = useState<Shard[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);

    fetch(`/api/shelter?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setShards(data);
        setLoading(false);
      });
  }, [typeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">The Shelter</h1>
        <p className="text-ghost text-sm mt-1">
          Browse captured Shards. Bond with one to begin training.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {typeFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={typeFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-ghost text-sm animate-pulse">Loading Shards...</div>
      ) : shards.length === 0 ? (
        <Card className="p-8 text-center">
          <Store className="h-12 w-12 text-siphon-teal/30 mx-auto mb-4" />
          <p className="text-ghost">
            No Shards in the Shelter yet. Capture some from the Drift first!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shards.map((shard) => (
            <ShardCard key={shard.id} shard={shard} showActions />
          ))}
        </div>
      )}
    </div>
  );
}
