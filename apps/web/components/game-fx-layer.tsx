"use client";

import { useEffect, useState } from "react";

type Burst = {
  id: string;
  color: string;
  left: number;
  top: number;
};

export function GameFxLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onCelebrate = (evt: Event) => {
      const type =
        (evt as CustomEvent<{ type: "capture" | "level_up" | "battle_win" }>).detail
          ?.type ?? "capture";
      const color =
        type === "battle_win"
          ? "#f59e0b"
          : type === "level_up"
          ? "#7c3aed"
          : "#00d4aa";
      const batch: Burst[] = Array.from({ length: 24 }).map((_, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random()}`,
        color,
        left: 30 + Math.random() * 40,
        top: 30 + Math.random() * 30,
      }));
      setBursts((prev) => [...prev, ...batch]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => !batch.find((n) => n.id === b.id)));
      }, 1000);
    };

    window.addEventListener("siphon:celebrate", onCelebrate as EventListener);
    return () => {
      window.removeEventListener("siphon:celebrate", onCelebrate as EventListener);
    };
  }, []);

  if (!bursts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {bursts.map((b) => (
        <span
          key={b.id}
          className="absolute h-2 w-2 rounded-full animate-[burst_1s_ease-out_forwards]"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            backgroundColor: b.color,
            boxShadow: `0 0 12px ${b.color}`,
            transform: `translate(0, 0) rotate(${Math.random() * 360}deg)`,
            ["--dx" as string]: `${(Math.random() - 0.5) * 2}`,
            ["--dy" as string]: `${-Math.random() * 2}`,
          }}
        />
      ))}
    </div>
  );
}
