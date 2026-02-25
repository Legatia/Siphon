"use client";

import { useEffect, useState } from "react";
import type { CelebrationType, SfxEvent } from "@/lib/game-feedback";

type Burst = {
  id: string;
  color: string;
  left: number;
  top: number;
};

type Pulse = {
  id: string;
  color: string;
  intensity: number;
};

type Cinematic = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
};

function cinematicFor(type: CelebrationType): Omit<Cinematic, "id"> {
  if (type === "battle_win") {
    return {
      title: "Arena Dominance",
      subtitle: "Rival shard destabilized",
      color: "#f59e0b",
    };
  }
  if (type === "level_up") {
    return {
      title: "Level Uplink",
      subtitle: "Core stats increased",
      color: "#a78bfa",
    };
  }
  return {
    title: "Shard Captured",
    subtitle: "Neural signature synchronized",
    color: "#00d4aa",
  };
}

function pulseColor(event: SfxEvent): string {
  switch (event) {
    case "battle_win":
    case "level_up":
      return "#f59e0b";
    case "capture_fail":
    case "battle_lose":
      return "#ff6b6b";
    case "timer_warning":
      return "#ffd66b";
    default:
      return "#6af5d6";
  }
}

export function GameFxLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [cinematic, setCinematic] = useState<Cinematic | null>(null);

  useEffect(() => {
    const onCelebrate = (evt: Event) => {
      const type =
        (evt as CustomEvent<{ type: CelebrationType }>).detail?.type ?? "capture";
      const scene = cinematicFor(type);

      const batch: Burst[] = Array.from({ length: 28 }).map((_, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random()}`,
        color: scene.color,
        left: 26 + Math.random() * 48,
        top: 28 + Math.random() * 36,
      }));

      setBursts((prev) => [...prev, ...batch]);
      const cinematicId = `${Date.now()}-${Math.random()}`;
      setCinematic({ id: cinematicId, ...scene });

      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => !batch.find((n) => n.id === b.id)));
      }, 1100);
      window.setTimeout(() => {
        setCinematic((prev) => (prev?.id === cinematicId ? null : prev));
      }, 1550);
    };

    const onSfx = (evt: Event) => {
      const detail = (evt as CustomEvent<{ event: SfxEvent; intensity: number }>).detail;
      if (!detail) return;
      const pulse: Pulse = {
        id: `${Date.now()}-${Math.random()}`,
        color: pulseColor(detail.event),
        intensity: detail.intensity,
      };
      setPulses((prev) => [...prev, pulse]);
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== pulse.id));
      }, 420);
    };

    window.addEventListener("siphon:celebrate", onCelebrate as EventListener);
    window.addEventListener("siphon:sfx", onSfx as EventListener);
    return () => {
      window.removeEventListener("siphon:celebrate", onCelebrate as EventListener);
      window.removeEventListener("siphon:sfx", onSfx as EventListener);
    };
  }, []);

  if (!bursts.length && !pulses.length && !cinematic) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
      {pulses.map((p) => (
        <span
          key={p.id}
          className="absolute inset-0 animate-[sfx-pulse_420ms_ease-out_forwards]"
          style={{
            background: `radial-gradient(circle at 50% 62%, ${p.color}${Math.round(44 * p.intensity)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 64%)`,
          }}
        />
      ))}

      {cinematic && (
        <div className="absolute inset-0 flex items-center justify-center animate-[cinematic-fade_1.5s_ease-out_forwards]">
          <div className="absolute inset-0 bg-[#02050d]/45" />
          <div className="relative border-2 bg-[#071123]/95 px-8 py-6 text-center"
            style={{
              borderColor: `${cinematic.color}99`,
              boxShadow: `0 0 35px ${cinematic.color}55`,
            }}
          >
            <div className="mb-2 h-0.5 w-full shimmer-line opacity-80" />
            <p className="pixel-title text-[12px]" style={{ color: cinematic.color }}>
              {cinematic.title}
            </p>
            <p className="mt-2 text-sm text-foam/90">{cinematic.subtitle}</p>
          </div>
        </div>
      )}

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
