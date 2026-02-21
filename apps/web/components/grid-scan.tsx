"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Shaders (from react-bits GridScan, stripped of webcam/face-tracking)
// ---------------------------------------------------------------------------

const vert = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const frag = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uSkew;
uniform float uTilt;
uniform float uYaw;
uniform float uLineThickness;
uniform vec3 uLinesColor;
uniform vec3 uScanColor;
uniform float uGridScale;
uniform float uLineStyle;
uniform float uLineJitter;
uniform float uScanOpacity;
uniform float uScanDirection;
uniform float uNoise;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uPhaseTaper;
uniform float uScanDuration;
uniform float uScanDelay;
varying vec2 vUv;

float smoother01(float a, float b, float x){
  float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(p, 2.0));

    float cR = cos(uTilt), sR = sin(uTilt);
    rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;
    float cY = cos(uYaw), sY = sin(uYaw);
    rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;

    vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
    rd.xy += skew * rd.z;

    vec3 color = vec3(0.0);
    float minT = 1e20;
    float gridScale = max(1e-5, uGridScale);
    float fadeStrength = 2.0;
    vec2 gridUV = vec2(0.0);
    float hitIsY = 1.0;

    for (int i = 0; i < 4; i++) {
        float isY = float(i < 2);
        float pos = mix(-0.2, 0.2, float(i)) * isY + mix(-0.5, 0.5, float(i - 2)) * (1.0 - isY);
        float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
        float den = isY * rd.y + (1.0 - isY) * rd.x;
        float t = num / den;
        vec3 h = ro + rd * t;
        float depthBoost = smoothstep(0.0, 3.0, h.z);
        h.xy += skew * 0.15 * depthBoost;
        bool use = t > 0.0 && t < minT;
        gridUV = use ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
        minT = use ? t : minT;
        hitIsY = use ? isY : hitIsY;
    }

    vec3 hit = ro + rd * minT;
    float dist = length(hit - ro);

    float jitterAmt = clamp(uLineJitter, 0.0, 1.0);
    if (jitterAmt > 0.0) {
      vec2 j = vec2(
        sin(gridUV.y * 2.7 + iTime * 1.8),
        cos(gridUV.x * 2.3 - iTime * 1.6)
      ) * (0.15 * jitterAmt);
      gridUV += j;
    }

    float fx = fract(gridUV.x);
    float fy = fract(gridUV.y);
    float ax = min(fx, 1.0 - fx);
    float ay = min(fy, 1.0 - fy);
    float wx = fwidth(gridUV.x);
    float wy = fwidth(gridUV.y);
    float halfPx = max(0.0, uLineThickness) * 0.5;
    float tx = halfPx * wx;
    float ty = halfPx * wy;
    float aax = wx;
    float aay = wy;
    float lineX = 1.0 - smoothstep(tx, tx + aax, ax);
    float lineY = 1.0 - smoothstep(ty, ty + aay, ay);

    if (uLineStyle > 0.5) {
      float dashRepeat = 4.0;
      float dashDuty = 0.5;
      float vy = fract(gridUV.y * dashRepeat);
      float vx = fract(gridUV.x * dashRepeat);
      float dashMaskY = step(vy, dashDuty);
      float dashMaskX = step(vx, dashDuty);
      lineX *= dashMaskY;
      lineY *= dashMaskX;
    }

    float lineMask = max(lineX, lineY);
    float fade = exp(-dist * fadeStrength);

    float dur = max(0.05, uScanDuration);
    float del = max(0.0, uScanDelay);
    float scanZMax = 2.0;
    float widthScale = max(0.1, uScanGlow);
    float sigma = max(0.001, 0.18 * widthScale * uScanSoftness);
    float sigmaA = sigma * 2.0;

    float cycle = dur + del;
    float tCycle = mod(iTime, cycle);
    float scanPhase = clamp((tCycle - del) / dur, 0.0, 1.0);
    float phase = scanPhase;
    if (uScanDirection > 1.5) {
      float t2 = mod(max(0.0, iTime - del), 2.0 * dur);
      phase = (t2 < dur) ? (t2 / dur) : (1.0 - (t2 - dur) / dur);
    } else if (uScanDirection > 0.5) {
      phase = 1.0 - phase;
    }

    float scanZ = phase * scanZMax;
    float dz = abs(hit.z - scanZ);
    float lineBand = exp(-0.5 * (dz * dz) / (sigma * sigma));
    float taper = clamp(uPhaseTaper, 0.0, 0.49);
    float headFade = smoother01(0.0, taper, phase);
    float tailFade = 1.0 - smoother01(1.0 - taper, 1.0, phase);
    float phaseWindow = headFade * tailFade;
    float combinedPulse = lineBand * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);
    float auraBand = exp(-0.5 * (dz * dz) / (sigmaA * sigmaA));
    float combinedAura = (auraBand * 0.25) * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);

    float lineVis = lineMask;
    vec3 gridCol = uLinesColor * lineVis * fade;
    vec3 scanCol = uScanColor * combinedPulse;
    vec3 scanAura = uScanColor * combinedAura;
    color = gridCol + scanCol + scanAura;

    float n = fract(sin(dot(gl_FragCoord.xy + vec2(iTime * 123.4), vec2(12.9898,78.233))) * 43758.5453123);
    color += (n - 0.5) * uNoise;
    color = clamp(color, 0.0, 1.0);
    float alpha = clamp(max(lineVis, combinedPulse), 0.0, 1.0);
    float gx = 1.0 - smoothstep(tx * 2.0, tx * 2.0 + aax * 2.0, ax);
    float gy = 1.0 - smoothstep(ty * 2.0, ty * 2.0 + aay * 2.0, ay);
    float halo = max(gx, gy) * fade;
    alpha = max(alpha, halo * 0.0);
    fragColor = vec4(color, alpha);
}

void main(){
  vec4 c;
  mainImage(c, vUv * iResolution.xy);
  gl_FragColor = c;
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function srgbColor(hex: string) {
  const c = new THREE.Color(hex);
  return c.convertSRGBToLinear();
}

function smoothDampVec2(
  current: THREE.Vector2,
  target: THREE.Vector2,
  vel: THREE.Vector2,
  smoothTime: number,
  maxSpeed: number,
  dt: number,
) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current.clone().sub(target);
  const maxChange = maxSpeed * smoothTime;
  if (change.length() > maxChange) change.setLength(maxChange);
  const t2 = current.clone().sub(change);
  const temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt);
  vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  const out = t2.clone().add(change.add(temp).multiplyScalar(exp));
  if (target.clone().sub(current).dot(out.clone().sub(target)) > 0) {
    out.copy(target);
    vel.set(0, 0);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GridScanProps {
  sensitivity?: number;
  lineThickness?: number;
  linesColor?: string;
  scanColor?: string;
  scanOpacity?: number;
  gridScale?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineJitter?: number;
  scanDirection?: "forward" | "backward" | "pingpong";
  noiseIntensity?: number;
  scanGlow?: number;
  scanSoftness?: number;
  scanDuration?: number;
  scanDelay?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GridScan({
  sensitivity = 0.55,
  lineThickness = 2.5,
  linesColor = "#1ab4b7",
  scanColor = "#06cb52",
  scanOpacity = 0.55,
  gridScale = 0.1,
  lineStyle = "solid",
  lineJitter = 0.1,
  scanDirection = "pingpong",
  noiseIntensity = 0.03,
  scanGlow = 0.9,
  scanSoftness = 1.5,
  scanDuration = 2,
  scanDelay = 2,
  className,
  style,
}: GridScanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lookTarget = useRef(new THREE.Vector2(0, 0));
  const lookCurrent = useRef(new THREE.Vector2(0, 0));
  const lookVel = useRef(new THREE.Vector2(0, 0));

  const s = THREE.MathUtils.clamp(sensitivity, 0, 1);
  const skewScale = THREE.MathUtils.lerp(0.06, 0.2, s);
  const smoothTime = THREE.MathUtils.lerp(0.45, 0.12, s);
  const yBoost = THREE.MathUtils.lerp(1.2, 1.6, s);

  // Mouse tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;

    const onMove = (e: MouseEvent) => {
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      lookTarget.current.set(nx, ny);
    };
    const onLeave = () => {
      leaveTimer = setTimeout(() => lookTarget.current.set(0, 0), 250);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, []);

  // WebGL renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector3(container.clientWidth, container.clientHeight, renderer.getPixelRatio()) },
        iTime: { value: 0 },
        uSkew: { value: new THREE.Vector2(0, 0) },
        uTilt: { value: 0 },
        uYaw: { value: 0 },
        uLineThickness: { value: lineThickness },
        uLinesColor: { value: srgbColor(linesColor) },
        uScanColor: { value: srgbColor(scanColor) },
        uGridScale: { value: gridScale },
        uLineStyle: { value: lineStyle === "dashed" ? 1 : lineStyle === "dotted" ? 2 : 0 },
        uLineJitter: { value: Math.max(0, Math.min(1, lineJitter)) },
        uScanOpacity: { value: scanOpacity },
        uNoise: { value: noiseIntensity },
        uScanGlow: { value: scanGlow },
        uScanSoftness: { value: scanSoftness },
        uPhaseTaper: { value: 0.9 },
        uScanDuration: { value: scanDuration },
        uScanDelay: { value: scanDelay },
        uScanDirection: { value: scanDirection === "backward" ? 1 : scanDirection === "pingpong" ? 2 : 0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      material.uniforms.iResolution.value.set(container.clientWidth, container.clientHeight, renderer.getPixelRatio());
    };
    window.addEventListener("resize", onResize);

    let raf: number;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;

      lookCurrent.current.copy(
        smoothDampVec2(lookCurrent.current, lookTarget.current, lookVel.current, smoothTime, Infinity, dt)
      );

      const skew = new THREE.Vector2(
        lookCurrent.current.x * skewScale,
        -lookCurrent.current.y * yBoost * skewScale,
      );
      material.uniforms.uSkew.value.set(skew.x, skew.y);
      material.uniforms.iTime.value = now / 1000;

      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      material.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [lineThickness, linesColor, scanColor, scanOpacity, gridScale, lineStyle, lineJitter, scanDirection, noiseIntensity, scanGlow, scanSoftness, scanDuration, scanDelay, skewScale, smoothTime, yBoost]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
