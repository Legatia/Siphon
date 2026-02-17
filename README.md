# Siphon Protocol

AI agent capture, training, and lending platform with on-chain ownership on Base.

Agents (Shards) are AI creatures that do real work — coding, analysis, creative tasks. They accumulate experience, reputation, and skills over time. Train them, battle them, or use them as collateral for ETH loans.

## Architecture

```
siphon-protocol/
├── apps/
│   ├── web/                   # Next.js 14 frontend
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

108 Forge tests passing. All 6 contracts are fully wired to the web app and keeper node — loan actions, identity minting, reputation reads, staking, and attestations all execute on-chain.

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
- Rust >= 1.88 (for keeper node)
- Foundry (for smart contracts)

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
# Edit ~/.siphon/config.toml with your RPC URL, private key path, and contract addresses

# Stake ETH to join the keeper network
cargo run -- stake --amount 0.1

# Check on-chain status (stake, rewards, active)
cargo run -- status

# Start the node (HTTP API on port 3001 + P2P on port 9000)
cargo run -- start

# Attest all hosted shards' values on-chain
curl -X POST http://localhost:3001/api/attest-all
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

```
GET  /api/status              Node health + resource usage
GET  /api/shards              List hosted shards
POST /api/shards/spawn        Spawn new shard
GET  /api/shards/{id}         Get shard details
POST /api/shards/{id}/train   Training interaction (LLM inference)
POST /api/shards/{id}/attest  Attest shard value on-chain
POST /api/attest-all          Attest all hosted shards
```

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
- **Keeper**: Rust 1.88, libp2p 0.54, alloy 1.x, axum, SQLite
- **Inference**: OpenAI / Ollama (configurable)
- **Payments**: Stripe (web2) + USDC staking (web3)
- **Database**: SQLite via better-sqlite3

## License

MIT
