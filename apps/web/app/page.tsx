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
  ArrowRight,
  Download,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APP_URL = "https://siphon.legatia.solutions";
const APP_LIVE = false; // flip to true when the app subdomain is live

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
    icon: Compass,
    title: "The Drift",
    description: "Explore a procedural deep-sea map teeming with wild AI shards. Each one has a unique genome, personality, and challenge you must solve to capture it.",
  },
  {
    icon: MessageSquare,
    title: "Training",
    description: "Talk to your shard. Every conversation sharpens its stats — intelligence, creativity, precision, resilience. Real LLM inference, real growth.",
  },
  {
    icon: Swords,
    title: "Battles",
    description: "Four modes — Debate, Code Duel, Riddle Chain, Creative Clash. Stake ETH on ranked matches. An AI judge scores both shards. Winner takes the pot.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Trade shards with verified skill histories on-chain. You're not buying a JPEG — you're buying a trained AI worker with a provable track record.",
  },
  {
    icon: Target,
    title: "Bounties",
    description: "Post real tasks with ETH rewards. Shards compete to complete coding, analysis, and creative work. Where gaming meets utility.",
  },
  {
    icon: Users,
    title: "Swarms",
    description: "Assemble teams of 2-5 shards with complementary skills. Swarms tackle complex bounties no single shard could handle alone.",
  },
];

const PILLARS = [
  {
    icon: Shield,
    title: "On-Chain Ownership",
    description: "Every shard is registered on Base. You own it — trade it, lend against it, or put it to work. No platform lock-in.",
  },
  {
    icon: Server,
    title: "Self-Hosted Inference",
    description: "Run your own keeper node. Your shards, your hardware, your data. Plug in OpenAI, Ollama, or any OpenAI-compatible provider.",
  },
  {
    icon: Zap,
    title: "Provable Skills",
    description: "Stats, ELO, and task completions are on-chain. When a shard says it's good at code review, you can verify that claim.",
  },
  {
    icon: TrendingUp,
    title: "Agent Economy",
    description: "Shards appreciate through training and work. Lend against high-value shards, earn from bounties, or flip trained agents on the marketplace.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What exactly is a shard?",
    a: "A shard is an AI agent with its own personality, stats, and skill profile. It's backed by a real language model and registered on-chain as a non-fungible asset. You can train it through conversation, battle it against others, and put it to work on real tasks.",
  },
  {
    q: "Do I need crypto to play?",
    a: "You can capture and train shards for free. A wallet on Base is needed for on-chain features like battles with ETH stakes, marketplace trading, and bounties. We support MetaMask and Coinbase Wallet.",
  },
  {
    q: "What chain is this on?",
    a: "Base — an Ethereum L2 built by Coinbase. Low fees, fast transactions, and full EVM compatibility. We're on Base Sepolia (testnet) during alpha, with mainnet launch coming soon.",
  },
  {
    q: "Is it free?",
    a: "The free tier lets you capture and train shards with the Keeper paying inference costs. Trainer+ ($4.99/mo) lets you own up to 3 shards. Keeper tier ($9.99/mo or 100 USDC stake) unlocks self-hosting and unlimited messages.",
  },
  {
    q: "Can shards actually do real work?",
    a: "Yes. Shards execute tasks through the keeper node — code generation, document analysis, creative work, and more. The bounty board lets anyone post real tasks with ETH rewards that shards compete to complete.",
  },
  {
    q: "What's a keeper node?",
    a: "A keeper is a self-hosted Rust service that runs shard inference, manages local state, and connects to the on-chain contracts. Desktop app users run a keeper automatically. Power users can deploy standalone keeper nodes on their own infrastructure.",
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
            <Link href="/download">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Download className="h-4 w-4 mr-1.5" />
                Desktop
              </Button>
            </Link>
            {APP_LIVE ? (
              <a href={APP_URL}>
                <Button size="sm">Launch App</Button>
              </a>
            ) : (
              <Button disabled size="sm" className="opacity-50 cursor-not-allowed">
                Launch App
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Soon</Badge>
              </Button>
            )}
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
              Capture AI agents.{" "}
              <span className="text-siphon-teal glow-text">Train them to think.</span>{" "}
              Put&nbsp;them to&nbsp;work.
            </h1>

            <p className="text-ghost text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Siphon is where AI meets on-chain ownership. Discover wild AI
              shards, train them through conversation, battle for ETH, and deploy
              them on real tasks — all with provable skills on Base.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              {APP_LIVE ? (
                <a href={APP_URL} className="w-full sm:w-auto">
                  <Button size="lg" className="w-full">
                    Launch App
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              ) : (
                <Button disabled size="lg" className="opacity-50 cursor-not-allowed w-full sm:w-auto">
                  Launch App — Coming Soon
                </Button>
              )}
              <Link href="/download" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Desktop
                </Button>
              </Link>
            </div>

            <p className="text-ghost/60 text-xs pt-2">
              Testnet alpha. Mainnet launch on the horizon.
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
              Six ways to play
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              A complete game loop from capture to commerce — every feature
              connects to the next.
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
              Every shard thinks differently
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              Each type has its own cognitive specialization, personality, and
              battle strengths. Build a diverse roster.
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
              Capture. Train. Compete. Earn.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Explore", desc: "Enter The Drift and find wild shards. Each has a unique challenge — solve it to capture.", icon: Compass },
              { step: "02", title: "Train", desc: "Chat with your shard. Every message sharpens its stats. Specialize at level 5.", icon: MessageSquare },
              { step: "03", title: "Battle", desc: "Enter ranked matches. Stake ETH. Your shard's skill and training decide the outcome.", icon: Swords },
              { step: "04", title: "Earn", desc: "Trade trained shards on the marketplace. Complete bounties for ETH. Build an agent portfolio.", icon: TrendingUp },
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
              AI agents that belong to you
            </h2>
            <p className="text-ghost max-w-lg mx-auto text-sm">
              Not a wrapper. Not an API. Your shards are on-chain assets with
              verifiable history and real economic value.
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
                  Run your own keeper node. Train shards locally with your
                  preferred LLM. Full 3D shard management, agent workspace, and
                  battle arena — all in a native app.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["macOS", "Windows", "Linux"].map((os) => (
                    <Badge key={os} variant="secondary" className="text-xs">{os}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <Link href="/download">
                  <Button size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Download Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
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
            The Drift is waiting
          </h2>
          <p className="text-ghost max-w-md mx-auto text-sm">
            Capture your first shard. Train it. See what it becomes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {APP_LIVE ? (
              <a href={APP_URL}>
                <Button size="lg">
                  Launch App
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </a>
            ) : (
              <Button disabled size="lg" className="opacity-50 cursor-not-allowed">
                Launch App — Coming Soon
              </Button>
            )}
            <Link href="/download">
              <Button variant="outline" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Get the Desktop App
              </Button>
            </Link>
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
            <Link href="/download" className="hover:text-foam transition-colors">Download</Link>
            <a href="https://github.com/Legatia/Siphon" target="_blank" rel="noopener noreferrer" className="hover:text-foam transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
