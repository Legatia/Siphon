"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubscriptionGate } from "@/components/subscription-gate";
import { CosmeticPreview } from "@/components/cosmetic-preview";
import { Paintbrush } from "lucide-react";

const SLOT_OPTIONS = [
  { label: "Aura", value: "aura" },
  { label: "Trail", value: "trail" },
  { label: "Crown", value: "crown" },
  { label: "Emblem", value: "emblem" },
];

const RARITY_OPTIONS = [
  { label: "Common", value: "common" },
  { label: "Rare", value: "rare" },
  { label: "Epic", value: "epic" },
  { label: "Legendary", value: "legendary" },
];

function CosmeticCreatorForm() {
  const { address } = useAccount();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slot, setSlot] = useState("aura");
  const [rarity, setRarity] = useState("common");
  const [description, setDescription] = useState("");
  const [previewData, setPreviewData] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slot,
          rarity,
          description,
          previewData,
          price: parseInt(price, 10) || 0,
          creatorId: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create cosmetic");
        return;
      }

      router.push("/marketplace");
    } catch {
      setError("Failed to create cosmetic");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="pixel-title text-[14px] text-foam">Create Cosmetic</h1>
        <p className="text-ghost mt-2">
          Design and sell cosmetics on the marketplace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="md:col-span-2 border-siphon-teal/30 bg-[#071123]/90 reveal-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base pixel-title text-[10px]">
              <Paintbrush className="h-4 w-4 text-siphon-teal" />
              Cosmetic Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-ghost">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Radiant Halo"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-ghost">Slot</label>
                  <Select value={slot} onValueChange={setSlot}>
                    <SelectTrigger>
                      <SelectValue />
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

                <div className="space-y-1.5">
                  <label className="text-sm text-ghost">Rarity</label>
                  <Select value={rarity} onValueChange={setRarity}>
                    <SelectTrigger>
                      <SelectValue />
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

              <div className="space-y-1.5">
                <label className="text-sm text-ghost">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A shimmering aura that pulses with teal energy..."
                  rows={3}
                  required
                  className="flex w-full border border-siphon-teal/20 bg-abyss px-3 py-2 text-sm text-foam placeholder:text-ghost/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30 focus-visible:border-siphon-teal/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-ghost">Preview Data</label>
                <Input
                  value={previewData}
                  onChange={(e) => setPreviewData(e.target.value)}
                  placeholder="e.g. glow:teal:pulse"
                  required
                />
                <p className="text-xs text-ghost/60">
                  Text representation of the cosmetic appearance.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-ghost">Price (credits)</label>
                <Input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !name || !description || !previewData}
              >
                {submitting ? "Creating..." : "Create Cosmetic"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="border-siphon-teal/30 bg-[#071123]/90 reveal-up" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle className="text-base pixel-title text-[10px]">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <CosmeticPreview
              slot={slot}
              previewData={previewData}
              size="lg"
            />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foam">
                {name || "Untitled"}
              </p>
              <p className="text-xs text-ghost capitalize">
                {slot} / {rarity}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreateCosmeticPage() {
  return (
    <SubscriptionGate requiredTier="keeper">
      <CosmeticCreatorForm />
    </SubscriptionGate>
  );
}
