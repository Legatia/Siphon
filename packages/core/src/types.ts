export enum ShardType {
  Oracle = 0,
  Cipher = 1,
  Scribe = 2,
  Muse = 3,
  Architect = 4,
  Advocate = 5,
  Sentinel = 6,
  Mirror = 7,
}

export enum Specialization {
  None = "none",
  // Oracle branches
  Prophet = "prophet",
  Analyst = "analyst",
  // Cipher branches
  Builder = "builder",
  Auditor = "auditor",
  // Scribe branches
  Chronicler = "chronicler",
  Translator = "translator",
  // Muse branches
  Visionary = "visionary",
  Artisan = "artisan",
  // Architect branches
  Diplomat = "diplomat",
  Litigator = "litigator",
  // Advocate branches
  Breaker = "breaker",
  Warden = "warden",
  // Sentinel branches
  Verifier = "verifier",
  Watchdog = "watchdog",
  // Mirror branches
  Counselor = "counselor",
  Infiltrator = "infiltrator",
}

export enum BattleMode {
  Debate = "debate",
  Solve = "solve",
  RiddleChain = "riddle_chain",
  CreativeClash = "creative_clash",
}

export enum BattleStatus {
  Pending = "pending",
  Matching = "matching",
  Active = "active",
  Judging = "judging",
  Completed = "completed",
  Disputed = "disputed",
}

export enum SubscriptionTier {
  FreeTrainer = "free_trainer",
  TrainerPlus = "trainer_plus",
  Keeper = "keeper",
  KeeperPlus = "keeper_plus",
  KeeperPro = "keeper_pro",
  Enterprise = "enterprise",
}

export enum MessageType {
  System = "system",
  User = "user",
  Shard = "shard",
}

export enum ChallengeType {
  PatternPrediction = "pattern_prediction",
  Decode = "decode",
  Summarize = "summarize",
  CreativePrompt = "creative_prompt",
  Architecture = "architecture",
  ArgumentAnalysis = "argument_analysis",
  SecurityAudit = "security_audit",
  EmotionalInterpretation = "emotional_interpretation",
}

export interface AvatarParams {
  primaryColor: string;
  secondaryColor: string;
  glowIntensity: number;
  size: number;
  pattern: number;
}

export interface CosmeticSlots {
  aura: string | null;
  trail: string | null;
  crown: string | null;
  emblem: string | null;
}

export interface CosmeticItem {
  id: string;
  name: string;
  slot: keyof CosmeticSlots;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  previewData: string;
  price: number;
  creatorId: string | null;
  createdAt: number;
}

export interface Shard {
  id: string;
  genomeHash: string;
  type: ShardType;
  species: string;
  name: string;
  level: number;
  xp: number;
  ownerId: string | null;
  isWild: boolean;
  avatar: AvatarParams;
  specialization: Specialization;
  createdAt: number;
  lastInteraction: number;
  personality: string;
  stats: ShardStats;
  decayFactor: number;
  lastDecayCheck: number;
  fusedFrom: [string, string] | null;
  cosmeticSlots: CosmeticSlots;
  tokenId: string | null;
  eloRating: number;
}

export interface ShardStats {
  intelligence: number;
  creativity: number;
  precision: number;
  resilience: number;
  charisma: number;
}

export interface FusionRecipe {
  parentA: Shard;
  parentB: Shard;
  resultType: ShardType;
  resultStats: ShardStats;
  canFuse: boolean;
  reason?: string;
}

export interface MatchmakingEntry {
  id: string;
  shardId: string;
  ownerId: string;
  mode: BattleMode;
  eloRating: number;
  stakeAmount: number;
  joinedAt: number;
  searchRange?: number;
}

export interface KeeperNode {
  id: string;
  address: string;
  displayName: string;
  shards: string[];
  reputation: number;
  stake: number;
  joinedAt: number;
}

export interface Battle {
  id: string;
  mode: BattleMode;
  status: BattleStatus;
  challenger: BattleParticipant;
  defender: BattleParticipant;
  rounds: BattleRound[];
  winnerId: string | null;
  stakeAmount: number;
  escrowTxHash: string | null;
  settlementTxHash: string | null;
  finalizationTxHash?: string | null;
  judgeModel: string;
  createdAt: number;
  completedAt: number | null;
}

export interface BattleParticipant {
  keeperId: string;
  shardId: string;
  eloRating: number;
  eloDelta: number;
}

export interface BattleRound {
  roundNumber: number;
  prompt: string;
  challengerResponse: string;
  defenderResponse: string;
  scores: { challenger: number; defender: number };
  reasoning?: string;
  startedAt?: number;
  dueAt?: number;
  timeoutBy?: "challenger" | "defender" | "both";
}

export interface ResourceManifest {
  shardId: string;
  computeUnits: number;
  storageBytes: number;
  bandwidthKbps: number;
  uptime: number;
}

export interface CaptureChallenge {
  id: string;
  shardId: string;
  type: ChallengeType;
  prompt: string;
  expectedAnswer?: string;
  difficulty: number;
  timeLimitMs: number;
}

export interface TrainingMessage {
  id: string;
  sessionId: string;
  shardId: string;
  role: MessageType;
  content: string;
  timestamp: number;
  xpGained: number;
}

export interface DriftPosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface WildShard extends Shard {
  driftPosition: DriftPosition;
  spawnedAt: number;
}

// P2P types
export interface DHTRecord {
  key: string;
  value: Uint8Array;
  publisher: string;
  ttl: number;
}

export enum GossipTopic {
  ShardSpawn = "/siphon/shard/spawn/1.0.0",
  WildDrift = "/siphon/wild/drift/1.0.0",
  KeeperHeartbeat = "/siphon/keeper/heartbeat/1.0.0",
  BattleChallenge = "/siphon/battle/challenge/1.0.0",
}

// ERC-8004 types
export interface AgentIdentity {
  tokenId: string;
  genomeHash: string;
  owner: string;
  reputation: number;
  validationCount: number;
  mintedAt: number;
}

export interface ValidationRecord {
  tokenId: string;
  validator: string;
  result: boolean;
  evidence: string;
  timestamp: number;
}

export interface ReputationEntry {
  tokenId: string;
  delta: number;
  reason: string;
  timestamp: number;
}

// --- Loan Protocol Types ---

export enum LoanState {
  None = 0,
  Listed = 1,
  Funded = 2,
  Repaid = 3,
  Liquidated = 4,
  Cancelled = 5,
}

export interface Loan {
  id: string;
  shardId: string;
  borrower: string;
  lender: string | null;
  principal: string; // wei as string (BigInt)
  interestBps: number;
  duration: number; // seconds
  fundedAt: number | null;
  collateralValue: string; // wei as string
  state: LoanState;
  createdAt: number;
}

export interface ShardAttestation {
  shardId: string;
  level: number;
  elo: number;
  statsSum: number;
  timestamp: number;
  attestedBy: string;
}

export interface LoanListing {
  loan: Loan;
  shard: Shard;
  attestation: ShardAttestation;
  repaymentAmount: string; // wei
  isExpired: boolean;
  isLiquidatable: boolean;
}
