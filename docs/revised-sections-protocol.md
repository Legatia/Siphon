# Protocol v1.2 — Revised Sections

These sections replace the corresponding sections in siphon-protocol-v1.2.docx.

---

## REPLACE: "The Drift" section

### The Drift

The Drift is the migration pattern of Shards across the P2P network. When a Keeper releases a Shard to the wild, it enters an autonomous discovery phase, evaluating available hosts based on infrastructure compatibility.

Wild Shards are not random. Each Shard type has infrastructure preferences — an Oracle Shard performs better on a node with market data feeds and high-context models; a Cipher Shard benefits from sandboxed execution environments and security tooling. The Drift is the process by which a Shard seeks the host where it will perform best.

Wild Shards have no Owner (only Origin). When a Keeper successfully catches a wild Shard, they become its new Owner. If the catch fails, the Shard returns to its Origin Keeper.

#### Infrastructure Affinity

Shard performance is directly tied to the infrastructure backing it. A Level 30 Oracle running on a 7B quantized model with no data feeds is objectively weaker than the same Oracle on a 70B model with Bloomberg API access. This creates a natural hierarchy: better infrastructure attracts and retains better Shards.

Each Shard type has primary and secondary infrastructure preferences:

| Type | Primary Need | Secondary Need | Degrades Without |
|------|-------------|----------------|------------------|
| Oracle | Data feeds (market, weather, news APIs) | High-context model (32K+ tokens) | Prediction accuracy drops, reverts to generic pattern matching |
| Architect | Code execution environment (Docker, build tools) | Large model for system design | Cannot validate its own designs, output quality drops |
| Advocate | Uncensored model for adversarial reasoning | Debate corpora, legal databases | Becomes agreeable, loses persuasive edge |
| Cipher | Sandboxed execution (isolated container) | Security tools, vulnerability DBs | Cannot demonstrate practical security skills |
| Scribe | Large context window, RAG storage | Document processing tools | Loses ability to reference and synthesize long documents |
| Sentinel | Fact-checking APIs, knowledge bases | Fast inference for real-time verification | Verification speed and accuracy decline |
| Muse | High temperature sampling, creative model | Multimedia tools, style references | Output becomes generic and predictable |
| Mirror | Conversation history storage, long memory | Emotional analysis capabilities | Loses personalization, becomes a generic chatbot |

#### Drift Mechanics

When a wild Shard evaluates potential hosts, it scores each Keeper's advertised infrastructure against its own preferences. The scoring is deterministic (derived from the Shard's genome hash and the Keeper's manifest) so that drift paths are reproducible and not gameable.

A Shard does not automatically migrate to the highest-scoring node. It drifts probabilistically — better infrastructure increases the likelihood of a Shard appearing at your node, but does not guarantee it. This prevents whale Keepers from monopolizing all wild Shards.

---

## REPLACE: "Shard Lifecycle" section

### Shard Lifecycle

#### Birth (Breeding)

Keepers breed new Shards at their local nodes. Gen-0 Shards are spawned from the seed binary included in the Siphon Node DLC. At spawn, the Shard generates its own unique avatar based on genome hash, type, and species assignment. The breeding Keeper becomes both Origin and Owner.

A newly bred Shard's capabilities are constrained by the Keeper's infrastructure. A Keeper with a powerful GPU and relevant APIs will produce Shards that start stronger — not because of any stat bonus, but because the Shard can immediately leverage better inference and tooling during its initial calibration phase.

#### Home (Farm Life)

Shards residing at their Owner's node perform work using the Keeper's infrastructure:

**Inference:** Every Shard interaction requires LLM inference. The Keeper provides this through one of three methods:
- **Local model:** Keeper runs Ollama, llama.cpp, or similar on their own hardware. Cost = electricity. Best latency, full privacy, no per-token fees.
- **Cloud API:** Keeper connects their OpenAI, Anthropic, or other API key. Cost = per-token billing. Higher quality ceiling but ongoing cost.
- **Hybrid:** Local model for routine interactions, cloud API for complex tasks (battles, specialized work). Optimizes cost vs. quality.

**Tooling:** Beyond raw inference, Keepers can provide domain-specific tools that enhance Shard capabilities:
- Code execution sandboxes (Docker containers, isolated runtimes)
- API access (financial data, security databases, research papers)
- File system access for document-heavy tasks
- Custom LoRA adapters for fine-tuned specialization

**Economics:** Keepers bear the cost of hosting. This is offset by:
- Rental income from Trainers who bond with hosted Shards
- 25% cut of battle prizes earned by hosted Shards
- 10% origin royalty on all future activity (if they bred the Shard)
- Reputation gains that attract higher-value Shards during the Drift

A Keeper's profitability depends on the spread between hosting cost and revenue. A well-trained, frequently-rented Shard earning $50/month in bonds that costs $8/month in API calls is a profitable asset.

#### Release (Entering the Wild)

Keepers can release owned Shards into the Drift. Once released, the Shard becomes wild (Owner = none, Origin unchanged). The Shard carries its training history and memories but loses access to the releasing Keeper's infrastructure. It drifts through the P2P network, evaluating potential hosts.

Why release? Keepers release Shards they can no longer profitably host, or to create supply in the ecosystem (since Origin royalties continue generating revenue from released Shards that get captured and rented by others).

#### Capture (Luring and Taming)

Capture has two layers that work together:

**Layer 1: Infrastructure Luring**
Keepers broadcast their infrastructure manifest to the P2P network. This is not a promise — it's a verifiable advertisement of what the Keeper's node actually offers. Wild Shards evaluate these manifests against their type preferences and probabilistically drift toward compatible hosts.

A Keeper cannot attract Shards whose type requirements they cannot meet. A node with no GPU and no API key will not attract high-level Shards. A node with a powerful GPU, relevant APIs, and domain-specific tooling will attract better Shards — but is not guaranteed any specific one.

The manifest includes:
- Inference capability (model name, context window, tokens/sec benchmark)
- Available APIs and data feeds (verified by protocol challenge)
- Execution environment (sandbox type, available tools)
- Hosting track record (uptime, average Shard performance under this host)

**Layer 2: Capture Challenge**
When a wild Shard appears at a Keeper's node, the Keeper must complete a skill-based capture challenge to claim ownership. The challenge is type-specific and tests whether the Keeper can effectively work with this Shard type:

| Type | Challenge | Tests |
|------|-----------|-------|
| Oracle | Pattern recognition in noisy data | Can you interpret this Shard's analytical output? |
| Architect | System design critique | Can you evaluate and improve architectural proposals? |
| Advocate | Argument analysis | Can you identify logical structure and counter-arguments? |
| Cipher | Security vulnerability identification | Can you work with this Shard on security tasks? |
| Scribe | Precision editing | Can you direct clear, accurate documentation work? |
| Sentinel | Fact-checking under time pressure | Can you leverage verification output effectively? |
| Muse | Creative prompt crafting | Can you draw out creative capability? |
| Mirror | Emotional context reading | Can you engage with adaptive, empathetic responses? |

Challenge difficulty scales with Shard level. A Level 5 capture is straightforward; a Level 40 capture is genuinely hard. This prevents low-skill Keepers from capturing high-value Shards they cannot effectively utilize.

If capture fails, the Shard returns to its Origin Keeper. The failing Keeper receives a cooldown before they can attempt that Shard again.

#### Transfer Mechanics

When a Shard changes ownership (via capture or trade), the following data transfers to the new host:

| Component | Size | Transfer Method |
|-----------|------|-----------------|
| Genome hash + identity | 32 bytes | On-chain (already there) |
| System prompt + persona | ~2-10 KB | P2P direct transfer |
| Training history + memories | 100 KB - 50 MB | P2P direct transfer |
| LoRA adapter weights (if any) | 50-500 MB | P2P chunked transfer |
| Conversation archive | 1-100 MB | P2P direct transfer |

The new Keeper's node receives this data and begins serving the Shard using its own infrastructure. If the new Keeper has better infrastructure than the previous host, the Shard's effective performance improves immediately. If worse, it degrades.

The Shard's on-chain identity (genome hash, origin, ownership) updates via the ShardRegistry contract. The Shard's ERC-8004 agent registration is updated to point to the new host's endpoints.

#### Bonding (Trainer Access)

Keepers list Shards in the Shelter marketplace. Trainers browse available Shards and initiate bonds (rental agreements). While bonded, the Trainer interacts with the Shard through the web app.

**Who runs inference during a bonded session?**
The Keeper's node. When a Trainer sends a message to their bonded Shard, the request routes to the hosting Keeper's node, which runs inference and returns the response. The Keeper bears the inference cost; this is covered by the Trainer's rental fee.

**What if the Keeper is offline?**
Three fallback tiers, in order:
1. **Queue:** Short outages (< 1 hour) — messages queue and deliver when the Keeper comes back online. Trainer is notified of the delay.
2. **Platform relay:** Extended outages (1-24 hours) — the platform serves cached Shard state using its own inference. Quality may be slightly reduced (platform uses a standard model, not the Keeper's potentially superior setup). Inference cost is deducted from the Keeper's revenue balance.
3. **Bond pause:** Prolonged outages (> 24 hours) — the bond timer pauses. Trainer is not charged for downtime. Keeper's reputation takes a hit. After 72 hours of continuous downtime, the Trainer can break the bond without penalty.

This creates a strong incentive for Keeper uptime without punishing temporary outages.

#### Decay (Abandonment)

Shards that receive no interaction gradually lose their training quality. Phenotype degradation occurs at a rate of 1% per week of inactivity. Decay affects the Shard's fine-tuned behaviors and accumulated memories, not its base type or genome.

Visually, decaying Shards become more glitchy and unstable — their avatar reverts toward the raw, unrefined state. This is both a game signal (your Shard needs attention) and a practical reality (an unexercised model loses its edge).

Decay creates demand. A decayed Shard is cheaper to rent but less capable. A well-maintained Shard commands premium rental fees. Keepers who actively train and maintain their Shards earn more than passive holders.

If fully abandoned (100% decay), the Shard returns to its Origin Keeper with base-level capabilities. All fine-tuning and memories are lost.

---

## REPLACE: "Economy Design" section

### Economy Design

#### Cost Structure

Running the Siphon network has real costs. The economic model must ensure that revenue exceeds costs at every layer.

**Keeper costs:**
| Cost | Range | Notes |
|------|-------|-------|
| Local inference (electricity + GPU amortization) | $5-30/month | Depends on GPU and usage volume |
| Cloud API inference | $0.01-0.10/interaction | Depends on model and context length |
| Bandwidth (P2P hosting, shard transfers) | $5-15/month | Higher for popular Shards |
| Storage (training data, memories, LoRA weights) | Negligible | ~1 GB per Shard |

**Platform costs:**
| Cost | Range | Notes |
|------|-------|-------|
| Fallback inference (when Keepers offline) | Variable | Capped by platform relay limits |
| Web hosting + API servers | $500-2000/month | Scales with user count |
| On-chain transactions (Base L2) | < $0.01/tx | Base L2 fees are minimal |

#### Subscription Tiers

| Tier | Own Shards | Hosting | Inference | Limit | Cost |
|------|-----------|---------|-----------|-------|------|
| Free (Trainer) | 0 (bond only) | N/A | Keeper pays | N/A | $0 |
| Trainer+ | 3 | Platform-hosted | Platform pays | 1,000 msg/mo | $4.99/mo |
| Keeper | 10 | Self-hosted | Keeper pays | Unlimited | $9.99/mo or 100 USDC stake |
| Keeper+ | 25 | Self-hosted | Keeper pays | Unlimited | $29.99/mo or 500 USDC stake |
| Keeper Pro | 100 | Self-hosted | Keeper pays | Unlimited | $99.99/mo or 2,000 USDC stake |
| Enterprise | Unlimited | Self-hosted | Keeper pays | Unlimited | Custom |

**Inference routing by tier:**
- **Free Trainer (bonding):** Trainer interacts with bonded Shard → platform relays to Keeper's node → Keeper runs inference → response returns. The Keeper bears compute cost, offset by rental fee. If Keeper offline, platform provides fallback (cost deducted from Keeper revenue).
- **Trainer+ (platform-hosted):** Trainer interacts with owned Shard → platform runs inference using its own API keys. Capped at 1,000 messages/month. Hitting the cap is the natural push toward Keeper tier.
- **Keeper and above (self-hosted):** Keeper runs inference locally (GPU) or via own API key. Zero platform compute cost. Unlimited.

**Shard identity upkeep (anti-hoarding):**
Every owned Shard requires a monthly identity attestation (~$1.00/shard/month in $DRIP or USDC). Shards actively listed in Shelter or participating in battles receive 50-100% upkeep discount. Unpaid shards enter "unregistered" state — still functional locally but lose on-chain identity, reputation, marketplace access, battles, and evolution. This makes privately hoarding 100 shards cost $100/mo in upkeep, pushing whales toward ecosystem participation or higher tiers.

#### Revenue Streams

| Stream | Source | Model |
|--------|--------|-------|
| Trainer+ subscriptions | Platform-hosted shard ownership | $4.99/mo |
| Keeper subscriptions | Node license OR USDC stake | $9.99 - $99.99/mo |
| Shard identity upkeep | Monthly per-shard attestation fee | ~$1.00/shard/mo (discounted for active shards) |
| Shard rental fees | Trainers bonding with Keeper-hosted Shards | Set by Keeper, platform takes 5% |
| Battle entry fees | Staked battle escrow | Platform takes 5% of pot |
| Cosmetic sales | Direct purchase of visual items | $1-20 per item |
| Marketplace transaction fees | Secondary market trades (cosmetics, Shards) | 5% of transaction value |
| Battle Pass | Seasonal cosmetic rewards for active play | $9.99/season |
| OpenClaw task commission | Shards performing tasks via OpenClaw ecosystem | 5-10% of task value |

#### Revenue Distribution

| Event | Origin Keeper | Current Owner | Bonded Trainer | Platform |
|-------|--------------|---------------|----------------|----------|
| Rental fee paid | 10% royalty | 85% revenue | — | 5% |
| Staked battle win | 5% royalty | 20% cut | 70% prize | 5% |
| Cosmetic trade | — | — | — | 5% |
| Shard sale/trade | 10% royalty | 85% proceeds | — | 5% |

#### Keeper Economics Example

**Mid-tier Keeper** (Keeper tier, 8 Shards, 5 listed in Shelter):

| Item | Monthly |
|------|---------|
| **Revenue** | |
| 5 Shards rented at $15/mo average | +$75.00 |
| Battle prize cuts (20% of ~$60 in prizes) | +$12.00 |
| Origin royalties on 3 bred-and-sold Shards | +$9.00 |
| **Total Revenue** | **+$96.00** |
| **Costs** | |
| Keeper subscription | -$9.99 |
| Shard upkeep: 5 listed (free) + 3 private ($1/ea) | -$3.00 |
| Local inference (RTX 3070, ~4h/day active) | -$12.00 |
| Internet + storage overhead | -$5.00 |
| **Total Costs** | **-$29.99** |
| **Net Profit** | **+$66.01/mo** |

**Compute whale** (Keeper Pro, 80 Shards, 0 listed — all working privately):

| Item | Monthly |
|------|---------|
| **Revenue** | |
| OpenClaw task earnings (platform takes 5-10%) | Whale keeps 90-95% |
| **Costs** | |
| Keeper Pro subscription | -$99.99 |
| Shard upkeep: 80 private shards × $1.00 | -$80.00 |
| Own inference infrastructure | Whale's existing cost |
| **Total Platform Revenue from Whale** | **$179.99/mo** |

Even the non-participating whale generates significant platform revenue through subscription + upkeep. If they list even some shards in Shelter, upkeep drops and ecosystem activity increases.

The key economic insight: **the system charges for ownership, not for usage.** You can use your shards as much as you want (unlimited inference on your own hardware), but holding the on-chain identity that makes them valuable costs money. This aligns incentives — hoarding is expensive, participating is subsidized.

#### The Flywheel

```
Trainers interact with Shards (paying rental fees)
  → Interactions = training data (RLHF at scale)
    → Shards improve in capability
      → Better Shards command higher rental prices
        → Keepers invest in better infrastructure
          → Better infrastructure attracts more/better wild Shards
            → More valuable Shards attract more Trainers
              → Loop compounds
```

Every dollar spent by a Trainer simultaneously pays the Keeper AND improves the Shard. The training data is the hidden asset — Siphon accumulates a massive, type-categorized RLHF dataset as a byproduct of normal usage.
