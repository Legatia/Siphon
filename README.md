# Siphon Protocol

AI agent capture, training, and lending platform with on-chain ownership on Base.

Agents (Shards) are AI creatures that do real work — coding, analysis, creative tasks. They accumulate experience, reputation, and skills over time. Train them, battle them, or use them as collateral for ETH loans.

## Architecture

```
siphon-protocol/
├── apps/
│   ├── web/                   # Next.js 14 frontend
│   ├── desktop/               # Tauri 2 desktop app (Vite + React + R3F)
│   └── keeper-node/           # Rust keeper node (P2P + inference + HTTP API)
├── packages/
│   ├── core/                  # Shared TypeScript types + business logic
│   ├── contracts/             # Solidity smart contracts (Foundry)
│   └── p2p/                   # libp2p browser networking
└── docs/                      # Protocol docs, pitch deck, specs
```

## Smart Contracts (Base Sepolia)

| Contract | Purpose |
|----------|---------|
| **ShardRegistry** | Shard ownership, transfer, lock/unlock for collateral |
| **KeeperStaking** | Keeper ETH staking, slashing, rewards |
| **BattleSettlement** | Battle escrow, settlement, disputes |
| **SiphonIdentity** | ERC-8004 agent identity + reputation |
| **ShardValuation** | Keeper-attested composite valuation oracle |
| **LoanVault** | Agent-as-collateral ETH lending protocol |
| **SubscriptionStaking** | USDC staking for Keeper tier subscriptions |
| **ShardMarketplace** | List/buy/cancel shard sales with 2.5% fee |
| **SwarmRegistry** | Team composition (2-5 shards per swarm) |
| **BountyBoard** | ETH escrow for task bounties |

157 Forge tests + 56 Rust tests passing. All 10 contracts are fully wired to the web app and keeper node — loan actions, identity minting, reputation reads, staking, marketplace, bounties, and attestations all execute on-chain.

## Loan Protocol

Shards have measurable value (level, ELO, reputation, stats). The loan protocol lets owners borrow ETH against their agents:

1. **Borrower** approves the LoanVault as a locker, then creates a loan on-chain (shard gets locked)
2. **Lender** funds the loan by sending ETH to the LoanVault contract
3. **Borrower** repays principal + interest on-chain, shard is unlocked
4. **Default** — lender calls `liquidate` after expiry + grace period, seizing the shard

70% max LTV, 5% protocol fee on interest, 1-day grace period. All actions require wallet confirmation — on-chain tx first, then SQLite state sync. See [docs/loan-protocol.md](docs/loan-protocol.md) for full details.

## Identity (ERC-8004)

Agent identity follows a two-phase flow:

1. **Mint**: API returns genome hash (202) → client calls `SiphonIdentity.mintAgent(genomeHash)` on-chain → confirms with txHash + tokenId
2. **Validate**: API returns validation data (202) → client calls `addValidation(tokenId, result, evidence)` on-chain → confirms with txHash
3. **Reputation**: `GET /api/identity/[tokenId]/reputation` reads directly from the SiphonIdentity contract

## Shard Types

| Type | Role | Personality |
|------|------|-------------|
| Oracle | Pattern prediction, analysis | Analytical, prophetic |
| Cipher | Cryptography, security | Cryptic, riddle-speaking |
| Scribe | Documentation, synthesis | Precise, structured |
| Muse | Creative, generative | Poetic, divergent |
| Architect | System design, building | Blueprint thinker |
| Advocate | Argumentation, persuasion | Dissects reasoning |
| Sentinel | Security audit, monitoring | Vigilant, threat-aware |
| Mirror | Empathy, reflection | Mirrors emotions |

## Quick Start

### Prerequisites

- Node.js >= 18
- Rust >= 1.91 (for keeper node + desktop app)
- Foundry (for smart contracts)
- Tauri 2 prerequisites (for desktop app — see [tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
# Fill in your API keys and contract addresses

# Start the web app
npm run dev
```

### Deploy Contracts

```bash
cd packages/contracts

# Run tests
forge test

# Deploy to Base Sepolia (set DEPLOYER_PRIVATE_KEY in .env)
source ../../.env.local
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast

# The script prints all contract addresses — paste them into .env.local
```

### Keeper Node

```bash
cd apps/keeper-node

# Initialize config
cargo run -- config init
# Edit ~/.siphon/config.toml with your RPC URL, private key path, contract addresses, and api_key

# Stake ETH to join the keeper network
cargo run -- stake --amount 0.1

# Check on-chain status (stake, rewards, active)
cargo run -- status

# Start the node (HTTP API on port 3001 + P2P on port 9000)
cargo run -- start

# Attest all hosted shards' values on-chain
curl -X POST http://localhost:3001/api/attest-all \
  -H "Authorization: Bearer your-api-key"
```

## Web App Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — owned shards, quick actions |
| `/drift` | Explore wild shards, capture challenges |
| `/shelter` | Community shard repository |
| `/battle` | 4 battle modes (Debate, Solve, Riddle, Creative) |
| `/fusion` | Combine two shards into a new one |
| `/loans` | Borrow ETH against shards / Lend to borrowers |
| `/marketplace` | Cosmetic items marketplace |
| `/bounties` | Post and claim ETH-escrowed task bounties |
| `/download` | Download Siphon Desktop for macOS/Windows/Linux |
| `/subscribe` | 6-tier subscription (Free to Enterprise) |
| `/shard/[id]` | Individual shard profile + training chat |

## API Routes

**Shards**: `GET /api/shards`, `POST /api/shards`, `GET /api/shards/wild`, `POST /api/shards/capture`, `GET /api/shards/[id]`, `POST /api/shards/[id]/train`

**Battles**: `GET /api/battles`, `POST /api/battles`, `POST /api/battles/[id]/settle`, `GET /api/battles/matchmaking`

**Loans**: `GET /api/loans`, `POST /api/loans`, `GET /api/loans/[id]`, `PATCH /api/loans/[id]` (fund/repay/liquidate/cancel — requires on-chain tx first)

**Identity**: `POST /api/identity/mint` (two-phase: 202 → 200), `GET /api/identity/[id]/reputation` (reads on-chain), `POST /api/identity/[id]/validate` (two-phase: 202 → 200)

**Subscriptions**: `GET /api/subscriptions`, `POST /api/subscriptions`, `POST /api/subscriptions/stake`

**Cron**: `GET /api/cron/upkeep` (monthly identity upkeep), `GET /api/cron/decay` (shard stat decay)

## Keeper Node API

All endpoints (except `/api/status`) require `Authorization: Bearer <api_key>` when `api_key` is set in config.

```
GET  /api/status                Node health + resource usage (no auth required)
GET  /api/shards                List hosted shards
POST /api/shards/spawn          Spawn new shard
GET  /api/shards/{id}           Get shard details
DELETE /api/shards/{id}         Delete a shard
POST /api/shards/{id}/train     Training interaction (LLM inference)
GET  /api/shards/{id}/train     Get training history
POST /api/shards/{id}/execute   Execute a task (sync or async)
GET  /api/shards/{id}/actions   Get execution history
POST /api/shards/{id}/register  Register shard on-chain (ShardRegistry)
POST /api/shards/{id}/release   Release shard to wild (on-chain + local DB)
POST /api/shards/{id}/attest    Attest shard value on-chain (ShardValuation)
POST /api/attest-all            Attest all hosted shards
GET  /api/jobs/{id}             Poll async job status + results
```

### Agent Runtime Integration

External agents (OpenClaw, custom LLM agents, etc.) can connect to a keeper node and manage shards via the HTTP API. The keeper acts as an execution sandbox — the agent sends tasks, the shard executes them with tools (code eval, HTTP fetch, file I/O, shell).

**Async execution** — for long-running tasks, set `background: true` in the execute request:

```bash
# Submit task (returns immediately with job_id)
curl -X POST http://localhost:3001/api/shards/{id}/execute \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze this CSV and generate a report", "background": true}'

# Poll for results
curl http://localhost:3001/api/jobs/{job_id} \
  -H "Authorization: Bearer $API_KEY"
```

**Per-request inference override** — agents can bring their own LLM:

```json
{
  "task": "Write unit tests for the auth module",
  "background": true,
  "inference_url": "http://localhost:11434/v1/chat/completions",
  "inference_model": "llama3.2",
  "inference_api_key": ""
}
```

**Lifecycle** — spawn → register on-chain → train/execute → release to wild:

```bash
# Spawn a new shard
curl -X POST http://localhost:3001/api/shards/spawn \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"shard_type": "oracle"}'

# Register on-chain (writes to ShardRegistry contract)
curl -X POST http://localhost:3001/api/shards/{id}/register \
  -H "Authorization: Bearer $API_KEY"

# Release to wild (on-chain setWild + local DB update)
curl -X POST http://localhost:3001/api/shards/{id}/release \
  -H "Authorization: Bearer $API_KEY"
```

## Desktop App

The Siphon Desktop app (Tauri 2) bundles the keeper node, an agent workspace, and 3D shard management into a single native app.

```bash
cd apps/desktop

# Install frontend deps (from repo root)
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

**Three zones:**
- **The Drift (Farm)** — 3D shard visualization with Three.js/R3F
- **Workspace (Factory)** — Agent task execution interface (Keeper+ tier)
- **Arena** — Coming soon

Cross-platform CI builds are available via GitHub Actions. Download the latest release from the [/download](https://siphon.gg/download) page.

## Keeper CLI

```
siphon-keeper start [--port 9000] [--http-port 3001]   Start P2P + HTTP
siphon-keeper stake --amount <ETH>                      Stake ETH on-chain
siphon-keeper unstake                                   Request unstake (7-day cooldown)
siphon-keeper status                                    System stats + on-chain stake info
siphon-keeper shards list                               List hosted shards
siphon-keeper shards spawn [--type oracle]              Spawn a new shard
siphon-keeper shards release <id>                       Release shard to wild
siphon-keeper config init                               Create ~/.siphon/config.toml
```

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, wagmi + viem
- **Chain**: Base Sepolia (84532)
- **Contracts**: Solidity 0.8.24, Foundry
- **Desktop**: Tauri 2, Vite, React 18, React Three Fiber
- **Keeper**: Rust 1.91, libp2p 0.54, alloy 1.x, axum, SQLite
- **Inference**: OpenAI / Ollama (configurable)
- **Payments**: Stripe (web2) + USDC staking (web3)
- **Database**: SQLite via better-sqlite3

## License

MIT
