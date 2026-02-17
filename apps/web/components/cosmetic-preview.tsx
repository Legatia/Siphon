"use client";

const SLOT_VISUAL: Record<string, { gradient: string; label: string }> = {
  aura: {
    gradient: "from-siphon-teal/30 via-deep-violet/20 to-transparent",
    label: "Aura",
  },
  trail: {
    gradient: "from-ember/30 via-siphon-teal/20 to-transparent",
    label: "Trail",
  },
  crown: {
    gradient: "from-deep-violet/30 via-ember/20 to-transparent",
    label: "Crown",
  },
  emblem: {
    gradient: "from-current/30 via-siphon-teal/20 to-transparent",
    label: "Emblem",
  },
};

interface CosmeticPreviewProps {
  slot: string;
  previewData: string;
  size?: "sm" | "md" | "lg";
}

export function CosmeticPreview({
  slot,
  previewData,
  size = "md",
}: CosmeticPreviewProps) {
  const visual = SLOT_VISUAL[slot] || SLOT_VISUAL.aura;

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-xl overflow-hidden border border-siphon-teal/10 bg-abyss flex items-center justify-center`}
    >
      {/* Background gradient based on slot type */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${visual.gradient} opacity-60`}
      />

      {/* Animated ring effect */}
      <div className="absolute inset-2 rounded-lg border border-siphon-teal/20 animate-pulse" />

      {/* Preview data content */}
      <div className="relative z-10 text-center px-1">
        {previewData ? (
          <span className="text-xs text-foam/80 font-mono leading-tight line-clamp-3">
            {previewData}
          </span>
        ) : (
          <span className="text-xs text-ghost/50">{visual.label}</span>
        )}
      </div>
    </div>
  );
}
