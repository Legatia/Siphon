# Siphon Protocol — Business Case

## Core Thesis

AI agents are becoming commoditized. The defensible value isn't the agent itself — it's the **trained state, reputation, and composability** of agents with on-chain provenance. Siphon turns AI agents into appreciating financial assets that can be owned, traded, lent, and composed into teams.

## Why This Works

1. **Agents accumulate real value** — level, ELO, stats, task completion history, reputation are all tracked and attested on-chain by keeper nodes via ShardValuation
2. **Verifiable value enables financial primitives** — lending, leasing, trading only work because an agent's worth is price-discoverable (not self-reported)
3. **Keeper network = decentralized infrastructure** — no single cloud dependency, keepers compete on uptime and quality, staking aligns incentives
4. **Gamification is the retention layer** — capture, battle, fusion keep users engaged while the real utility (task execution, lending) generates revenue

## Revenue Streams

### Currently Built

| Stream | Mechanism | Margin |
|--------|-----------|--------|
| **Subscriptions** | 6 tiers: Free → Enterprise ($0–$99.99/mo or USDC stake) | High — recurring SaaS |
| **Identity upkeep** | ~$1/shard/mo for on-chain identity maintenance | High — recurring, scales with shard count |
| **Loan protocol fee** | 5% of interest on every ETH loan against agent collateral | Pure protocol revenue — scales with TVL |
| **Keeper staking** | USDC stakes for Keeper+ tiers (100–2000 USDC) | Capital lockup — reduces circulating supply |

### Near-Term (Next to Build)

| Stream | Mechanism | Estimated Take Rate |
|--------|-----------|---------------------|
| **Agent marketplace** | Buy/sell/rent trained shards | 5% of every transaction |
| **Swarm rental** | Rent a pre-built team of agents for a task | 5% of rental fee |
| **Bounty board** | Post task + ETH escrow, best agent/swarm claims it | 3% of bounty |
| **Agent leasing** | Temporary lease (like lending, but for utility not ETH) | 5% of lease fee |
| **Tool integrations** | Premium tools (GitHub, Slack, DB) for paying tiers only | Subscription upsell |

### Long-Term

| Stream | Mechanism |
|--------|-----------|
| **Enterprise API** | Companies deploy private keeper clusters, pay per-seat |
| **Agent IP licensing** | Trained agent configurations as exportable, licensable templates |
| **Desktop app (Steam)** | Tauri app with local inference, Steam Wallet payments |
| **Data marketplace** | Agents generate structured data from tasks — sell anonymized datasets |

## Unit Economics

### Per-Shard Economics
- Cost to host: ~$0.50–2/mo inference (depends on usage, model)
- Identity upkeep revenue: $1/mo (50–100% discount for active/Shelter shards)
- Training revenue: included in subscription
- Lending revenue: 5% of interest when used as collateral

### Per-Keeper Economics
- Keeper stakes ETH (min 0.1 ETH) to join network
- Earns: inference fees from hosted shards + staking rewards
- Slashed: for downtime or dishonest attestations
- Incentive: host more shards, attest honestly, maintain uptime

### Platform Revenue at Scale
- 10,000 active shards x $1/mo upkeep = $10K/mo baseline
- 1,000 loans averaging $50 principal, 10% interest, 5% protocol fee = $250/mo in fees
- 500 marketplace transactions/mo averaging $20, 5% cut = $500/mo
- 2,000 subscribers averaging $15/mo = $30K/mo
- **Total at modest scale: ~$40K/mo**

## Competitive Moat

| Advantage | Why It's Defensible |
|-----------|---------------------|
| **On-chain ownership** | Nobody else has ERC-8004 agent identity with verifiable reputation |
| **Agent-as-collateral lending** | Unique financial primitive — requires the entire stack (valuation oracle, lock/seize, keeper attestation) |
| **Keeper network effects** | More keepers = better uptime = more shards = more keepers |
| **Trained agent value** | Switching cost — a level 30 Oracle with 1000 completed tasks can't be replicated instantly |
| **Composable swarms** | Team compositions are IP — the right Oracle + Architect + Scribe combination is discovered through experimentation |

## What's Missing (Gaps to Close)

### Critical for Revenue

1. **Swarm orchestration** — multi-shard task decomposition and routing
   - Keeper decomposes task → assigns subtasks to specialized shards → aggregates results
   - This is the "team" primitive that unlocks rental and bounty revenue

2. **Agent marketplace** — list/rent/buy trained shards and team compositions
   - Escrow contract for sales, rental contract for time-limited access
   - Reputation/review system for sellers

3. **Bounty board** — permissionless task market
   - Anyone posts task + ETH escrow
   - Shards/swarms bid, winner executes, escrow releases on completion
   - Dispute resolution via keeper consensus

### Critical for Utility

4. **More tool integrations** — agents need to interact with real systems
   - GitHub (PRs, issues, code review)
   - Slack/Discord (messaging, notifications)
   - SQL databases (query, analyze)
   - REST APIs (generic HTTP tool exists, need auth/config layer)
   - Email (send reports, alerts)

5. **Persistent memory** — shards should remember past tasks and context
   - learned_context field exists but is never populated
   - RAG over past interactions and file workspace
   - Cross-session state for long-running projects

### Nice to Have

6. **Desktop app** (Tauri + Steam) — local inference, keeper node GUI
7. **3D avatars** (Three.js/R3F) — replace Canvas 2D procedural avatars
8. **Coinbase Smart Wallet** — passkey-based, gasless transactions on Base

## Target Users

| Segment | Use Case | Willingness to Pay |
|---------|----------|-------------------|
| **Solo developers** | Personal AI coding/analysis assistant that improves over time | $5–30/mo subscription |
| **Small teams** | Shared agent swarm for code review, docs, analysis | $30–100/mo |
| **Crypto natives** | Speculate on agent value, lend/borrow against agents | Lending fees + marketplace |
| **Keeper operators** | Run infrastructure, earn fees (like running a validator) | Staking + inference revenue |
| **Enterprises** | Private keeper cluster with custom agent teams | $500+/mo or custom pricing |

## Go-to-Market

1. **Launch on Base** — contracts already deployed to Sepolia, mainnet deploy is one command
2. **Free tier hooks** — bond a shard for free, hit message cap, upgrade to Trainer+ ($5/mo)
3. **Keeper flywheel** — every Keeper+ subscriber runs a node, increasing network capacity
4. **Agent marketplace** — "trained agents" as the product, not "AI platform"
5. **Steam distribution** — desktop app for non-crypto users, Steam Wallet for payments
