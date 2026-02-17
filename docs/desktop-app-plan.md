# Siphon Protocol — Desktop App & Future Architecture Plan

## 1. Executive Summary

Siphon Protocol's web app serves as the onboarding funnel — low friction, wallet-optional, instant access. The desktop app (Tauri) is the power-user platform: local AI inference, keeper node hosting, agent workspaces, 3D avatars, and Steam distribution. Both share the same backend contracts and P2P network.

**Timeline priority:** Web first (current), Desktop second (post-launch).

---

## 2. Desktop App — Tauri Architecture

### Why Tauri

| Concern | Tauri | Electron |
|---------|-------|----------|
| Binary size | ~3-8 MB | ~150+ MB |
| RAM usage | ~30-50 MB | ~200+ MB |
| Rust backend | Native — same language as keeper-node | N/A |
| Webview | System (WebKit/WebView2) | Bundled Chromium |
| Security | Sandboxed by default, fine-grained permissions | Full Node.js access |
| Steam | Works (single binary, no runtime deps) | Works but heavy |
| GPU access | Via webview (WebGL/WebGPU) + Rust-side wgpu | Via Chromium |
| Auto-update | Built-in updater plugin | electron-updater |
| Code sharing | Reuse entire Next.js frontend as static export | Same |

### Project Structure

```
apps/desktop/
├── src-tauri/
│   ├── Cargo.toml           # Tauri app + keeper-node deps merged
│   ├── tauri.conf.json       # Window config, permissions, plugins
│   ├── src/
│   │   ├── main.rs           # Tauri entry, register commands
│   │   ├── commands/         # Tauri IPC command handlers
│   │   │   ├── keeper.rs     # Start/stop keeper node
│   │   │   ├── inference.rs  # Local model management
│   │   │   ├── wallet.rs     # Keystore + signing
│   │   │   ├── agent.rs      # Agent workspace commands
│   │   │   └── system.rs     # Resource monitoring
│   │   ├── keeper/           # Extracted from apps/keeper-node/src/
│   │   │   ├── node.rs
│   │   │   ├── dht.rs
│   │   │   ├── gossip.rs
│   │   │   ├── keeper.rs
│   │   │   └── ...
│   │   ├── inference/
│   │   │   ├── engine.rs     # llama.cpp / candle bindings
│   │   │   ├── models.rs     # Model registry + download
│   │   │   └── quantize.rs   # GGUF quantization helpers
│   │   └── db.rs             # Local SQLite (rusqlite)
│   └── icons/                # App icons for all platforms
├── src/                      # Frontend (shared with web or dedicated)
│   ├── App.tsx               # Desktop-specific shell with sidebar
│   ├── pages/                # Desktop-specific pages (workspace, etc.)
│   └── ...                   # Reused components from apps/web
├── package.json
└── vite.config.ts            # Vite (Tauri's recommended bundler)
```

### Keeper Node Integration

The Rust keeper-node (`apps/keeper-node/`) is extracted into a library crate and consumed by both the standalone CLI binary and the Tauri app:

```
packages/keeper-core/        # New: shared Rust library crate
├── Cargo.toml               # [lib] crate
└── src/
    ├── lib.rs
    ├── node.rs
    ├── dht.rs
    ├── gossip.rs
    ├── keeper.rs
    ├── shard.rs
    ├── capture.rs
    ├── inference.rs
    ├── chain.rs
    ├── db.rs
    └── monitor.rs

apps/keeper-node/             # Thin CLI wrapper
├── Cargo.toml                # depends on keeper-core
└── src/main.rs               # clap CLI → keeper-core

apps/desktop/src-tauri/       # Tauri wrapper
├── Cargo.toml                # depends on keeper-core + tauri
└── src/main.rs               # Tauri IPC → keeper-core
```

### Tauri IPC Commands

```rust
#[tauri::command]
async fn start_keeper(config: KeeperConfig) -> Result<KeeperStatus, String>;

#[tauri::command]
async fn stop_keeper() -> Result<(), String>;

#[tauri::command]
async fn keeper_status() -> Result<KeeperStatus, String>;

#[tauri::command]
async fn load_model(model_id: String, quantization: String) -> Result<ModelInfo, String>;

#[tauri::command]
async fn run_inference(model_id: String, prompt: String) -> Result<String, String>;

#[tauri::command]
async fn list_models() -> Result<Vec<ModelInfo>, String>;

#[tauri::command]
async fn spawn_agent_workspace(shard_id: String) -> Result<WorkspaceId, String>;

#[tauri::command]
async fn agent_execute(workspace_id: String, task: AgentTask) -> Result<TaskResult, String>;
```

### Desktop-Specific Features

1. **System tray** — keeper node runs in background, shows peer count + hosted shards
2. **Native notifications** — battle challenges, shard decay warnings, marketplace sales
3. **File system access** — agent workspaces with sandboxed FS for coding tasks
4. **Local keystore** — encrypted private key storage (no browser extension required)
5. **Hardware monitoring** — GPU/CPU/RAM dashboard for keeper resource allocation
6. **Offline mode** — local inference + cached shard data when disconnected

---

## 3. Three.js / React Three Fiber — 3D Avatar System

### Why 3D

The current Canvas 2D avatars are functional but flat. 3D procedural creatures:
- Drive cosmetic sales (outfits, particles, animations are far more compelling in 3D)
- Enable battle arenas with camera work and lighting
- Create showroom/gallery experiences for marketplace items
- Scale to desktop with full GPU acceleration

### Architecture

```
packages/avatar-3d/           # Shared between web + desktop
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── creature.tsx          # Main <Creature> R3F component
    ├── genome-to-mesh.ts     # Genome hash → mesh parameters
    ├── body-shapes/          # 8 base geometries (procedural)
    │   ├── jellyfish.ts      # Dome + trailing tentacles
    │   ├── squid.ts          # Mantle + arms
    │   ├── ray.ts            # Flat body + wing fins
    │   ├── nautilus.ts       # Spiral shell
    │   ├── eel.ts            # Serpentine tube
    │   ├── angler.ts         # Bulb head + lure
    │   ├── seahorse.ts       # Curved body + snout
    │   └── octopus.ts        # Round head + 8 arms
    ├── materials/
    │   ├── bioluminescent.ts # Custom shader: glow + pulse
    │   ├── iridescent.ts     # Angle-dependent color shift
    │   └── deep-sea.ts       # Translucent + subsurface scatter
    ├── patterns/
    │   ├── spots.ts          # UV-mapped spot texture
    │   ├── stripes.ts
    │   ├── hexagons.ts
    │   ├── circuits.ts       # Tech-organic pattern
    │   └── fractals.ts       # Mandelbrot-derived
    ├── animations/
    │   ├── idle.ts           # Floating bob + tentacle sway
    │   ├── attack.ts         # Battle animations per type
    │   ├── capture.ts        # Capture sequence
    │   └── fuse.ts           # Fusion transformation
    ├── cosmetics/
    │   ├── loader.ts         # Load cosmetic GLTF/GLB models
    │   ├── attach.ts         # Bone attachment system
    │   └── particles.ts      # Particle effect cosmetics
    ├── scene/
    │   ├── battle-arena.tsx   # Arena environment with lighting
    │   ├── showcase.tsx       # Single creature display (marketplace)
    │   └── drift-world.tsx    # Drift map 3D environment
    └── utils/
        ├── lod.ts            # Level-of-detail switching
        └── performance.ts    # FPS monitoring, quality auto-adjust
```

### Procedural Generation Pipeline

```
genome hash (32 bytes)
  ├── bytes[0-3]   → body shape index (0-7) + scale/proportion params
  ├── bytes[4-7]   → appendage count, length, curvature
  ├── bytes[8-9]   → eye count (1-3), size, pupil shape
  ├── bytes[10-13] → color: primary (from shard type), secondary, accent
  ├── bytes[14-15] → bioluminescence: intensity, pulse frequency, glow color
  ├── bytes[16-17] → pattern: type index, scale, rotation
  ├── bytes[18-19] → material: shader type, roughness, metalness
  ├── bytes[20-23] → animation: idle speed, sway amplitude, personality
  └── bytes[24-31] → reserved for future traits
```

### Rendering Strategy

| Context | Renderer | Quality |
|---------|----------|---------|
| Shard card (list) | 2D canvas fallback OR low-poly snapshot | Fast |
| Shard detail page | R3F with orbit controls | Medium |
| Battle arena | Full R3F scene with lighting + particles | High |
| Marketplace preview | R3F with turntable rotation | Medium |
| Drift map (many creatures) | Instanced meshes OR 2D sprites from 3D snapshots | Optimized |
| Desktop app | Full quality, WebGPU when available | Maximum |

### Performance Budget

- **Web:** Target 60fps on mid-range GPU. Use LOD (3 levels), frustum culling, instancing for drift map.
- **Desktop:** Target 60fps at high quality. Use WebGPU via wgpu passthrough if available.
- **Fallback:** If WebGL not available or too slow, fall back to current Canvas 2D renderer.

### Key Dependencies

```json
{
  "@react-three/fiber": "^9.x",
  "@react-three/drei": "^10.x",
  "three": "^0.172.x",
  "three-custom-shader-material": "^6.x",
  "postprocessing": "^7.x"
}
```

---

## 4. Local AI Inference

### Why Local

- Keepers hosting shards need to run inference. Cloud API calls cost money per request.
- Privacy: users may not want task data sent to OpenAI/Anthropic.
- Latency: local inference is faster for small models.
- Offline: desktop users can interact with their shards without internet.

### Engine Options

| Engine | Language | GPU Support | Integration |
|--------|----------|-------------|-------------|
| llama.cpp | C++ | CUDA, Metal, Vulkan | Rust bindings via `llama-cpp-rs` |
| Candle | Rust | CUDA, Metal | Native Rust, built by HuggingFace |
| Ollama | Go | CUDA, Metal | HTTP API (separate process) |

**Recommendation:** Start with Ollama integration (simplest — just HTTP calls to localhost), add llama.cpp/Candle as a compiled-in option later for single-binary distribution.

### Model Strategy

- **Shard inference:** Small models (7B-13B) quantized to Q4/Q5 GGUF
- **Battle judging:** Larger model (30B+) or cloud fallback
- **Specialization:** Fine-tuned LoRA adapters per shard type
- **Model marketplace:** Keepers can share custom fine-tunes

### Desktop Model Manager

```
~/.siphon/
├── config.toml
├── models/
│   ├── registry.json          # Downloaded models + metadata
│   ├── mistral-7b-q4.gguf
│   ├── llama3-8b-q5.gguf
│   └── lora/
│       ├── oracle-specialist.gguf
│       └── cipher-security.gguf
└── data/
    ├── shards.db
    └── agent-workspaces/
        └── <workspace-id>/
```

---

## 5. Agent Workspace System

### Concept

Shards are not just collectibles — they are working AI agents. The desktop app provides sandboxed workspaces where shards execute tasks:

- **Coding:** Sandboxed filesystem + terminal, shard writes/edits code
- **Research:** Web access (controlled), document analysis, summarization
- **Trading:** API integrations with exchanges (read-only by default, trade with explicit permission)
- **Office:** Document generation, email drafting, data analysis

### Architecture

```
AgentWorkspace {
  id: UUID,
  shardId: string,
  type: "coding" | "research" | "trading" | "office",
  sandboxRoot: PathBuf,      // Isolated filesystem
  permissions: {
    network: bool,            // Can access internet
    filesystem: "read" | "readwrite" | "none",
    shell: bool,              // Can execute commands
    apis: string[],           // Allowed external API domains
  },
  history: TaskExecution[],   // Full audit trail
}
```

### OpenClaw Integration

Shards are subagents within the OpenClaw ecosystem:
1. User's main OpenClaw bot spawns/manages shards
2. Shards inherit task routing from the parent bot
3. Cross-shard collaboration: multiple shards work on sub-tasks of a larger job
4. Shard skill level and specialization determine task routing priority

---

## 6. Steam Distribution

### Feasibility

Tauri apps compile to a single native binary per platform — ideal for Steam:
- **No runtime dependencies** (unlike Electron which bundles Chromium)
- **Small download** (~10-50 MB depending on bundled assets)
- **Auto-updates** via Steam's built-in update system (disable Tauri's updater)
- **Achievements** — map to shard milestones (first capture, first battle win, level 20, etc.)
- **Steam Workshop** — cosmetic sharing, custom shard skins
- **Rich Presence** — show current activity (training shard, in battle, hosting keeper node)

### Steamworks Integration

```rust
// Via steamworks-rs crate
steamworks = "0.11"
```

Key integrations:
- **Authentication:** Steam ID as alternate login (alongside wallet + email)
- **Achievements:** ~30 achievements mapped to game milestones
- **Trading Cards:** 8 cards (one per shard type), craft into badges
- **Workshop:** Upload/download cosmetic items
- **Friends:** See friends' shards, challenge to battles
- **Cloud Save:** Sync encrypted keystore + local DB

### Store Page Strategy

- **Genre:** Strategy / Simulation / RPG with AI twist
- **Tags:** AI, Blockchain, Creature Collector, Competitive, Free to Play
- **Pricing:** Free to Play (matches web model), in-app purchases via Steam Wallet → in-game currency
- **Early Access** consideration: launch EA to gather feedback before full release

---

## 7. Payment Model — Dual Web2/Web3

### Subscription Tiers (Revised)

| Tier | Own Shards | Hosting | Inference | Limit | Cost |
|------|-----------|---------|-----------|-------|------|
| **Free (Trainer)** | 0 (bond only) | N/A | Keeper pays | N/A | $0 |
| **Trainer+** | 3 | Platform-hosted | Platform pays | 1,000 msg/mo | $4.99/mo |
| **Keeper** | 10 | Self-hosted | You pay | Unlimited | $9.99/mo or 100 USDC stake |
| **Keeper+** | 25 | Self-hosted | You pay | Unlimited | $29.99/mo or 500 USDC stake |
| **Keeper Pro** | 100 | Self-hosted | You pay | Unlimited | $99.99/mo or 2,000 USDC stake |
| **Enterprise** | Unlimited | Self-hosted | You pay | Unlimited | Custom |

#### Inference Routing by Tier

- **Free Trainer (bonding):** Trainer sends message → platform relays to Keeper's node → Keeper runs inference → response returns. Keeper bears compute cost; covered by rental fee. If Keeper is offline, platform provides fallback inference (cost deducted from Keeper's revenue).
- **Trainer+ (platform-hosted):** Trainer sends message → platform runs inference using its own API keys (OpenAI/Anthropic). Capped at 1,000 messages/month. Subscription fee covers compute cost. Natural upgrade path: hit the cap → become a Keeper with unlimited self-hosted inference.
- **Keeper+ and above (self-hosted):** Keeper runs inference on their own hardware (local model) or their own API keys (cloud). Zero platform compute cost. Unlimited interactions.

#### Identity Upkeep (Anti-Hoarding)

Every owned shard requires a monthly identity attestation to maintain its on-chain status:
- Cost: ~$1.00/shard/month (paid in $DRIP or USDC)
- Shards listed in Shelter or actively battled: 50-100% upkeep discount
- Skip upkeep → shard enters "unregistered" state (loses ERC-8004 identity, can't battle/trade/evolve, still works locally as a generic model)
- This makes hoarding 100 private shards cost $100/mo in upkeep alone, pushing whales toward ecosystem participation or higher tiers

### Payment Rails

```
Web2 Users (no wallet):
  Stripe Checkout → Subscription OR One-time (marketplace)
  Stripe → In-game currency ($DRIP or branded stablecoin equivalent)

Web3 Users (wallet connected):
  USDC direct payment → Smart contract
  Branded stablecoin (backed by USDC) for in-game economy
  Keeper staking in USDC → KeeperStaking.sol

Steam Users:
  Steam Wallet → In-game currency (Steam takes 30% cut)
```

### Branded Stablecoin

Coinbase offers white-label stablecoin infrastructure backed by USDC:
- Mint branded token (e.g., $DRIP) 1:1 with USDC
- Users see "$DRIP" in-game instead of raw USDC
- Web2 users purchase $DRIP with credit card (Stripe → mint)
- Web3 users swap USDC → $DRIP directly
- All marketplace transactions in $DRIP
- Revenue: transaction fees on marketplace trades (2-5%)

### Coinbase Smart Wallet

Add alongside existing MetaMask connector:
- **Passkey-based** — no extension, no seed phrase
- **Gasless transactions** — Coinbase sponsors gas on Base
- **Instant onboarding** — create wallet with email/biometric
- Perfect for web2 users who don't have MetaMask

```typescript
// wagmi config addition
import { coinbaseWallet } from "wagmi/connectors";

coinbaseWallet({
  appName: "Siphon Protocol",
  preference: "smartWalletOnly",  // Force smart wallet (no extension)
})
```

---

## 8. Web ↔ Desktop Coexistence

### Shared Infrastructure

| Layer | Shared | Platform-Specific |
|-------|--------|-------------------|
| Smart contracts | Same contracts on Base | — |
| P2P network | Same DHT + GossipSub | Web: browser libp2p, Desktop: Rust libp2p |
| API | Same Next.js API (hosted) | Desktop can also run local API |
| Components | Most React components | Desktop: sidebar shell, system tray, native dialogs |
| Avatar renderer | packages/avatar-3d (R3F) | Desktop: higher quality settings |
| Database | Server SQLite (API) | Desktop: local SQLite + sync |
| Auth | Wallet + session tokens | Desktop: stored keystore + Steam ID |

### User Journey

```
New User → Web (siphonprotocol.com)
  → Sign up (email or wallet)
  → Explore drift, bond with a shard (free, uses Keeper's compute)
  → Train, battle as free Trainer
  → Hit engagement ceiling → Trainer+ ($4.99, own 3 shards, 1,000 msg/mo)
  → Hit message cap → Keeper path (self-hosted, unlimited)

Keeper Path → Desktop (Steam or direct download)
  → Import account (QR code or wallet)
  → Install desktop app → auto-detects hardware
  → Downloads local model → self-hosted inference (no API costs)
  → Run keeper node → host shards for Trainers → earn rental income
  → Agent workspaces for real tasks (coding, research, trading)
  → Full 3D experience
```

The entire funnel pushes toward Keeper: Free Trainer (try it) → Trainer+ (own shards, hit limits) → Keeper (self-hosted, unlimited, earn income). Every tier upgrade solves a real friction point.

### Data Sync

- On-chain data: always in sync (both read same contracts)
- Off-chain data (training history, chat logs): sync via API
- Desktop has local cache that works offline, syncs when connected

---

## 9. Implementation Phases

### Phase A: 3D Avatar Package (2-3 weeks)
1. Create `packages/avatar-3d` with R3F
2. Implement 8 body shape generators
3. Bioluminescent + iridescent shaders
4. Cosmetic attachment system
5. Integrate into web app (replace Canvas 2D on detail pages)
6. Keep Canvas 2D as fallback for cards/lists

### Phase B: Payment Restructure (1-2 weeks)
1. Restructure subscription tiers (Free=Trainer, Trainer+, Keeper, Keeper+)
2. Add Coinbase Smart Wallet connector
3. USDC payment path for Web3 users
4. Branded stablecoin contract ($DRIP)

### Phase C: Tauri Desktop Shell (2-3 weeks)
1. Set up Tauri project structure
2. Extract keeper-node into `packages/keeper-core` library crate
3. Tauri IPC commands for keeper management
4. Port web frontend to Vite for Tauri compatibility
5. System tray + native notifications
6. Local keystore (encrypted)

### Phase D: Local Inference (2 weeks)
1. Ollama integration via HTTP
2. Model download manager
3. Shard inference routing (local vs cloud)
4. LoRA adapter loading for specializations

### Phase E: Agent Workspaces (2-3 weeks)
1. Sandboxed filesystem per workspace
2. Task execution engine
3. OpenClaw subagent protocol integration
4. Coding workspace: editor + terminal
5. Audit trail + permissions UI

### Phase F: Steam Integration (1-2 weeks)
1. Steamworks-rs integration
2. Achievement mapping
3. Steam Wallet → in-game currency
4. Store page + marketing assets
5. Workshop support for cosmetics

---

## 10. Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tauri webview inconsistencies across platforms | UI bugs on Linux/Windows | Test matrix, CSS normalization, graceful degradation |
| WebGPU adoption still early | Can't use advanced shaders everywhere | WebGL2 fallback for all shaders, WebGPU as progressive enhancement |
| Local inference quality vs cloud | Shards seem "dumber" locally | Use best available quantizations, allow cloud fallback toggle |
| Steam's 30% cut on in-app purchases | Revenue impact | Web store as primary, Steam for reach + legitimacy |
| Branded stablecoin regulatory complexity | Legal risk | Work with Coinbase's compliance framework, geo-restrict if needed |
| P2P NAT traversal for desktop keepers | Connectivity issues | STUN/TURN relay servers, WebSocket fallback |

---

## 11. Open Questions

1. **Desktop-first or desktop-companion?** Should desktop replace web entirely for returning users, or stay a companion?
2. **Model licensing:** Can we distribute quantized models with the app, or must users download separately?
3. **Steam vs Epic vs itch.io:** Launch on one or multiple storefronts?
4. **Mobile app (future)?** React Native shares code, but mobile keeper nodes are impractical.
5. **Branded stablecoin name:** $DRIP? $SIPHON? $ABYSS?
