"use client";

import type { CSSProperties } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CosmeticPreview } from "@/components/cosmetic-preview";
import type { CosmeticItem } from "@siphon/core";

const RARITY_COLORS: Record<string, string> = {
  common: "border-ghost/30 bg-ghost/10 text-ghost",
  rare: "border-current/30 bg-current/10 text-current",
  epic: "border-deep-violet/30 bg-deep-violet/10 text-deep-violet",
  legendary: "border-ember/30 bg-ember/10 text-ember",
};

const RARITY_GLOW: Record<string, string> = {
  common: "",
  rare: "shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  epic: "shadow-[0_0_15px_rgba(124,58,237,0.2)]",
  legendary: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
};

const SLOT_LABELS: Record<string, string> = {
  aura: "Aura",
  trail: "Trail",
  crown: "Crown",
  emblem: "Emblem",
};

interface CosmeticCardProps {
  cosmetic: CosmeticItem;
  owned?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function CosmeticCard({
  cosmetic,
  owned = false,
  onAction,
  actionLabel,
  actionDisabled = false,
  className,
  style,
}: CosmeticCardProps) {
  const rarityClass = RARITY_COLORS[cosmetic.rarity] || RARITY_COLORS.common;
  const glowClass = RARITY_GLOW[cosmetic.rarity] || "";

  return (
    <Card
      className={`transition-all border-siphon-teal/20 bg-[#071123]/88 hover:border-siphon-teal/40 ${glowClass} ${className ?? ""}`}
      style={style}
    >
      <CardContent className="p-4 space-y-3">
        {/* Preview */}
        <div className="flex justify-center border border-siphon-teal/12 bg-abyss/50 py-3">
          <CosmeticPreview
            slot={cosmetic.slot}
            previewData={cosmetic.previewData}
            size="md"
          />
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-foam text-center truncate">
          {cosmetic.name}
        </h3>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary">
            {SLOT_LABELS[cosmetic.slot] || cosmetic.slot}
          </Badge>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${rarityClass}`}
          >
            {cosmetic.rarity}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-ghost text-center line-clamp-2">
          {cosmetic.description}
        </p>

        {/* Price and action */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-medium text-siphon-teal">
            {cosmetic.price === 0 ? "Free" : `${cosmetic.price} credits`}
          </span>

          {onAction && (
            <Button
              size="sm"
              variant={owned ? "outline" : "default"}
              onClick={onAction}
              disabled={actionDisabled || owned}
            >
              {owned ? "Owned" : actionLabel || "Buy"}
            </Button>
          )}

          {!onAction && owned && (
            <Badge variant="default">Owned</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
