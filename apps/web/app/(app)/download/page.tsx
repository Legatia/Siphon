"use client";

import { useEffect, useState } from "react";
import { Apple, Monitor, Terminal, Download, ExternalLink, HardDrive, Cpu, MemoryStick } from "lucide-react";

const GITHUB_RELEASES_URL = "https://github.com/Legatia/Siphon/releases/latest";

type DetectedOS = "macos" | "windows" | "linux" | null;

function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return null;
}

const platforms = [
  {
    id: "macos" as const,
    name: "macOS",
    icon: Apple,
    formats: [".dmg"],
    notes: "Intel + Apple Silicon builds",
    minVersion: "macOS 12 Monterey or later",
  },
  {
    id: "windows" as const,
    name: "Windows",
    icon: Monitor,
    formats: [".msi", ".exe"],
    notes: "x86_64",
    minVersion: "Windows 10 or later",
  },
  {
    id: "linux" as const,
    name: "Linux",
    icon: Terminal,
    formats: [".deb", ".AppImage"],
    notes: "x86_64",
    minVersion: "Ubuntu 22.04 / Fedora 38 or equivalent",
  },
] as const;

export default function DownloadPage() {
  const [os, setOS] = useState<DetectedOS>(null);

  useEffect(() => {
    setOS(detectOS());
  }, []);

  const detected = platforms.find((p) => p.id === os) ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-foam">Download Siphon Desktop</h1>
        <p className="text-ghost text-sm max-w-lg mx-auto">
          Self-hosted keeper node, agent workspace, and 3D shard management —
          all in one native app. Own your shards, run inference locally, and
          keep full control.
        </p>
      </div>

      {/* Auto-detected OS card */}
      {detected && (
        <div className="glow-border rounded-xl p-6 bg-midnight/80 border border-siphon-teal/10 flex flex-col items-center gap-4">
          <detected.icon className="w-10 h-10 text-siphon-teal" />
          <h2 className="text-xl font-semibold text-foam">
            Download for {detected.name}
          </h2>
          <p className="text-ghost text-sm">{detected.notes}</p>
          <a href={GITHUB_RELEASES_URL} target="_blank" rel="noopener noreferrer">
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-siphon-teal text-midnight font-semibold hover:bg-siphon-teal/90 transition-colors text-lg">
              <Download className="w-5 h-5" />
              Download for {detected.name}
            </button>
          </a>
          <a
            href="#all-platforms"
            className="text-ghost text-xs hover:text-foam transition-colors underline underline-offset-2"
          >
            Not your OS? See all platforms below
          </a>
        </div>
      )}

      {/* All platforms grid */}
      <div id="all-platforms" className="space-y-4">
        <h2 className="text-lg font-semibold text-foam">All Platforms</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="rounded-xl p-5 bg-midnight/80 border border-siphon-teal/10 flex flex-col items-center gap-3"
            >
              <platform.icon className="w-8 h-8 text-siphon-teal" />
              <h3 className="text-foam font-semibold">{platform.name}</h3>
              <div className="flex gap-2">
                {platform.formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="text-xs px-2 py-0.5 rounded-full bg-siphon-teal/10 text-siphon-teal border border-siphon-teal/20"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
              <p className="text-ghost text-xs text-center">{platform.notes}</p>
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto"
              >
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-siphon-teal/30 text-siphon-teal text-sm font-medium hover:bg-siphon-teal/10 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Download
                </button>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* System requirements */}
      <div className="rounded-xl p-5 bg-midnight/80 border border-siphon-teal/10 space-y-3">
        <h2 className="text-lg font-semibold text-foam">System Requirements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Cpu className="w-4 h-4 text-siphon-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-foam font-medium">OS</p>
              <ul className="text-ghost text-xs space-y-0.5 mt-1">
                {platforms.map((p) => (
                  <li key={p.id}>{p.minVersion}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HardDrive className="w-4 h-4 text-siphon-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-foam font-medium">Disk Space</p>
              <p className="text-ghost text-xs mt-1">500 MB minimum</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MemoryStick className="w-4 h-4 text-siphon-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-foam font-medium">Memory</p>
              <p className="text-ghost text-xs mt-1">4 GB RAM minimum, 8 GB recommended</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
