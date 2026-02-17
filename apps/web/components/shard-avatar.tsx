"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Shard } from "@siphon/core";
import { renderShardAvatar } from "@/lib/avatar-renderer";

export function ShardAvatar({
  shard,
  size = 64,
  animate = false,
}: {
  shard: Shard;
  size?: number;
  animate?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      renderShardAvatar(ctx, 0, 0, {
        genomeHash: shard.genomeHash,
        type: shard.type,
        avatar: shard.avatar,
        cosmeticSlots: shard.cosmeticSlots,
        size,
        animate,
        time,
      });
    },
    [shard.genomeHash, shard.type, shard.avatar, shard.cosmeticSlots, size, animate],
  );

  useEffect(() => {
    if (!animate) {
      draw(0);
      return;
    }

    let running = true;

    function loop() {
      if (!running) return;
      draw(Date.now() / 1000);
      animationRef.current = requestAnimationFrame(loop);
    }

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, [animate, draw]);

  // Redraw on static dependency changes when not animating
  useEffect(() => {
    if (!animate) {
      draw(0);
    }
  }, [animate, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg"
      aria-label={`${shard.name} avatar`}
    />
  );
}
