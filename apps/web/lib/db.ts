import Database from "better-sqlite3";
import path from "path";

const DB_PATH = resolveDbPath();

function resolveDbPath(): string {
  const explicit = process.env.SIPHON_DB_PATH;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  // Vercel/serverless filesystems are read-only except /tmp.
  if (process.env.VERCEL) {
    return "/tmp/siphon.db";
  }

  return path.join(process.cwd(), "siphon.db");
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    migrateSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shards (
      id TEXT PRIMARY KEY,
      genome_hash TEXT NOT NULL,
      type INTEGER NOT NULL,
      species TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      owner_id TEXT,
      is_wild INTEGER NOT NULL DEFAULT 1,
      avatar_json TEXT NOT NULL,
      specialization TEXT NOT NULL DEFAULT 'none',
      personality TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_interaction INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keepers (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      reputation INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      shard_id TEXT NOT NULL REFERENCES shards(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      xp_gained INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shards_owner ON shards(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shards_wild ON shards(is_wild);
    CREATE INDEX IF NOT EXISTS idx_messages_shard ON training_messages(shard_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON training_messages(session_id);
  `);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function migrateSchema(db: Database.Database) {
  // Migrate subscriptions table
  if (!hasColumn(db, "subscriptions", "message_count")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, "subscriptions", "last_message_reset")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN last_message_reset INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, "subscriptions", "stake_amount")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN stake_amount REAL NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, "subscriptions", "stake_tx_hash")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN stake_tx_hash TEXT`);
  }
  if (!hasColumn(db, "subscriptions", "hosting_type")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN hosting_type TEXT NOT NULL DEFAULT 'none'`);
  }
  // Migrate old tier names
  db.exec(`UPDATE subscriptions SET tier = 'free_trainer' WHERE tier = 'free'`);
  db.exec(`UPDATE subscriptions SET tier = 'trainer_plus' WHERE tier = 'trainer'`);

  // Add new columns to shards table with safe defaults
  if (!hasColumn(db, "shards", "decay_factor")) {
    db.exec(`ALTER TABLE shards ADD COLUMN decay_factor REAL DEFAULT 1.0`);
  }
  if (!hasColumn(db, "shards", "last_decay_check")) {
    db.exec(`ALTER TABLE shards ADD COLUMN last_decay_check INTEGER DEFAULT 0`);
  }
  if (!hasColumn(db, "shards", "fused_from_json")) {
    db.exec(`ALTER TABLE shards ADD COLUMN fused_from_json TEXT`);
  }
  if (!hasColumn(db, "shards", "cosmetic_slots_json")) {
    db.exec(`ALTER TABLE shards ADD COLUMN cosmetic_slots_json TEXT DEFAULT '{"aura":null,"trail":null,"crown":null,"emblem":null}'`);
  }
  if (!hasColumn(db, "shards", "token_id")) {
    db.exec(`ALTER TABLE shards ADD COLUMN token_id TEXT`);
  }
  if (!hasColumn(db, "shards", "elo_rating")) {
    db.exec(`ALTER TABLE shards ADD COLUMN elo_rating INTEGER DEFAULT 1200`);
  }

  // New tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS battles (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      challenger_json TEXT NOT NULL,
      defender_json TEXT NOT NULL,
      rounds_json TEXT NOT NULL DEFAULT '[]',
      winner_id TEXT,
      stake_amount REAL NOT NULL DEFAULT 0,
      escrow_tx_hash TEXT,
      settlement_tx_hash TEXT,
      judge_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS matchmaking_queue (
      id TEXT PRIMARY KEY,
      shard_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      elo_rating INTEGER NOT NULL DEFAULT 1200,
      stake_amount REAL NOT NULL DEFAULT 0,
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cosmetics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slot TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common',
      description TEXT NOT NULL,
      preview_data TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      creator_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cosmetic_inventory (
      id TEXT PRIMARY KEY,
      cosmetic_id TEXT NOT NULL REFERENCES cosmetics(id),
      owner_id TEXT NOT NULL,
      purchased_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free_trainer',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      current_period_end INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_reset INTEGER NOT NULL DEFAULT 0,
      stake_amount REAL NOT NULL DEFAULT 0,
      stake_tx_hash TEXT,
      hosting_type TEXT NOT NULL DEFAULT 'none',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stake_payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      tx_hash TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_stake_user ON stake_payments(user_id);

    CREATE TABLE IF NOT EXISTS keeper_nodes (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      peer_id TEXT,
      stake_amount REAL NOT NULL DEFAULT 0,
      hosted_shard_count INTEGER NOT NULL DEFAULT 0,
      last_heartbeat INTEGER,
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shard_hosting (
      id TEXT PRIMARY KEY,
      shard_id TEXT NOT NULL REFERENCES shards(id),
      keeper_id TEXT NOT NULL REFERENCES keeper_nodes(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      shard_id TEXT NOT NULL REFERENCES shards(id),
      borrower TEXT NOT NULL,
      lender TEXT,
      principal TEXT NOT NULL,
      interest_bps INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      funded_at INTEGER,
      collateral_value TEXT NOT NULL,
      state INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      tx_hash TEXT,
      fund_tx_hash TEXT,
      repay_tx_hash TEXT,
      liquidate_tx_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower);
    CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender);
    CREATE INDEX IF NOT EXISTS idx_loans_state ON loans(state);
    CREATE INDEX IF NOT EXISTS idx_loans_shard ON loans(shard_id);

    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      bounty_id_hex TEXT NOT NULL,
      poster TEXT NOT NULL,
      claimant TEXT,
      shard_or_swarm_id TEXT,
      reward TEXT NOT NULL,
      description TEXT NOT NULL,
      deadline INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'Open',
      execution_status TEXT,
      execution_result TEXT,
      tx_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capture_sessions (
      id TEXT PRIMARY KEY,
      shard_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      challenge_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      shard_id TEXT NOT NULL,
      seller TEXT NOT NULL,
      price TEXT NOT NULL,
      shard_name TEXT,
      shard_species TEXT,
      state TEXT NOT NULL DEFAULT 'active',
      tx_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ranked_seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS season_stats (
      id TEXT PRIMARY KEY,
      season_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      elo_delta INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements_unlocked (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      achievement_key TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      meta_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
    CREATE INDEX IF NOT EXISTS idx_matchmaking_mode ON matchmaking_queue(mode);
    CREATE INDEX IF NOT EXISTS idx_cosmetic_inv_owner ON cosmetic_inventory(owner_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_bounties_state ON bounties(state);
    CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster);
    CREATE INDEX IF NOT EXISTS idx_capture_sessions_owner ON capture_sessions(owner_id);
    CREATE INDEX IF NOT EXISTS idx_capture_sessions_shard ON capture_sessions(shard_id);
    CREATE INDEX IF NOT EXISTS idx_marketplace_state ON marketplace_listings(state);
    CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace_listings(seller);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_season_stats_unique ON season_stats(season_id, owner_id);
    CREATE INDEX IF NOT EXISTS idx_season_stats_points ON season_stats(season_id, points DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique ON achievements_unlocked(owner_id, achievement_key);
  `);

  if (!hasColumn(db, "bounties", "execution_status")) {
    db.exec(`ALTER TABLE bounties ADD COLUMN execution_status TEXT`);
  }
  if (!hasColumn(db, "bounties", "execution_result")) {
    db.exec(`ALTER TABLE bounties ADD COLUMN execution_result TEXT`);
  }
}

export function shardToRow(shard: import("@siphon/core").Shard) {
  return {
    id: shard.id,
    genome_hash: shard.genomeHash,
    type: shard.type,
    species: shard.species,
    name: shard.name,
    level: shard.level,
    xp: shard.xp,
    owner_id: shard.ownerId,
    is_wild: shard.isWild ? 1 : 0,
    avatar_json: JSON.stringify(shard.avatar),
    specialization: shard.specialization,
    personality: shard.personality,
    stats_json: JSON.stringify(shard.stats),
    created_at: shard.createdAt,
    last_interaction: shard.lastInteraction,
    decay_factor: shard.decayFactor,
    last_decay_check: shard.lastDecayCheck,
    fused_from_json: shard.fusedFrom ? JSON.stringify(shard.fusedFrom) : null,
    cosmetic_slots_json: JSON.stringify(shard.cosmeticSlots),
    token_id: shard.tokenId,
    elo_rating: shard.eloRating,
  };
}

export function rowToShard(row: any): import("@siphon/core").Shard {
  return {
    id: row.id,
    genomeHash: row.genome_hash,
    type: row.type,
    species: row.species,
    name: row.name,
    level: row.level,
    xp: row.xp,
    ownerId: row.owner_id,
    isWild: row.is_wild === 1,
    avatar: JSON.parse(row.avatar_json),
    specialization: row.specialization,
    personality: row.personality,
    stats: JSON.parse(row.stats_json),
    createdAt: row.created_at,
    lastInteraction: row.last_interaction,
    decayFactor: row.decay_factor ?? 1.0,
    lastDecayCheck: row.last_decay_check ?? 0,
    fusedFrom: row.fused_from_json ? JSON.parse(row.fused_from_json) : null,
    cosmeticSlots: row.cosmetic_slots_json
      ? JSON.parse(row.cosmetic_slots_json)
      : { aura: null, trail: null, crown: null, emblem: null },
    tokenId: row.token_id ?? null,
    eloRating: row.elo_rating ?? 1200,
  };
}
