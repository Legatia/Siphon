"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CosmeticPreview } from "@/components/cosmetic-preview";
import type { CosmeticSlots, CosmeticItem } from "@siphon/core";
import { Sparkles, Save } from "lucide-react";

const SLOT_CONFIG = [
  { key: "aura" as const, label: "Aura", description: "Ambient glow effect" },
  { key: "trail" as const, label: "Trail", description: "Movement trail" },
  { key: "crown" as const, label: "Crown", description: "Head adornment" },
  { key: "emblem" as const, label: "Emblem", description: "Identity mark" },
];

interface EquipCosmeticsProps {
  shardId: string;
  currentSlots: CosmeticSlots;
  onSave?: (slots: CosmeticSlots) => void;
}

export function EquipCosmetics({
  shardId,
  currentSlots,
  onSave,
}: EquipCosmeticsProps) {
  const { address } = useAccount();
  const [inventory, setInventory] = useState<CosmeticItem[]>([]);
  const [slots, setSlots] = useState<CosmeticSlots>(currentSlots);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    fetch(`/api/cosmetics/inventory?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => setInventory(data))
      .catch(() => {});
  }, [address]);

  const getCosmeticsForSlot = (slot: string) => {
    return inventory.filter((item) => item.slot === slot);
  };

  const getSelectedCosmetic = (cosmeticId: string | null) => {
    if (!cosmeticId) return null;
    return inventory.find((item) => item.id === cosmeticId) || null;
  };

  const handleSlotChange = (
    slot: keyof CosmeticSlots,
    value: string
  ) => {
    setSaved(false);
    setSlots((prev) => ({
      ...prev,
      [slot]: value === "none" ? null : value,
    }));
  };

  const handleSave = async () => {
    if (!address) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/shards/${shardId}/cosmetics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cosmeticSlots: slots,
          ownerId: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save cosmetics");
        return;
      }

      setSaved(true);
      onSave?.(slots);
    } catch {
      setError("Failed to save cosmetics");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(slots) !== JSON.stringify(currentSlots);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-siphon-teal" />
          Equip Cosmetics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SLOT_CONFIG.map(({ key, label, description }) => {
          const available = getCosmeticsForSlot(key);
          const selected = getSelectedCosmetic(slots[key]);

          return (
            <div
              key={key}
              className="flex items-center gap-4 p-3 rounded-lg bg-abyss/50 border border-siphon-teal/5"
            >
              {/* Slot preview */}
              <CosmeticPreview
                slot={key}
                previewData={selected?.previewData || ""}
                size="sm"
              />

              {/* Slot info and selector */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div>
                  <p className="text-sm font-medium text-foam">{label}</p>
                  <p className="text-xs text-ghost">{description}</p>
                </div>

                <Select
                  value={slots[key] || "none"}
                  onValueChange={(val) => handleSlotChange(key, val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None equipped" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None
                    </SelectItem>
                    {available.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.rarity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {saved && (
          <p className="text-siphon-teal text-sm">Cosmetics saved.</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Cosmetics"}
        </Button>
      </CardContent>
    </Card>
  );
}
