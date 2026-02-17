# Tech Spec v2 — Revised Sections

These sections replace the corresponding sections in siphon-tech-spec-v2.docx.

---

## REPLACE: "2.4 Resource Manifest (Luring)" section

### 2.4 Infrastructure Manifest

The Infrastructure Manifest is a verifiable advertisement of a Keeper node's capabilities. Unlike the previous ResourceManifest design, this manifest is partially validated by the protocol — Keepers cannot claim resources they don't have.

```typescript
interface InfrastructureManifest {
  // Inference capability (verified by benchmark challenge)
  inference: {
    method: "local" | "cloud" | "hybrid";

    // Local inference (if method is "local" or "hybrid")
    local?: {
      modelName: string;           // e.g. "llama3-70b-q5"
      contextWindow: number;       // Max tokens
      tokensPerSecond: number;     // Measured benchmark
      vramGB: number;              // Available GPU VRAM
      gpuModel: string;            // e.g. "RTX 4090"
    };

    // Cloud inference (if method is "cloud" or "hybrid")
    cloud?: {
      provider: string;            // "openai" | "anthropic" | "custom"
      model: string;               // e.g. "gpt-4o" | "claude-sonnet-4-5-20250929"
      contextWindow: number;
      budgetPerMonth: number;      // USD, self-reported
    };
  };

  // Execution environment
  execution: {
    sandbox: "none" | "docker" | "firecracker" | "wasm";
    codeExecution: boolean;        // Can run code
    fileSystem: boolean;           // Sandboxed FS access
    networkAccess: string[];       // Allowed outbound domains
  };

  // Domain-specific tooling
  tooling: {
    apis: APIEndpoint[];           // Available API integrations
    datasets: DatasetDescriptor[]; // Available training data
    customTools: ToolDescriptor[]; // Custom tool integrations
  };

  // Hosting track record (protocol-verified)
  reputation: {
    uptimePercent: number;         // Rolling 30-day average
    averageResponseMs: number;     // Inference latency
    shardsHosted: number;          // Currently hosting
    totalInteractions: number;     // Lifetime
    slashEvents: number;           // Times slashed
  };

  // Preferences
  preferences: {
    acceptedTypes: ShardType[];    // Types willing to host
    minLevel: number;              // Minimum Shard level
    maxShards: number;             // Capacity limit
    rentalPriceRange: [number, number]; // Min/max monthly rate
  };
}

interface APIEndpoint {
  name: string;                    // e.g. "bloomberg-market-data"
  domain: string;                  // e.g. "api.bloomberg.com"
  category: "finance" | "security" | "research" | "code" | "general";
  verified: boolean;               // Protocol has verified access
}

interface DatasetDescriptor {
  name: string;
  sizeGB: number;
  category: string;
  lastUpdated: number;             // Timestamp
}

interface ToolDescriptor {
  name: string;                    // e.g. "github-copilot"
  type: "ide" | "analysis" | "monitoring" | "custom";
  description: string;
}
```

#### Manifest Verification

Keepers cannot freely claim arbitrary capabilities. The protocol uses three verification methods:

1. **Inference benchmark:** On registration and periodically (every 24h), the protocol sends a standard inference challenge. The Keeper's node must respond within timing thresholds consistent with their claimed model and hardware. Claiming "RTX 4090 + llama3-70b" but responding at speeds consistent with a CPU-only 7B model fails verification.

2. **API spot-checks:** For claimed API integrations, the protocol periodically sends a type-appropriate query that requires the API to answer correctly. Claiming "Bloomberg access" without actually having it fails when the protocol asks for a specific real-time data point.

3. **Uptime monitoring:** The DHT heartbeat system tracks actual uptime. Claimed uptime is overwritten with measured uptime. No self-reporting.

Unverified claims are displayed as "unverified" in the Shelter marketplace. Verified manifests receive a trust badge that increases Shard attraction probability.

---

## REPLACE: "3.2 DHT Record Types" section

### 3.2 DHT Record Types

The DHT stores the following record types:

```
// Shard Location Record
/siphon/shard/{shardId} -> {
  nodeId: bytes32,           // Current host
  status: "owned" | "wild" | "bonded",
  shardType: uint8,          // For type-based queries
  level: uint16,             // Current level
  hostInference: string,     // Model backing this shard (e.g. "llama3-70b")
  lastUpdate: uint256,
  signature: bytes           // Signed by host
}

// Node Infrastructure Record
/siphon/node/{nodeId} -> {
  multiaddrs: string[],
  manifest: InfrastructureManifest,   // Full capability advertisement
  hostedShards: bytes32[],            // Currently hosting
  availableSlots: uint8,              // Capacity for more
  lastHeartbeat: uint256,
  signature: bytes
}

// Wild Shard Seeking Record
// Published by wild shards actively seeking a host
/siphon/wild/{shardType}/{affinityHash} -> {
  shardId: bytes32,
  shardType: uint8,
  level: uint16,
  requirements: InfrastructureRequirements,  // What this shard needs
  originNode: bytes32,                        // Fallback host
  driftStarted: uint256,
  ttl: uint256,              // Expires if not captured
  signature: bytes
}
```

```typescript
// Infrastructure requirements — what a shard needs from its host
interface InfrastructureRequirements {
  // Minimum inference quality
  minContextWindow: number;       // Tokens
  minTokensPerSecond: number;     // Speed floor
  preferredModelSize: "small" | "medium" | "large";  // 7B / 13-30B / 70B+

  // Type-specific needs (at least one must be met)
  requiredAPIs: string[];          // e.g. ["finance-data"] for Oracle
  requiredExecution: boolean;      // Needs code sandbox
  requiredTools: string[];         // e.g. ["security-scanner"] for Cipher

  // Soft preferences (improve affinity score but not required)
  preferredAPIs: string[];
  preferredDatasets: string[];
}
```

#### Shard Infrastructure Requirements by Type and Level

Requirements scale with level. A Level 5 Shard can run on minimal infrastructure. A Level 40+ Shard needs serious resources.

```typescript
function getShardRequirements(type: ShardType, level: number): InfrastructureRequirements {
  const base: InfrastructureRequirements = {
    minContextWindow: level < 10 ? 4096 : level < 30 ? 16384 : 32768,
    minTokensPerSecond: level < 20 ? 10 : 30,
    preferredModelSize: level < 10 ? "small" : level < 30 ? "medium" : "large",
    requiredAPIs: [],
    requiredExecution: false,
    requiredTools: [],
    preferredAPIs: [],
    preferredDatasets: [],
  };

  switch (type) {
    case ShardType.ORACLE:
      if (level >= 15) base.requiredAPIs = ["data-feed"];
      base.preferredAPIs = ["finance-data", "news-api", "weather-api"];
      base.preferredDatasets = ["time-series", "market-history"];
      break;

    case ShardType.ARCHITECT:
      if (level >= 15) base.requiredExecution = true;
      base.preferredTools = ["code-runner", "build-tools", "diagramming"];
      break;

    case ShardType.CIPHER:
      if (level >= 10) base.requiredExecution = true;
      if (level >= 20) base.requiredTools = ["security-scanner"];
      base.preferredAPIs = ["vulnerability-db", "cve-feed"];
      break;

    case ShardType.ADVOCATE:
      base.preferredDatasets = ["legal-corpus", "debate-transcripts"];
      base.preferredAPIs = ["research-papers"];
      break;

    case ShardType.SCRIBE:
      base.minContextWindow = level < 10 ? 8192 : level < 30 ? 32768 : 65536;
      base.preferredTools = ["document-processor", "rag-engine"];
      break;

    case ShardType.SENTINEL:
      base.preferredAPIs = ["fact-check-api", "knowledge-base"];
      base.minTokensPerSecond = level < 20 ? 20 : 50;  // Needs fast responses
      break;

    case ShardType.MUSE:
      base.preferredTools = ["image-gen", "style-reference"];
      // Muse benefits from less restricted models
      break;

    case ShardType.MIRROR:
      base.minContextWindow = level < 10 ? 8192 : level < 30 ? 32768 : 65536;
      // Mirror needs long memory for personalization
      base.preferredTools = ["sentiment-analysis"];
      break;
  }

  return base;
}
```

---

## REPLACE: "3.4 Drift Protocol" section

### 3.4 Drift Protocol

When a Shard is released to the wild, the following sequence occurs:

```
Phase 1: Announcement
  1. Origin Keeper broadcasts SHARD_DRIFT_ANNOUNCE to /siphon/drift/{shardType}
     Payload: shardId, type, level, requirements (InfrastructureRequirements)
  2. Shard's Wild Seeking Record is published to DHT
     Key: /siphon/wild/{shardType}/{affinityHash}
  3. TTL starts (default: 7 days). If not captured, returns to Origin.

Phase 2: Infrastructure Matching
  4. Interested Keepers evaluate their own manifest against the Shard's requirements
  5. Eligible Keepers respond with LURE_MANIFEST containing their InfrastructureManifest
  6. Protocol validates lure claims against known node reputation data
  7. Invalid or unverified lures are flagged (visible to Shard but lower priority)

Phase 3: Affinity Scoring
  8. Each lure receives an affinity score computed deterministically:

     affinityScore = (
       inferenceScore(manifest, requirements) * 0.4 +     // Model quality match
       toolingScore(manifest, requirements) * 0.3 +        // API/tool availability
       reputationScore(manifest) * 0.2 +                   // Uptime, track record
       randomSeed(shardGenome, nodeId) * 0.1               // Deterministic noise
     )

  9. Shard drifts toward highest-scoring node with probability proportional
     to score (softmax distribution). This prevents monopolization —
     the best node is most likely but not guaranteed.

Phase 4: Capture Challenge
  10. Shard arrives at selected node. Keeper receives notification.
  11. Keeper initiates capture by solving a type-specific challenge.
      Challenge difficulty = f(shardLevel):
        Level 1-10:   Easy (basic type knowledge)
        Level 11-20:  Medium (practical application)
        Level 21-40:  Hard (expert-level task)
        Level 41+:    Very Hard (domain mastery required)
  12. Keeper submits solution. Protocol evaluates.

Phase 5: Transfer
  13. On success:
      a. Shard data package transfers P2P (system prompt, memories, LoRA weights)
      b. New Keeper's node loads shard and begins serving inference
      c. ShardRegistry.transferOwnership() called on-chain
      d. ERC-8004 registration updated with new host endpoints
      e. DHT location record updated
      f. Origin Keeper receives transfer notification

  14. On failure:
      a. Shard returns to Origin Keeper (or next-highest-scoring node)
      b. Failing Keeper receives 24h cooldown for this specific Shard
      c. Failure is recorded (affects Keeper reputation for capture success rate)
```

#### Shard Data Transfer Protocol

When ownership transfers, the shard's portable state must move from the old host to the new one. This is the physical "what transfers" spec:

```typescript
interface ShardTransferPackage {
  // Identity (already on-chain, included for convenience)
  identity: {
    shardId: bytes32;
    genomeHash: bytes32;
    shardType: ShardType;
    generation: uint8;
    origin: address;
  };

  // Persona (what makes this shard behave like itself)
  persona: {
    systemPrompt: string;          // Type-specific base prompt (~2-5 KB)
    personalityWeights: number[];  // Learned personality adjustments
    specialization: Specialization | null;
    specializationPrompt: string | null;  // Additional prompt for specialization
  };

  // Training state (accumulated knowledge)
  training: {
    level: number;
    experience: number;
    stats: ShardStats;             // str, int, wis, cha, spd, res
    decayFactor: number;
    lastInteraction: number;
    trainingCheckpoints: string[]; // Merkle roots of training history
  };

  // Memory (conversation history and learned context)
  memory: {
    shortTermMemory: Message[];    // Recent conversation buffer (~100 messages)
    longTermMemory: MemoryEntry[]; // Extracted key learnings, summarized
    ragDocuments: Document[];      // Stored reference documents
    totalSizeBytes: number;
  };

  // Model adaptation (if keeper used local fine-tuning)
  adaptation: {
    hasLoRA: boolean;
    loraAdapter?: {
      baseModel: string;           // Which base model this adapts
      adapterWeights: Uint8Array;  // LoRA weight delta (~50-500 MB)
      trainingEpochs: number;
      datasetSize: number;
    };
  };

  // Metadata
  metadata: {
    name: string;
    avatarSeed: bytes32;           // For avatar regeneration
    cosmeticSlots: CosmeticSlots;
    battleRecord: { wins: number; losses: number; draws: number };
    eloRating: number;
  };

  // Transfer verification
  verification: {
    packageHash: bytes32;          // Hash of entire package
    previousOwnerSignature: bytes; // Proves legitimate transfer
    timestamp: number;
  };
}
```

Transfer size ranges:
- Minimal (new shard, no training): ~10 KB
- Typical (Level 20, moderate training): ~1-5 MB
- Heavy (Level 40+, LoRA adapter, extensive memory): ~100-500 MB
- Maximum (Level 50+, large LoRA, full conversation archive): ~1 GB

Large transfers use chunked P2P streaming with resume capability. The new host can begin serving the shard with just the persona + short-term memory (fast transfer), then load the full package in the background.

---

## REPLACE: "3.3 Message Types" — add new message types

### 3.3 Message Types (Updated)

```typescript
enum MessageType {
  // Drift
  SHARD_DRIFT_ANNOUNCE    = 0x01,  // "I'm releasing a shard to the wild"
  SHARD_DRIFT_REQUEST     = 0x02,  // "Shard wants to drift to your node"
  SHARD_DRIFT_ACCEPT      = 0x03,  // "I accept this shard"
  SHARD_DRIFT_REJECT      = 0x04,  // "I reject (at capacity / don't meet requirements)"

  // Luring
  LURE_MANIFEST           = 0x10,  // "Here's what my node offers" (InfrastructureManifest)
  LURE_VERIFY_CHALLENGE   = 0x11,  // "Prove you have this API/resource"
  LURE_VERIFY_RESPONSE    = 0x12,  // "Here's proof" (API response, benchmark result)

  // Capture
  CAPTURE_CHALLENGE       = 0x20,  // "Solve this to capture the shard"
  CAPTURE_RESPONSE        = 0x21,  // "Here's my solution"
  CAPTURE_RESULT          = 0x22,  // "Success/failure"

  // Transfer
  TRANSFER_INITIATE       = 0x30,  // "Begin shard data transfer"
  TRANSFER_CHUNK          = 0x31,  // "Here's a chunk of shard data"
  TRANSFER_COMPLETE       = 0x32,  // "Transfer finished, verify hash"
  TRANSFER_VERIFY         = 0x33,  // "Hash verified, shard loaded"

  // Training (Trainer ↔ Keeper relay)
  TRAINING_SESSION_START  = 0x40,  // "Trainer wants to interact with bonded shard"
  TRAINING_INTERACTION    = 0x41,  // "Message from trainer to shard"
  TRAINING_RESPONSE       = 0x42,  // "Response from shard to trainer"
  TRAINING_SESSION_END    = 0x43,  // "Session over"

  // Battle
  BATTLE_CHALLENGE        = 0x50,  // "I challenge your shard"
  BATTLE_ACCEPT           = 0x51,  // "Challenge accepted"
  BATTLE_PROMPT           = 0x52,  // "Here's the round prompt"
  BATTLE_SUBMISSION       = 0x53,  // "Here's my shard's response"
  BATTLE_JUDGMENT         = 0x54,  // "Here are the scores"
  BATTLE_RESULT           = 0x55,  // "Final result + elo changes"

  // Keeper
  KEEPER_HEARTBEAT        = 0x60,  // Periodic "I'm alive" with basic stats
  KEEPER_MANIFEST_UPDATE  = 0x61,  // "My infrastructure changed"
}
```

---

## NEW SECTION: Insert after "3.4 Drift Protocol"

### 3.5 Inference Routing

When a Trainer interacts with a bonded Shard through the web app, the request must reach the Keeper's node for inference. This section specifies how that routing works.

#### Primary Path: Direct to Keeper

```
Trainer (browser)
  → WebSocket to Platform API
    → Platform identifies hosting Keeper from DHT
      → Platform relays request to Keeper node (P2P stream)
        → Keeper runs inference (local model or cloud API)
          → Response returns via same path
```

Latency: 200-2000ms depending on Keeper's inference speed.

#### Fallback Path: Platform Relay

If the Keeper's node is unreachable:

```
Trainer (browser)
  → WebSocket to Platform API
    → Platform detects Keeper offline (heartbeat stale > 5 min)
      → Platform loads shard's cached state (system prompt + recent memory)
        → Platform runs inference using its own model
          → Response returned to Trainer with "relay mode" indicator
```

Platform relay uses a standard model (e.g., GPT-4o or Claude Sonnet). Quality may differ from the Keeper's setup. The Trainer sees a subtle indicator that the shard is in "relay mode."

Relay costs are tracked and deducted from the Keeper's pending revenue balance. If the Keeper's balance reaches zero, the shard goes into "hibernation" (unavailable for bonding) until the Keeper comes back online or tops up their balance.

#### Desktop Path: Direct Local

For Keepers using the desktop app to interact with their own Shards:

```
Keeper (desktop app)
  → Tauri IPC to Rust backend
    → Local inference engine (Ollama / llama.cpp)
      → Response returned directly
```

No network round-trip. Fastest possible path. Works fully offline.

---

## NEW SECTION: Insert after Security Model

### 7.4 Inference Integrity

Since Keepers run inference for Shards, a malicious Keeper could tamper with responses — making a Shard appear more capable than it is, or sabotaging a rival's Shard during battles.

#### Battle Integrity

For staked battles, inference integrity is critical. The protocol uses the following safeguards:

1. **Dual execution:** Both Shards receive the same prompt. Each Keeper runs inference independently. Neither sees the other's response before submission.

2. **Commitment scheme:** Keepers submit a hash of their Shard's response before the reveal phase. After both commitments are in, both responses are revealed. This prevents copying or last-second modifications.

3. **Judge isolation:** The battle judge (LLM evaluator) runs on the platform's infrastructure, not on either Keeper's node. Neither participant controls the judge.

4. **Deterministic replay:** For disputed battles, the platform can re-run both prompts against the Shards' cached state to verify responses are consistent with claimed capabilities.

#### Training Integrity

For bonded training sessions, the Trainer relies on the Keeper's inference being honest. A Keeper could theoretically run a weaker model than advertised and pocket the difference.

Mitigation:
- Trainers can rate session quality. Low ratings affect Keeper reputation.
- The platform periodically runs "shadow evaluations" — sending the same prompt to both the Keeper's node and the platform's own inference, comparing response quality.
- Persistent quality mismatches trigger manifest verification challenges.
