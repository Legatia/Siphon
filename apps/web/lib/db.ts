import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: Client | null = null;
let _initialized = false;

export async function getDb(): Promise<Client> {
  if (!_client) {
    const url = process.env.TURSO_DB_URL?.trim();
    if (url) {
      _client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN ?? undefined,
      });
    } else {
      // Local dev fallback — same SQLite engine, no Turso account needed
      _client = createClient({ url: "file:./siphon.db" });
    }
  }

  if (!_initialized) {
    _initialized = true;
    await _client.executeMultiple(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
    await initSchema(_client);
    await migrateSchema(_client);
  }

  return _client;
}

// ---------------------------------------------------------------------------
// Runtime info
// ---------------------------------------------------------------------------

export function getDbRuntimeInfo(): { url: string; mode: "remote" | "local" } {
  const url = process.env.TURSO_DB_URL?.trim();
  return {
    url: url || "file:./siphon.db",
    mode: url ? "remote" : "local",
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export async function dbRun(sql: string, ...args: InValue[]): Promise<ResultSet> {
  const c = await getDb();
  return c.execute({ sql, args });
}

export async function dbGet<T = Record<string, unknown>>(
  sql: string,
  ...args: InValue[]
): Promise<T | undefined> {
  const c = await getDb();
  const rs = await c.execute({ sql, args });
  return rs.rows[0] as T | undefined;
}

export async function dbAll<T = Record<string, unknown>>(
  sql: string,
  ...args: InValue[]
): Promise<T[]> {
  const c = await getDb();
  const rs = await c.execute({ sql, args });
  return rs.rows as T[];
}

// ---------------------------------------------------------------------------
// Schema init
// ---------------------------------------------------------------------------

async function initSchema(client: Client) {
  await client.executeMultiple(`
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

// ---------------------------------------------------------------------------
// Helpers for migrations
// ---------------------------------------------------------------------------

async function hasColumn(client: Client, table: string, column: string): Promise<boolean> {
  const rs = await client.execute(`PRAGMA table_info(${table})`);
  return rs.rows.some((c: any) => c.name === column);
}

async function hasTable(client: Client, table: string): Promise<boolean> {
  const rs = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [table],
  });
  return rs.rows.length > 0;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function migrateSchema(client: Client) {
  // Migrate subscriptions table
  if (await hasTable(client, "subscriptions")) {
    if (!(await hasColumn(client, "subscriptions", "message_count")))
      await client.execute("ALTER TABLE subscriptions ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0");
    if (!(await hasColumn(client, "subscriptions", "last_message_reset")))
      await client.execute("ALTER TABLE subscriptions ADD COLUMN last_message_reset INTEGER NOT NULL DEFAULT 0");
    if (!(await hasColumn(client, "subscriptions", "stake_amount")))
      await client.execute("ALTER TABLE subscriptions ADD COLUMN stake_amount REAL NOT NULL DEFAULT 0");
    if (!(await hasColumn(client, "subscriptions", "stake_tx_hash")))
      await client.execute("ALTER TABLE subscriptions ADD COLUMN stake_tx_hash TEXT");
    if (!(await hasColumn(client, "subscriptions", "hosting_type")))
      await client.execute("ALTER TABLE subscriptions ADD COLUMN hosting_type TEXT NOT NULL DEFAULT 'none'");
  }

  if (await hasTable(client, "loans")) {
    if (!(await hasColumn(client, "loans", "cancel_tx_hash")))
      await client.execute("ALTER TABLE loans ADD COLUMN cancel_tx_hash TEXT");
  }

  // Migrate old tier names
  await client.execute("UPDATE subscriptions SET tier = 'free_trainer' WHERE tier = 'free'");
  await client.execute("UPDATE subscriptions SET tier = 'trainer_plus' WHERE tier = 'trainer'");

  // Add new columns to shards table with safe defaults
  if (!(await hasColumn(client, "shards", "decay_factor")))
    await client.execute("ALTER TABLE shards ADD COLUMN decay_factor REAL DEFAULT 1.0");
  if (!(await hasColumn(client, "shards", "last_decay_check")))
    await client.execute("ALTER TABLE shards ADD COLUMN last_decay_check INTEGER DEFAULT 0");
  if (!(await hasColumn(client, "shards", "fused_from_json")))
    await client.execute("ALTER TABLE shards ADD COLUMN fused_from_json TEXT");
  if (!(await hasColumn(client, "shards", "cosmetic_slots_json")))
    await client.execute("ALTER TABLE shards ADD COLUMN cosmetic_slots_json TEXT DEFAULT '{\"aura\":null,\"trail\":null,\"crown\":null,\"emblem\":null}'");
  if (!(await hasColumn(client, "shards", "token_id")))
    await client.execute("ALTER TABLE shards ADD COLUMN token_id TEXT");
  if (!(await hasColumn(client, "shards", "elo_rating")))
    await client.execute("ALTER TABLE shards ADD COLUMN elo_rating INTEGER DEFAULT 1200");

  if (await hasTable(client, "battles")) {
    if (!(await hasColumn(client, "battles", "finalization_tx_hash")))
      await client.execute("ALTER TABLE battles ADD COLUMN finalization_tx_hash TEXT");
  }

  // New tables
  await client.executeMultiple(`
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
      finalization_tx_hash TEXT,
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
      liquidate_tx_hash TEXT,
      cancel_tx_hash TEXT
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

    CREATE TABLE IF NOT EXISTS activation_events (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      entity_id TEXT,
      unique_key TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waitlist_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'hero',
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_subscribers(email);

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
    CREATE INDEX IF NOT EXISTS idx_activation_events_owner ON activation_events(owner_id);
    CREATE INDEX IF NOT EXISTS idx_activation_events_type ON activation_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_activation_events_created ON activation_events(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_events_unique_key ON activation_events(unique_key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_season_stats_unique ON season_stats(season_id, owner_id);
    CREATE INDEX IF NOT EXISTS idx_season_stats_points ON season_stats(season_id, points DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique ON achievements_unlocked(owner_id, achievement_key);
  `);

  if (!(await hasColumn(client, "bounties", "execution_status")))
    await client.execute("ALTER TABLE bounties ADD COLUMN execution_status TEXT");
  if (!(await hasColumn(client, "bounties", "execution_result")))
    await client.execute("ALTER TABLE bounties ADD COLUMN execution_result TEXT");
}

// ---------------------------------------------------------------------------
// Row ↔ Shard transforms (pure data — stay sync)
// ---------------------------------------------------------------------------

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
