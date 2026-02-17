"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WildShard } from "@siphon/core";
import { SHARD_TYPE_COLORS, SHARD_TYPE_NAMES } from "@siphon/core";

interface DriftMapProps {
  shards: WildShard[];
  onShardClick: (shard: WildShard) => void;
}

export function DriftMap({ shards, onShardClick }: DriftMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [hoveredShard, setHoveredShard] = useState<string | null>(null);
  const shardsRef = useRef(shards);
  const positionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(
    new Map()
  );

  // Update refs when shards change
  useEffect(() => {
    shardsRef.current = shards;
    shards.forEach((s) => {
      if (!positionsRef.current.has(s.id)) {
        positionsRef.current.set(s.id, { ...s.driftPosition });
      }
    });
  }, [shards]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    // Deep-sea background gradient
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, width / 2
    );
    gradient.addColorStop(0, "rgba(26, 26, 46, 0.3)");
    gradient.addColorStop(1, "rgba(15, 15, 26, 0.8)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Ambient particles
    const time = Date.now() / 1000;
    for (let i = 0; i < 30; i++) {
      const px = (Math.sin(time * 0.3 + i * 1.7) * 0.5 + 0.5) * width;
      const py = (Math.cos(time * 0.2 + i * 2.3) * 0.5 + 0.5) * height;
      const opacity = Math.sin(time + i) * 0.15 + 0.15;
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 170, ${opacity})`;
      ctx.fill();
    }

    // Draw shards
    shardsRef.current.forEach((shard) => {
      const pos = positionsRef.current.get(shard.id);
      if (!pos) return;

      // Update drift position
      pos.x += pos.vx * 0.02;
      pos.y += pos.vy * 0.02;

      // Wrap around
      if (pos.x < 0) pos.x = 100;
      if (pos.x > 100) pos.x = 0;
      if (pos.y < 0) pos.y = 100;
      if (pos.y > 100) pos.y = 0;

      // Add gentle sine wave motion
      const offsetX = Math.sin(time * 0.5 + parseInt(shard.id.slice(0, 4), 16)) * 1;
      const offsetY = Math.cos(time * 0.3 + parseInt(shard.id.slice(4, 8), 16)) * 1;

      const x = ((pos.x + offsetX) / 100) * width;
      const y = ((pos.y + offsetY) / 100) * height;
      const typeName = SHARD_TYPE_NAMES[shard.type];
      const color = SHARD_TYPE_COLORS[typeName];
      const isHovered = hoveredShard === shard.id;
      const baseRadius = isHovered ? 18 : 12;

      // Outer glow
      const glowSize = baseRadius * 3;
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      glowGradient.addColorStop(0, color + "40");
      glowGradient.addColorStop(0.5, color + "15");
      glowGradient.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      // Pulsing ring
      const pulse = Math.sin(time * 2 + parseInt(shard.id.slice(0, 2), 16)) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = color + Math.floor(pulse * 80).toString(16).padStart(2, "0");
      ctx.lineWidth = 1;
      ctx.stroke();

      // Core
      const coreGradient = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, baseRadius);
      coreGradient.addColorStop(0, color + "ff");
      coreGradient.addColorStop(0.7, color + "bb");
      coreGradient.addColorStop(1, color + "60");
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      // Type icon
      const icons = ["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"];
      ctx.font = `${isHovered ? 14 : 10}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icons[shard.type] ?? "◈", x, y);

      // Name label on hover
      if (isHovered) {
        ctx.font = "12px Inter, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(shard.name, x, y + baseRadius + 16);
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(typeName, x, y + baseRadius + 30);
      }
    });
  }, [hoveredShard]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      draw(ctx, canvas.width, canvas.height);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    shardsRef.current.forEach((shard) => {
      const pos = positionsRef.current.get(shard.id);
      if (!pos) return;
      const x = (pos.x / 100) * canvas.width;
      const y = (pos.y / 100) * canvas.height;
      const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
      if (dist < 25) found = shard.id;
    });

    setHoveredShard(found);
    canvas.style.cursor = found ? "pointer" : "default";
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredShard) {
      const shard = shardsRef.current.find((s) => s.id === hoveredShard);
      if (shard) onShardClick(shard);
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden glow-border bg-abyss">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      <div className="absolute bottom-4 left-4 flex gap-3 text-xs text-ghost">
        {(["Oracle", "Cipher", "Scribe", "Muse", "Architect", "Advocate", "Sentinel", "Mirror"] as const).map((type) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: SHARD_TYPE_COLORS[type] }}
            />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
