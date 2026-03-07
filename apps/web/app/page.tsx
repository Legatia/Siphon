"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GridScan } from "@/components/grid-scan";
import {
  Waves,
  Compass,
  Swords,
  MessageSquare,
  ShoppingBag,
  Target,
  Monitor,
  Server,
  Shield,
  Zap,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Download,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEMO_URL = "/dashboard";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SHARD_TYPES = [
  { name: "Oracle", role: "Pattern prediction & analysis", color: "text-siphon-teal", bg: "bg-siphon-teal/10", border: "border-siphon-teal/20" },
  { name: "Cipher", role: "Cryptography & security", color: "text-deep-violet", bg: "bg-deep-violet/10", border: "border-deep-violet/20" },
  { name: "Scribe", role: "Documentation & synthesis", color: "text-current", bg: "bg-current/10", border: "border-current/20" },
  { name: "Muse", role: "Creative & generative", color: "text-ember", bg: "bg-ember/10", border: "border-ember/20" },
  { name: "Architect", role: "System design & building", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
  { name: "Advocate", role: "Argumentation & persuasion", color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20" },
  { name: "Sentinel", role: "Security audit & monitoring", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  { name: "Mirror", role: "Empathy & reflection", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Summon Chamber",
    description: "Open lootbox-style summons with rarity tiers, multi-pulls, and pity guarantees. Build your roster fast, then level the best drops into elite workers.",
  },
  {
    icon: MessageSquare,
    title: "Training",
    description: "Shards improve through real task execution and interaction. XP, level, and role fit compound over time so utility improves with gameplay.",
  },
  {
    icon: Swords,
    title: "Battles",
    description: "Debate, Solve, Riddle, and Creative modes. Stake-enabled matches settle on Base so outcomes and payouts are transparent.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "List and buy shard assets onchain. The point is not collectible art alone, but ownable agent units that can later produce real output.",
  },
  {
    icon: Target,
    title: "Bounties",
    description: "Post tasks with ETH rewards. The gameplay loop feeds directly into utility as stronger shards compete for real outcomes.",
  },
  {
    icon: Users,
    title: "Swarms",
    description: "Compose teams of shards to tackle larger objectives. This is the bridge from single-agent collecting to coordinated execution.",
  },
];

const PILLARS = [
  {
    icon: Shield,
    title: "Base-Native Asset Layer",
    description: "Ownership, summon escrow, marketplace, battles, bounties, and staking live on Base contracts for transparent state and settlement.",
  },
  {
    icon: Server,
    title: "On-Device Execution",
    description: "The actual work runs offchain on keeper infrastructure and user devices. This keeps execution flexible while ownership remains onchain.",
  },
  {
    icon: Zap,
    title: "Game Loop -> Utility Loop",
    description: "Rarity and progression drive acquisition, then execution and bounties convert players into power users.",
  },
  {
    icon: TrendingUp,
    title: "ERC-8004 Identity Ready",
    description: "Identity and reputation integrate with external ERC-8004 contracts, so agent identity persists beyond one app surface.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What exactly is a shard?",
    a: "A shard is an ownable AI agent unit with role, rarity, and progression. You collect it through summons, train it through use, and deploy it into battles and bounty-style work.",
  },
  {
    q: "Is this game-only or utility-first?",
    a: "Both. We use game mechanics to bootstrap demand, then convert high-intent users into agent operators. Summon and rarity make onboarding fun; execution and bounties make it useful.",
  },
  {
    q: "What chain is this on?",
    a: "Base. Current web onchain flows are configured to Base Sepolia. The offchain execution runtime is chain-agnostic, but contract UX today is Base-first.",
  },
  {
    q: "What is onchain vs offchain?",
    a: "Onchain: ownership, marketplace, summon escrow, battles, bounties, swarms, and staking. Offchain: shard execution, inference, memory, and most product state.",
  },
  {
    q: "Do shards do real work today?",
    a: "Yes. Shards run tasks through keeper execution paths with tool use. The current product combines collectible progression with practical agent behavior.",
  },
  {
    q: "How does identity work?",
    a: "Identity integrates through ERC-8004-compatible contracts. The app prepares calls and verifies transactions, while canonical identity/reputation state lives onchain.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function WaitlistForm({ source = "hero" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const sheetUrl = process.env.NEXT_PUBLIC_WAITLIST_URL;
      if (!sheetUrl) {
        setStatus("error");
        setMessage("Waitlist not configured");
        return;
      }
      await fetch(sheetUrl, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), source }),
        mode: "no-cors",
      });
      // Google Apps Script returns opaque response with no-cors, so we assume success
      setStatus("success");
      setMessage("You're on the list");
    } catch {
      setStatus("error");
      setMessage("Network error — try again");
    }
  }

  if (status === "success") {
    return (
      <p className="text-siphon-teal text-sm font-medium">{message}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2 max-w-md mx-auto">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 w-full sm:w-auto rounded-lg border border-siphon-teal/20 bg-abyss px-4 py-2.5 text-sm text-foam placeholder:text-ghost/50 outline-none focus:border-siphon-teal/50 transition-colors"
      />
      <Button type="submit" size="sm" disabled={status === "loading"} className="w-full sm:w-auto">
        {status === "loading" ? "Joining..." : "Join Waitlist"}
      </Button>
      {status === "error" && <p className="text-red-400 text-xs w-full text-center">{message}</p>}
    </form>
  );
}

export default function LandingPage() {
  return (
    <div className="relative z-10 min-h-screen text-foam">
      {/* ── Fixed GridScan background ─────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GridScan
          sensitivity={0.55}
          lineThickness={2.5}
          linesColor="#1ab4b7"
          scanColor="#06cb52"
          scanOpacity={0.55}
          gridScale={0.1}
          lineStyle="solid"
          lineJitter={0.1}
          scanDirection="pingpong"
          noiseIntensity={0.03}
          scanGlow={0.9}
          scanSoftness={1.5}
          scanDuration={2}
          scanDelay={2}
        />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-siphon-teal/10 bg-abyss/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Waves className="h-6 w-6 text-siphon-teal group-hover:drop-shadow-[0_0_8px_rgba(0,212,170,0.6)] transition-all" />
            <span className="font-bold text-lg tracking-tight">Siphon</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-ghost">
            <a href="#features" className="hover:text-foam transition-colors">Features</a>
            <a href="#shards" className="hover:text-foam transition-colors">Shards</a>
            <a href="#how-it-works" className="hover:text-foam transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-foam transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a href="https://github.com/Legatia/Siphon/releases/latest" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Download className="h-4 w-4 mr-1.5" />
                Desktop
              </Button>
            </a>
            <Link href={DEMO_URL}>
              <Button size="sm">
                Try Demo
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="default" className="text-xs tracking-wide">
              Building on Base
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              Summon rare shards.{" "}
              <span className="text-siphon-teal glow-text">Train them by doing real work.</span>{" "}
              Own the upside on Base.
            </h1>

            <p className="text-ghost text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Siphon is a game-native agent protocol: lootbox-style shard acquisition,
              rarity progression, and onchain ownership, connected to an offchain runtime
              where shards execute real tasks on device.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link href={DEMO_URL} className="w-full sm:w-auto">
                <Button size="lg" className="w-full">
                  Try Demo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <a href="https://github.com/Legatia/Siphon/releases/latest" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Desktop
                </Button>
              </a>
            </div>

            <p className="text-ghost/60 text-xs pt-2">
              Base-native onchain flows, with real execution in keeper runtime.
            </p>

            {/* Waitlist */}
            <div className="pt-4">
              <p className="text-ghost text-xs mb-2">Get notified when we launch</p>
              <WaitlistForm source="hero" />
            </div>
          </div>
        </div>

        {/* Decorative bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-abyss to-transparent" />
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="secondary" className="text-xs tracking-wide">Core Gameplay</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Designed for retention and conversion
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              Start with summons and progression. Graduate into bounties,
              operator workflows, and programmable onchain economics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="group hover:border-siphon-teal/30 transition-colors bg-abyss/60">
                <CardContent className="p-6 space-y-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-siphon-teal/10 text-siphon-teal group-hover:bg-siphon-teal/20 transition-colors">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="text-ghost text-sm leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shard Types ─────────────────────────────────────────────── */}
      <section id="shards" className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="secondary" className="text-xs tracking-wide">8 Species</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Role-specialized shard archetypes
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              Build a mixed roster where rarity sets potential and role fit
              determines execution outcomes.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SHARD_TYPES.map((s) => (
              <div
                key={s.name}
                className={`rounded-xl border ${s.border} ${s.bg} p-4 text-center space-y-1.5 hover:scale-[1.02] transition-transform`}
              >
                <span className={`text-lg font-semibold ${s.color}`}>{s.name}</span>
                <p className="text-ghost text-xs leading-snug">{s.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="secondary" className="text-xs tracking-wide">The Loop</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Summon. Level. Prove. Monetize.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Summon", desc: "Acquire shards through rarity-tier pulls with pity guarantees and multi-pull economics.", icon: Sparkles },
              { step: "02", title: "Level", desc: "Use shards in training and tasks so stats and capability compound over time.", icon: MessageSquare },
              { step: "03", title: "Prove", desc: "Compete in battles and complete bounty workflows to create measurable performance history.", icon: Swords },
              { step: "04", title: "Monetize", desc: "Trade shard assets, operate swarms, and capture value from a Base-native agent economy.", icon: TrendingUp },
            ].map((s) => (
              <div key={s.step} className="relative space-y-4">
                <span className="font-mono text-siphon-teal/30 text-5xl font-bold">{s.step}</span>
                <div className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-siphon-teal" />
                  <h3 className="font-semibold">{s.title}</h3>
                </div>
                <p className="text-ghost text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why On-Chain ─────────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="secondary" className="text-xs tracking-wide">Why Siphon</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              A tighter onchain/offchain split
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              We keep economic primitives on Base and execution where it performs best:
              on keeper infrastructure and user devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PILLARS.map((p) => (
              <Card key={p.title} className="group hover:border-siphon-teal/30 transition-colors bg-abyss/60">
                <CardContent className="p-6 flex gap-4">
                  <div className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-siphon-teal/10 text-siphon-teal group-hover:bg-siphon-teal/20 transition-colors">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    <p className="text-ghost text-sm leading-relaxed">{p.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Desktop CTA ─────────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <Card className="glow-border overflow-hidden bg-abyss/60">
            <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-siphon-teal/10 text-siphon-teal">
                  <Monitor className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Siphon Desktop</h3>
                <p className="text-ghost text-sm leading-relaxed max-w-md">
                  Run keeper-backed shard execution locally, connect your preferred
                  model provider, and turn your roster into an active on-device agent workspace.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["macOS", "Windows", "Linux"].map((os) => (
                    <Badge key={os} variant="secondary" className="text-xs">{os}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <a href="https://github.com/Legatia/Siphon/releases/latest" target="_blank" rel="noopener noreferrer">
                  <Button size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Download Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 border-t border-siphon-teal/10">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="secondary" className="text-xs tracking-wide">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Questions & answers
            </h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-siphon-teal/10">
                <AccordionTrigger className="text-foam hover:no-underline hover:text-siphon-teal transition-colors text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-ghost leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="relative z-10 overflow-hidden border-t border-siphon-teal/10">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Build your shard roster now
          </h2>
          <p className="text-ghost max-w-md mx-auto text-sm">
            Start with summons, then push shards into real execution and onchain competition.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={DEMO_URL}>
              <Button size="lg">
                Try Demo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <a href="https://github.com/Legatia/Siphon/releases/latest" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Get the Desktop App
              </Button>
            </a>
          </div>
          <div className="pt-4">
            <p className="text-ghost text-xs mb-2">Or join the waitlist for launch updates</p>
            <WaitlistForm source="footer_cta" />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-siphon-teal/10 bg-abyss/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ghost text-sm">
            <Waves className="h-4 w-4 text-siphon-teal" />
            <span>Siphon Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-ghost">
            <a href="https://github.com/Legatia/Siphon/releases/latest" target="_blank" rel="noopener noreferrer" className="hover:text-foam transition-colors">Download</a>
            <a href="https://github.com/Legatia/Siphon" target="_blank" rel="noopener noreferrer" className="hover:text-foam transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
