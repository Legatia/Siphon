import type { AvatarParams, CosmeticSlots } from "@siphon/core";

// ── Type colors by ShardType index ──────────────────────────────────
const TYPE_COLORS: Record<number, string> = {
  0: "#00d4aa", // Oracle
  1: "#7c3aed", // Cipher
  2: "#3b82f6", // Scribe
  3: "#f59e0b", // Muse
  4: "#06b6d4", // Architect
  5: "#ec4899", // Advocate
  6: "#ef4444", // Sentinel
  7: "#a855f7", // Mirror
};

// ── Helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbaStr(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Extract a byte (0-255) from a genome hash at a given byte index. */
function genomeByte(genomeHash: string, index: number): number {
  const hex = genomeHash.replace("0x", "");
  const start = (index % (hex.length / 2)) * 2;
  return parseInt(hex.slice(start, start + 2), 16);
}

// ── Body shapes (bezier path functions) ─────────────────────────────
// Each draws a closed body shape centered around (cx, cy) with radius r.

type ShapeFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) => void;

/** 0 - Oracle: jellyfish dome */
function drawJellyfishDome(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Dome top
  ctx.moveTo(cx - r, cy);
  ctx.bezierCurveTo(cx - r, cy - r * 1.3, cx + r, cy - r * 1.3, cx + r, cy);
  // Tentacle fringe
  const tentacles = 5;
  const step = (r * 2) / tentacles;
  for (let i = 0; i < tentacles; i++) {
    const tx = cx - r + step * i;
    const ty = cy + r * 0.3;
    ctx.bezierCurveTo(
      tx + step * 0.25,
      cy + r * 0.05,
      tx + step * 0.5,
      ty,
      tx + step,
      cy,
    );
  }
  ctx.closePath();
}

/** 1 - Cipher: squid mantle */
function drawSquidMantle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 1.2);
  // Left side
  ctx.bezierCurveTo(
    cx - r * 0.9,
    cy - r * 0.8,
    cx - r * 1.0,
    cy + r * 0.2,
    cx - r * 0.5,
    cy + r * 0.8,
  );
  // Bottom point
  ctx.bezierCurveTo(
    cx - r * 0.2,
    cy + r * 1.2,
    cx + r * 0.2,
    cy + r * 1.2,
    cx + r * 0.5,
    cy + r * 0.8,
  );
  // Right side
  ctx.bezierCurveTo(
    cx + r * 1.0,
    cy + r * 0.2,
    cx + r * 0.9,
    cy - r * 0.8,
    cx,
    cy - r * 1.2,
  );
  ctx.closePath();
}

/** 2 - Scribe: ray wings */
function drawRayWings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.5);
  // Left wing
  ctx.bezierCurveTo(
    cx - r * 0.6,
    cy - r * 0.8,
    cx - r * 1.4,
    cy - r * 0.3,
    cx - r * 1.2,
    cy + r * 0.2,
  );
  ctx.bezierCurveTo(
    cx - r * 1.0,
    cy + r * 0.5,
    cx - r * 0.3,
    cy + r * 0.7,
    cx,
    cy + r * 0.8,
  );
  // Right wing
  ctx.bezierCurveTo(
    cx + r * 0.3,
    cy + r * 0.7,
    cx + r * 1.0,
    cy + r * 0.5,
    cx + r * 1.2,
    cy + r * 0.2,
  );
  ctx.bezierCurveTo(
    cx + r * 1.4,
    cy - r * 0.3,
    cx + r * 0.6,
    cy - r * 0.8,
    cx,
    cy - r * 0.5,
  );
  ctx.closePath();
}

/** 3 - Muse: nautilus shell */
function drawNautilusShell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Outer spiral approximation
  ctx.moveTo(cx + r * 0.1, cy - r);
  ctx.bezierCurveTo(
    cx + r * 0.9,
    cy - r * 0.9,
    cx + r * 1.1,
    cy - r * 0.1,
    cx + r * 0.9,
    cy + r * 0.4,
  );
  ctx.bezierCurveTo(
    cx + r * 0.7,
    cy + r * 0.9,
    cx,
    cy + r * 1.1,
    cx - r * 0.5,
    cy + r * 0.8,
  );
  ctx.bezierCurveTo(
    cx - r * 1.0,
    cy + r * 0.5,
    cx - r * 1.0,
    cy - r * 0.2,
    cx - r * 0.6,
    cy - r * 0.6,
  );
  ctx.bezierCurveTo(
    cx - r * 0.2,
    cy - r * 0.9,
    cx + r * 0.1,
    cy - r * 1.0,
    cx + r * 0.1,
    cy - r,
  );
  ctx.closePath();
}

/** 4 - Architect: eel serpentine */
function drawEelSerpentine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Serpentine S-curve body
  ctx.moveTo(cx - r * 0.3, cy - r * 1.1);
  ctx.bezierCurveTo(
    cx + r * 0.5,
    cy - r * 0.7,
    cx - r * 0.7,
    cy - r * 0.1,
    cx + r * 0.3,
    cy + r * 0.3,
  );
  ctx.bezierCurveTo(
    cx + r * 0.8,
    cy + r * 0.6,
    cx - r * 0.2,
    cy + r * 1.0,
    cx - r * 0.1,
    cy + r * 1.1,
  );
  // Return path (body width)
  ctx.bezierCurveTo(
    cx + r * 0.2,
    cy + r * 1.0,
    cx + r * 1.1,
    cy + r * 0.6,
    cx + r * 0.6,
    cy + r * 0.3,
  );
  ctx.bezierCurveTo(
    cx - r * 0.4,
    cy - r * 0.1,
    cx + r * 0.8,
    cy - r * 0.7,
    cx + r * 0.1,
    cy - r * 1.1,
  );
  ctx.closePath();
}

/** 5 - Advocate: angler bulb */
function drawAnglerBulb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Main bulb
  ctx.arc(cx, cy + r * 0.15, r * 0.85, 0, Math.PI * 2);
  ctx.closePath();

  // Lure stalk (drawn separately, will be stroked)
  ctx.moveTo(cx, cy - r * 0.7);
  ctx.bezierCurveTo(
    cx - r * 0.3,
    cy - r * 1.2,
    cx + r * 0.2,
    cy - r * 1.4,
    cx + r * 0.1,
    cy - r * 1.1,
  );
}

/** 6 - Sentinel: seahorse curve */
function drawSeahorseCurve(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Head
  ctx.moveTo(cx + r * 0.2, cy - r * 0.9);
  ctx.bezierCurveTo(
    cx + r * 0.7,
    cy - r * 1.0,
    cx + r * 0.8,
    cy - r * 0.4,
    cx + r * 0.5,
    cy - r * 0.1,
  );
  // Belly curve
  ctx.bezierCurveTo(
    cx + r * 0.8,
    cy + r * 0.2,
    cx + r * 0.6,
    cy + r * 0.7,
    cx + r * 0.2,
    cy + r * 0.9,
  );
  // Tail curl
  ctx.bezierCurveTo(
    cx - r * 0.1,
    cy + r * 1.1,
    cx - r * 0.5,
    cy + r * 0.9,
    cx - r * 0.4,
    cy + r * 0.5,
  );
  ctx.bezierCurveTo(
    cx - r * 0.3,
    cy + r * 0.2,
    cx - r * 0.5,
    cy + r * 0.1,
    cx - r * 0.6,
    cy + r * 0.3,
  );
  // Back
  ctx.bezierCurveTo(
    cx - r * 0.7,
    cy - r * 0.1,
    cx - r * 0.5,
    cy - r * 0.6,
    cx - r * 0.2,
    cy - r * 0.8,
  );
  ctx.bezierCurveTo(
    cx - r * 0.0,
    cy - r * 0.95,
    cx + r * 0.1,
    cy - r * 0.95,
    cx + r * 0.2,
    cy - r * 0.9,
  );
  ctx.closePath();
}

/** 7 - Mirror: octopus head */
function drawOctopusHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  // Bulbous head
  ctx.moveTo(cx, cy - r * 1.0);
  ctx.bezierCurveTo(
    cx + r * 0.8,
    cy - r * 1.1,
    cx + r * 1.1,
    cy - r * 0.3,
    cx + r * 0.8,
    cy + r * 0.1,
  );
  // Right tentacles hint
  ctx.bezierCurveTo(
    cx + r * 1.0,
    cy + r * 0.4,
    cx + r * 0.6,
    cy + r * 0.9,
    cx + r * 0.3,
    cy + r * 0.7,
  );
  // Bottom
  ctx.bezierCurveTo(
    cx + r * 0.1,
    cy + r * 1.0,
    cx - r * 0.1,
    cy + r * 1.0,
    cx - r * 0.3,
    cy + r * 0.7,
  );
  // Left tentacles hint
  ctx.bezierCurveTo(
    cx - r * 0.6,
    cy + r * 0.9,
    cx - r * 1.0,
    cy + r * 0.4,
    cx - r * 0.8,
    cy + r * 0.1,
  );
  // Left head
  ctx.bezierCurveTo(
    cx - r * 1.1,
    cy - r * 0.3,
    cx - r * 0.8,
    cy - r * 1.1,
    cx,
    cy - r * 1.0,
  );
  ctx.closePath();
}

const BODY_SHAPES: ShapeFn[] = [
  drawJellyfishDome,
  drawSquidMantle,
  drawRayWings,
  drawNautilusShell,
  drawEelSerpentine,
  drawAnglerBulb,
  drawSeahorseCurve,
  drawOctopusHead,
];

// ── Pattern overlays ────────────────────────────────────────────────

type PatternFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
) => void;

function drawSpots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  const count = 5 + (genomeByte(genomeHash, 20) % 6);
  ctx.fillStyle = rgbaStr(color, 0.25);
  for (let i = 0; i < count; i++) {
    const angle = (genomeByte(genomeHash, 21 + i) / 255) * Math.PI * 2;
    const dist = (genomeByte(genomeHash, 27 + i) / 255) * r * 0.6;
    const spotR = r * 0.05 + (genomeByte(genomeHash, 33 + i) / 255) * r * 0.08;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, spotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStripes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  const count = 3 + (genomeByte(genomeHash, 20) % 4);
  const angle = (genomeByte(genomeHash, 21) / 255) * Math.PI;
  ctx.strokeStyle = rgbaStr(color, 0.2);
  ctx.lineWidth = r * 0.06;
  for (let i = 0; i < count; i++) {
    const offset = ((i - count / 2) / count) * r * 1.4;
    const dx = Math.cos(angle + Math.PI / 2) * offset;
    const dy = Math.sin(angle + Math.PI / 2) * offset;
    ctx.beginPath();
    ctx.moveTo(cx + dx - Math.cos(angle) * r, cy + dy - Math.sin(angle) * r);
    ctx.lineTo(cx + dx + Math.cos(angle) * r, cy + dy + Math.sin(angle) * r);
    ctx.stroke();
  }
}

function drawHexagons(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  _genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.18);
  ctx.lineWidth = r * 0.03;
  const hexR = r * 0.2;
  const rows = 3;
  const cols = 3;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hx = cx + (col - 1) * hexR * 1.8 + (row % 2 === 0 ? 0 : hexR * 0.9);
      const hy = cy + (row - 1) * hexR * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        const px = hx + hexR * 0.7 * Math.cos(a);
        const py = hy + hexR * 0.7 * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawSwirls(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.2);
  ctx.lineWidth = r * 0.04;
  const spirals = 2 + (genomeByte(genomeHash, 20) % 2);
  for (let s = 0; s < spirals; s++) {
    const offsetAngle = (s / spirals) * Math.PI * 2;
    ctx.beginPath();
    for (let t = 0; t < 60; t++) {
      const angle = offsetAngle + (t / 60) * Math.PI * 3;
      const dist = (t / 60) * r * 0.6;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawFractals(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  _genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.15);
  ctx.lineWidth = r * 0.025;

  function branch(x: number, y: number, len: number, angle: number, depth: number): void {
    if (depth <= 0 || len < 2) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    branch(ex, ey, len * 0.65, angle - 0.5, depth - 1);
    branch(ex, ey, len * 0.65, angle + 0.5, depth - 1);
  }

  branch(cx, cy + r * 0.3, r * 0.4, -Math.PI / 2, 4);
}

function drawCircuits(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.2);
  ctx.lineWidth = r * 0.03;
  const nodes = 6 + (genomeByte(genomeHash, 20) % 4);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < nodes; i++) {
    const angle = (genomeByte(genomeHash, 21 + i) / 255) * Math.PI * 2;
    const dist = (genomeByte(genomeHash, 27 + i) / 255) * r * 0.6;
    points.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    });
  }
  // Connect nodes with right-angle paths
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Node dot
    ctx.fillStyle = rgbaStr(color, 0.3);
    ctx.beginPath();
    ctx.arc(a.x, a.y, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.18);
  ctx.lineWidth = r * 0.035;
  const waveCount = 3 + (genomeByte(genomeHash, 20) % 3);
  for (let w = 0; w < waveCount; w++) {
    const yOffset = cy + ((w - waveCount / 2) / waveCount) * r * 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const px = cx - r * 0.8 + t * r * 1.6;
      const py = yOffset + Math.sin(t * Math.PI * 3 + w) * r * 0.12;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawCrystals(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  genomeHash: string,
): void {
  ctx.strokeStyle = rgbaStr(color, 0.22);
  ctx.fillStyle = rgbaStr(color, 0.08);
  ctx.lineWidth = r * 0.025;
  const count = 3 + (genomeByte(genomeHash, 20) % 3);
  for (let i = 0; i < count; i++) {
    const angle = (genomeByte(genomeHash, 21 + i) / 255) * Math.PI * 2;
    const dist = (genomeByte(genomeHash, 27 + i) / 255) * r * 0.45;
    const size = r * 0.1 + (genomeByte(genomeHash, 33 + i) / 255) * r * 0.12;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(px, py - size);
    ctx.lineTo(px + size * 0.5, py);
    ctx.lineTo(px, py + size * 0.7);
    ctx.lineTo(px - size * 0.5, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

const PATTERN_OVERLAYS: PatternFn[] = [
  drawSpots,
  drawStripes,
  drawHexagons,
  drawSwirls,
  drawFractals,
  drawCircuits,
  drawWaves,
  drawCrystals,
];

// ── Eye rendering ───────────────────────────────────────────────────

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  genomeHash: string,
  primaryColor: string,
  glowIntensity: number,
): void {
  const countByte = genomeByte(genomeHash, 8) + genomeByte(genomeHash, 9);
  const eyeCount = 1 + (countByte % 3); // 1-3 eyes

  const eyeRadius = r * 0.08;
  const spacing = r * 0.22;

  for (let i = 0; i < eyeCount; i++) {
    const offsetX = (i - (eyeCount - 1) / 2) * spacing;
    const ex = cx + offsetX;
    const ey = cy - r * 0.15;

    // Eye glow
    const glowGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeRadius * 3);
    glowGrad.addColorStop(0, rgbaStr("#ffffff", 0.3 * glowIntensity));
    glowGrad.addColorStop(1, rgbaStr(primaryColor, 0));
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye outer
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Eye pupil
    ctx.fillStyle = rgbaStr(primaryColor, 0.9);
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Pupil highlight
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(ex - eyeRadius * 0.2, ey - eyeRadius * 0.2, eyeRadius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Cosmetic slot rendering ─────────────────────────────────────────

function drawCosmeticSlots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  primaryColor: string,
  cosmeticSlots: CosmeticSlots,
  time: number,
): void {
  // Aura: outer glow ring
  if (cosmeticSlots.aura) {
    ctx.save();
    const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.4);
    auraGrad.addColorStop(0, rgbaStr(primaryColor, 0.15 + Math.sin(time * 2) * 0.05));
    auraGrad.addColorStop(0.5, rgbaStr(primaryColor, 0.08));
    auraGrad.addColorStop(1, rgbaStr(primaryColor, 0));
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Trail: scattered particles behind/below
  if (cosmeticSlots.trail) {
    ctx.save();
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
      const dist = r * 1.1 + Math.sin(time * 3 + i * 1.3) * r * 0.15;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + r * 0.5 + Math.sin(angle) * dist * 0.3;
      const pSize = r * 0.025 + Math.sin(time * 2 + i) * r * 0.01;
      const alpha = 0.3 + Math.sin(time * 2.5 + i * 0.7) * 0.15;
      ctx.fillStyle = rgbaStr(primaryColor, Math.max(0.05, alpha));
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, pSize), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Crown: small triangular mark above the body
  if (cosmeticSlots.crown) {
    ctx.save();
    const crownY = cy - r * 1.15;
    ctx.fillStyle = rgbaStr(primaryColor, 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, crownY - r * 0.15);
    ctx.lineTo(cx - r * 0.1, crownY + r * 0.05);
    ctx.lineTo(cx + r * 0.1, crownY + r * 0.05);
    ctx.closePath();
    ctx.fill();
    // Side points
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.12, crownY);
    ctx.lineTo(cx - r * 0.18, crownY - r * 0.1);
    ctx.lineTo(cx - r * 0.06, crownY + r * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.12, crownY);
    ctx.lineTo(cx + r * 0.18, crownY - r * 0.1);
    ctx.lineTo(cx + r * 0.06, crownY + r * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Emblem: small badge/circle to the lower right
  if (cosmeticSlots.emblem) {
    ctx.save();
    const ex = cx + r * 0.65;
    const ey = cy + r * 0.65;
    const emblemR = r * 0.12;

    // Badge background
    ctx.fillStyle = rgbaStr(primaryColor, 0.6);
    ctx.beginPath();
    ctx.arc(ex, ey, emblemR, 0, Math.PI * 2);
    ctx.fill();

    // Badge border
    ctx.strokeStyle = rgbaStr("#ffffff", 0.4);
    ctx.lineWidth = r * 0.02;
    ctx.beginPath();
    ctx.arc(ex, ey, emblemR, 0, Math.PI * 2);
    ctx.stroke();

    // Star inside
    ctx.fillStyle = rgbaStr("#ffffff", 0.7);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const outerX = ex + Math.cos(a) * emblemR * 0.55;
      const outerY = ey + Math.sin(a) * emblemR * 0.55;
      const innerA = a + Math.PI / 5;
      const innerX = ex + Math.cos(innerA) * emblemR * 0.25;
      const innerY = ey + Math.sin(innerA) * emblemR * 0.25;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Main render function ────────────────────────────────────────────

export function renderShardAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: {
    genomeHash: string;
    type: number;
    avatar: AvatarParams;
    cosmeticSlots?: CosmeticSlots;
    size?: number;
    animate?: boolean;
    time?: number;
  },
): void {
  const {
    genomeHash,
    type,
    avatar,
    cosmeticSlots,
    size: overrideSize,
    animate = false,
    time = 0,
  } = options;

  const baseSize = overrideSize ?? 64;
  const scale = avatar.size;
  const drawSize = baseSize * scale;
  const r = drawSize * 0.38; // body radius
  const cx = x + baseSize / 2;
  const cy = y + baseSize / 2;

  const primaryColor = avatar.primaryColor || TYPE_COLORS[type] || "#00d4aa";
  const secondaryColor = avatar.secondaryColor || "#aaaaaa";

  ctx.save();

  // ── Bioluminescence glow ──────────────────────────────────────
  const pulseAmount = animate ? Math.sin(time * 2.5) * 0.15 : 0;
  const glowRadius = r * (1.5 + avatar.glowIntensity * 0.8 + pulseAmount);
  const glowAlpha = avatar.glowIntensity * 0.35 + pulseAmount * 0.1;

  const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, glowRadius);
  outerGlow.addColorStop(0, rgbaStr(primaryColor, Math.max(0, glowAlpha)));
  outerGlow.addColorStop(0.5, rgbaStr(primaryColor, Math.max(0, glowAlpha * 0.4)));
  outerGlow.addColorStop(1, rgbaStr(primaryColor, 0));
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // ── Cosmetics behind body (trail) ─────────────────────────────
  if (cosmeticSlots) {
    drawCosmeticSlots(ctx, cx, cy, r, primaryColor, cosmeticSlots, time);
  }

  // ── Body shape ────────────────────────────────────────────────
  const shapeIndex = Math.abs(type) % BODY_SHAPES.length;
  const drawShape = BODY_SHAPES[shapeIndex];

  // Body fill gradient
  const bodyGrad = ctx.createRadialGradient(
    cx - r * 0.2,
    cy - r * 0.2,
    0,
    cx,
    cy,
    r * 1.2,
  );
  bodyGrad.addColorStop(0, rgbaStr(primaryColor, 0.9));
  bodyGrad.addColorStop(0.4, primaryColor);
  bodyGrad.addColorStop(0.7, rgbaStr(secondaryColor, 0.6));
  bodyGrad.addColorStop(1, rgbaStr(primaryColor, 0.3));

  ctx.save();
  drawShape(ctx, cx, cy, r);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Body edge glow
  ctx.strokeStyle = rgbaStr(primaryColor, 0.5 + (animate ? pulseAmount * 0.3 : 0));
  ctx.lineWidth = r * 0.04;
  drawShape(ctx, cx, cy, r);
  ctx.stroke();
  ctx.restore();

  // ── Pattern overlay (clipped to body) ─────────────────────────
  ctx.save();
  drawShape(ctx, cx, cy, r);
  ctx.clip();
  const patternIndex = Math.abs(avatar.pattern) % PATTERN_OVERLAYS.length;
  PATTERN_OVERLAYS[patternIndex](ctx, cx, cy, r, secondaryColor, genomeHash);
  ctx.restore();

  // ── Eyes ──────────────────────────────────────────────────────
  drawEyes(ctx, cx, cy, r, genomeHash, primaryColor, avatar.glowIntensity);

  // ── Inner highlight ───────────────────────────────────────────
  ctx.save();
  drawShape(ctx, cx, cy, r);
  ctx.clip();
  const highlight = ctx.createRadialGradient(
    cx - r * 0.25,
    cy - r * 0.35,
    0,
    cx,
    cy,
    r,
  );
  highlight.addColorStop(0, "rgba(255,255,255,0.15)");
  highlight.addColorStop(0.4, "rgba(255,255,255,0.03)");
  highlight.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = highlight;
  ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
  ctx.restore();

  ctx.restore();
}

// ── Static data URL export ──────────────────────────────────────────

export function renderShardToDataURL(options: {
  genomeHash: string;
  type: number;
  avatar: AvatarParams;
  cosmeticSlots?: CosmeticSlots;
  size?: number;
}): string {
  const size = options.size ?? 128;

  // Create an offscreen canvas (works in browser context)
  if (typeof document === "undefined") {
    // Server-side: return empty transparent PNG data URL
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  renderShardAvatar(ctx, 0, 0, {
    genomeHash: options.genomeHash,
    type: options.type,
    avatar: options.avatar,
    cosmeticSlots: options.cosmeticSlots,
    size,
    animate: false,
    time: 0,
  });

  return canvas.toDataURL("image/png");
}
