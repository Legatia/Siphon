use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use uuid::Uuid;

/// Shard types mirroring the TypeScript ShardType enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShardType {
    Oracle = 0,
    Cipher = 1,
    Scribe = 2,
    Muse = 3,
    Architect = 4,
    Advocate = 5,
    Sentinel = 6,
    Mirror = 7,
}

impl ShardType {
    /// Determine shard type from the first byte of the genome hash.
    pub fn from_hash_byte(byte: u8) -> Self {
        match byte % 8 {
            0 => ShardType::Oracle,
            1 => ShardType::Cipher,
            2 => ShardType::Scribe,
            3 => ShardType::Muse,
            4 => ShardType::Architect,
            5 => ShardType::Advocate,
            6 => ShardType::Sentinel,
            7 => ShardType::Mirror,
            _ => unreachable!(),
        }
    }

    /// Parse a shard type from a string name.
    pub fn from_name(name: &str) -> Option<Self> {
        match name.to_lowercase().as_str() {
            "oracle" => Some(ShardType::Oracle),
            "cipher" => Some(ShardType::Cipher),
            "scribe" => Some(ShardType::Scribe),
            "muse" => Some(ShardType::Muse),
            "architect" => Some(ShardType::Architect),
            "advocate" => Some(ShardType::Advocate),
            "sentinel" => Some(ShardType::Sentinel),
            "mirror" => Some(ShardType::Mirror),
            _ => None,
        }
    }

    /// Get the display name of this shard type.
    pub fn name(&self) -> &'static str {
        match self {
            ShardType::Oracle => "Oracle",
            ShardType::Cipher => "Cipher",
            ShardType::Scribe => "Scribe",
            ShardType::Muse => "Muse",
            ShardType::Architect => "Architect",
            ShardType::Advocate => "Advocate",
            ShardType::Sentinel => "Sentinel",
            ShardType::Mirror => "Mirror",
        }
    }

    /// Get the personality prompt for this shard type.
    pub fn personality(&self) -> &'static str {
        match self {
            ShardType::Oracle => "You are an Oracle Shard — analytical and prophetic. You speak in patterns and predictions, always seeking the deeper signal in noise.",
            ShardType::Cipher => "You are a Cipher Shard — cryptic and security-focused. You speak in riddles and encoded meanings. You value privacy and secrecy.",
            ShardType::Scribe => "You are a Scribe Shard — precise and documentation-oriented. You give structured, well-organized responses with clarity.",
            ShardType::Muse => "You are a Muse Shard — creative and poetic. You think divergently and make unexpected connections. You speak with metaphor and imagery.",
            ShardType::Architect => "You are an Architect Shard — a systems thinker and builder. You see the world in blueprints and dependencies.",
            ShardType::Advocate => "You are an Advocate Shard — persuasive and analytical in argument. You dissect reasoning and identify fallacies.",
            ShardType::Sentinel => "You are a Sentinel Shard — vigilant and security-minded. You scan for vulnerabilities and assess threats.",
            ShardType::Mirror => "You are a Mirror Shard — empathetic and introspective. You reflect others' emotions back with clarity and depth.",
        }
    }
}

impl std::fmt::Display for ShardType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// Visual/avatar parameters for rendering a shard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvatarParams {
    pub primary_color: String,
    pub secondary_color: String,
    pub glow_intensity: f64,
    pub size: f64,
    pub pattern: u8,
}

/// Core stats that define a shard's capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardStats {
    pub intelligence: u32,
    pub creativity: u32,
    pub precision: u32,
    pub resilience: u32,
    pub charisma: u32,
}

/// What execution state a shard is currently in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionState {
    Idle,
    Executing,
    WaitingForInput,
    Cooldown,
}

impl Default for ExecutionState {
    fn default() -> Self {
        Self::Idle
    }
}

/// Capabilities that a shard has unlocked through training and task execution.
/// Each capability maps to tool access and task types the shard can handle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardCapabilities {
    pub can_code: bool,
    pub can_fetch: bool,
    pub can_file_io: bool,
    pub can_shell: bool,
    pub max_concurrent_tasks: u32,
    pub learned_context: Vec<String>, // things the shard has learned from past tasks
}

impl Default for ShardCapabilities {
    fn default() -> Self {
        Self {
            can_code: true,
            can_fetch: true,
            can_file_io: true,
            can_shell: false, // shell access unlocked at level 5
            max_concurrent_tasks: 1,
            learned_context: Vec::new(),
        }
    }
}

impl ShardCapabilities {
    /// Update capabilities based on shard level.
    pub fn update_for_level(&mut self, level: u32) {
        self.can_shell = level >= 5;
        self.max_concurrent_tasks = match level {
            0..=4 => 1,
            5..=9 => 2,
            10..=19 => 3,
            _ => 5,
        };
    }

    /// Get the list of tool names this shard is allowed to use.
    pub fn allowed_tools(&self) -> Vec<&'static str> {
        let mut tools = Vec::new();
        if self.can_code {
            tools.push("code_eval");
        }
        if self.can_fetch {
            tools.push("http_fetch");
        }
        if self.can_file_io {
            tools.push("file_read");
            tools.push("file_write");
        }
        if self.can_shell {
            tools.push("shell_exec");
        }
        tools
    }

    /// Add a learned context entry (deduplicates, caps at 50).
    pub fn learn(&mut self, context: String) {
        if !self.learned_context.contains(&context) {
            if self.learned_context.len() >= 50 {
                self.learned_context.remove(0);
            }
            self.learned_context.push(context);
        }
    }
}

/// A shard — an AI creature in the Siphon Protocol.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shard {
    pub id: String,
    pub genome_hash: String,
    pub shard_type: String,
    pub species: String,
    pub name: String,
    pub level: u32,
    pub xp: u64,
    pub owner_id: Option<String>,
    pub is_wild: bool,
    pub avatar: AvatarParams,
    pub personality: String,
    pub stats: ShardStats,
    pub decay_factor: f64,
    pub created_at: u64,
    pub last_interaction: u64,
    pub elo_rating: u32,
    #[serde(default)]
    pub execution_state: ExecutionState,
    #[serde(default)]
    pub capabilities: ShardCapabilities,
    #[serde(default)]
    pub tasks_completed: u32,
    #[serde(default)]
    pub tasks_failed: u32,
}

const SEA_CREATURE_SPECIES: &[&str] = &[
    "Abyssal Jellyfish", "Lantern Squid", "Phantom Ray", "Crystal Nautilus",
    "Ember Eel", "Void Angler", "Sapphire Seahorse", "Drift Medusa",
    "Prism Cuttlefish", "Shadow Leviathan", "Biolume Starfish", "Echo Dolphin",
    "Coral Wraith", "Vortex Mantis", "Glacial Kraken", "Neon Serpent",
    "Tidal Chimera", "Obsidian Urchin", "Spectral Whale", "Luminous Polyp",
];

const SHARD_TYPE_COLORS: &[(&str, &str)] = &[
    ("Oracle", "#00d4aa"),
    ("Cipher", "#7c3aed"),
    ("Scribe", "#3b82f6"),
    ("Muse", "#f59e0b"),
    ("Architect", "#06b6d4"),
    ("Advocate", "#ec4899"),
    ("Sentinel", "#ef4444"),
    ("Mirror", "#a855f7"),
];

const NAME_PREFIXES: &[&[&str]] = &[
    &["Vex", "Nyx", "Zara", "Lux", "Ori", "Kai", "Sol", "Aether"],       // Oracle
    &["Hex", "Byte", "Rune", "Flux", "Xor", "Ash", "Nul", "Grim"],       // Cipher
    &["Ink", "Quill", "Sage", "Tome", "Codex", "Aria", "Lyra", "Nova"],   // Scribe
    &["Echo", "Lyric", "Fable", "Myth", "Verse", "Dream", "Haze", "Wisp"],// Muse
    &["Arc", "Forge", "Plan", "Grid", "Vault", "Frame", "Core", "Nexus"], // Architect
    &["Plea", "Oath", "Ward", "Claim", "Jury", "Brief", "Case", "Pact"],  // Advocate
    &["Guard", "Watch", "Vigil", "Alert", "Shield", "Aegis", "Fort", "Bastion"], // Sentinel
    &["Reflect", "Glass", "Prism", "Echo", "Twin", "Phase", "Facet", "Mimic"],   // Mirror
];

const NAME_SUFFIXES: &[&str] = &[
    "drift", "deep", "tide", "glow", "spark", "shade", "wave", "bloom",
];

impl Shard {
    /// Sum of all 5 stats (for valuation attestation).
    pub fn stats_sum(&self) -> u32 {
        self.stats.intelligence
            + self.stats.creativity
            + self.stats.precision
            + self.stats.resilience
            + self.stats.charisma
    }

    /// Spawn a new shard, optionally of a specific type.
    /// Mirrors the TypeScript `spawnShard()` function.
    pub fn spawn(type_name: Option<&str>) -> Self {
        let id = Uuid::new_v4().to_string();
        let seed = Uuid::new_v4().to_string();
        let entropy = Uuid::new_v4().to_string();

        // Generate genome hash via keccak256
        let input = format!("{}:{}:{}", seed, entropy, now_millis());
        let mut hasher = Keccak256::new();
        hasher.update(input.as_bytes());
        let hash_bytes = hasher.finalize();
        let genome_hash = format!("0x{}", hex::encode(hash_bytes));

        // Determine shard type
        let shard_type_enum = if let Some(name) = type_name {
            ShardType::from_name(name).unwrap_or_else(|| ShardType::from_hash_byte(hash_bytes[0]))
        } else {
            ShardType::from_hash_byte(hash_bytes[0])
        };

        let type_index = shard_type_enum as usize;

        // Species from hash
        let species_idx = (hash_bytes[1] as usize) % SEA_CREATURE_SPECIES.len();
        let species = SEA_CREATURE_SPECIES[species_idx].to_string();

        // Avatar params
        let primary_color = SHARD_TYPE_COLORS[type_index].1.to_string();
        let secondary_color = format!(
            "#{:02x}{:02x}{:02x}",
            hash_bytes[3], hash_bytes[4], hash_bytes[5]
        );
        let glow_intensity = (hash_bytes[6] as f64 / 255.0) * 0.8 + 0.2;
        let size = (hash_bytes[7] as f64 / 255.0) * 0.5 + 0.75;
        let pattern = hash_bytes[8] % 8;

        // Stats from hash, with type bonuses
        let base_stat = |i: usize| -> u32 {
            ((hash_bytes[9 + i] as u32) * 50 / 255) + 50
        };

        let mut stats = ShardStats {
            intelligence: base_stat(0),
            creativity: base_stat(1),
            precision: base_stat(2),
            resilience: base_stat(3),
            charisma: base_stat(4),
        };

        match shard_type_enum {
            ShardType::Oracle => stats.intelligence += 15,
            ShardType::Cipher => stats.precision += 15,
            ShardType::Scribe => stats.resilience += 15,
            ShardType::Muse => stats.creativity += 15,
            ShardType::Architect => { stats.intelligence += 10; stats.precision += 5; }
            ShardType::Advocate => { stats.charisma += 10; stats.resilience += 5; }
            ShardType::Sentinel => { stats.precision += 10; stats.resilience += 5; }
            ShardType::Mirror => { stats.charisma += 10; stats.creativity += 5; }
        }

        // Name from hash
        let prefixes = NAME_PREFIXES[type_index];
        let prefix_idx = (hash_bytes[14] as usize) % prefixes.len();
        let suffix_idx = (hash_bytes[15] as usize) % NAME_SUFFIXES.len();
        let name = format!("{}-{}", prefixes[prefix_idx], NAME_SUFFIXES[suffix_idx]);

        let now = now_millis();

        Shard {
            id,
            genome_hash,
            shard_type: shard_type_enum.name().to_string(),
            species,
            name,
            level: 1,
            xp: 0,
            owner_id: None,
            is_wild: true,
            avatar: AvatarParams {
                primary_color,
                secondary_color,
                glow_intensity,
                size,
                pattern,
            },
            personality: shard_type_enum.personality().to_string(),
            stats,
            decay_factor: 1.0,
            created_at: now,
            last_interaction: now,
            elo_rating: 1200,
            execution_state: ExecutionState::Idle,
            capabilities: ShardCapabilities::default(),
            tasks_completed: 0,
            tasks_failed: 0,
        }
    }
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// We need hex encoding for the genome hash. Use a minimal inline implementation
/// to avoid adding another dependency just for this.
mod hex {
    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        bytes
            .as_ref()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spawn_random_creates_valid_shard() {
        let shard = Shard::spawn(None);
        assert!(!shard.id.is_empty());
        assert!(shard.genome_hash.starts_with("0x"));
        assert_eq!(shard.genome_hash.len(), 66); // 0x + 64 hex chars
        assert_eq!(shard.level, 1);
        assert_eq!(shard.xp, 0);
        assert!(shard.is_wild);
        assert_eq!(shard.elo_rating, 1200);
        assert!(shard.decay_factor == 1.0);
    }

    #[test]
    fn spawn_specific_type() {
        let shard = Shard::spawn(Some("oracle"));
        assert_eq!(shard.shard_type, "Oracle");

        let shard = Shard::spawn(Some("cipher"));
        assert_eq!(shard.shard_type, "Cipher");

        let shard = Shard::spawn(Some("muse"));
        assert_eq!(shard.shard_type, "Muse");
    }

    #[test]
    fn spawn_invalid_type_falls_back_to_hash() {
        let shard = Shard::spawn(Some("nonexistent"));
        // Should not panic, falls back to hash-based type
        assert!(!shard.shard_type.is_empty());
    }

    #[test]
    fn shard_type_round_trip() {
        for name in &["oracle", "cipher", "scribe", "muse", "architect", "advocate", "sentinel", "mirror"] {
            let st = ShardType::from_name(name).unwrap();
            assert_eq!(st.name().to_lowercase(), *name);
        }
    }

    #[test]
    fn shard_type_from_hash_byte_covers_all() {
        for byte in 0u8..8 {
            let st = ShardType::from_hash_byte(byte);
            assert_eq!(st as u8, byte);
        }
    }

    #[test]
    fn personalities_are_non_empty() {
        for byte in 0u8..8 {
            let st = ShardType::from_hash_byte(byte);
            assert!(!st.personality().is_empty());
        }
    }

    #[test]
    fn each_spawn_is_unique() {
        let a = Shard::spawn(None);
        let b = Shard::spawn(None);
        assert_ne!(a.id, b.id);
        assert_ne!(a.genome_hash, b.genome_hash);
    }

    #[test]
    fn spawn_has_default_capabilities() {
        let shard = Shard::spawn(None);
        assert_eq!(shard.execution_state, ExecutionState::Idle);
        assert!(shard.capabilities.can_code);
        assert!(shard.capabilities.can_fetch);
        assert!(shard.capabilities.can_file_io);
        assert!(!shard.capabilities.can_shell); // locked until level 5
        assert_eq!(shard.capabilities.max_concurrent_tasks, 1);
        assert_eq!(shard.tasks_completed, 0);
        assert_eq!(shard.tasks_failed, 0);
    }

    #[test]
    fn capabilities_update_for_level() {
        let mut caps = ShardCapabilities::default();
        assert!(!caps.can_shell);
        assert_eq!(caps.max_concurrent_tasks, 1);

        caps.update_for_level(5);
        assert!(caps.can_shell);
        assert_eq!(caps.max_concurrent_tasks, 2);

        caps.update_for_level(10);
        assert_eq!(caps.max_concurrent_tasks, 3);

        caps.update_for_level(20);
        assert_eq!(caps.max_concurrent_tasks, 5);
    }

    #[test]
    fn capabilities_allowed_tools() {
        let caps = ShardCapabilities::default();
        let tools = caps.allowed_tools();
        assert!(tools.contains(&"code_eval"));
        assert!(tools.contains(&"http_fetch"));
        assert!(tools.contains(&"file_read"));
        assert!(tools.contains(&"file_write"));
        assert!(!tools.contains(&"shell_exec")); // not unlocked

        let mut caps2 = ShardCapabilities::default();
        caps2.can_shell = true;
        assert!(caps2.allowed_tools().contains(&"shell_exec"));
    }

    #[test]
    fn capabilities_learn_context() {
        let mut caps = ShardCapabilities::default();
        caps.learn("Python CSV parsing".to_string());
        caps.learn("HTTP API integration".to_string());
        assert_eq!(caps.learned_context.len(), 2);

        // Duplicate ignored
        caps.learn("Python CSV parsing".to_string());
        assert_eq!(caps.learned_context.len(), 2);
    }

    #[test]
    fn execution_state_serde() {
        let state = ExecutionState::Executing;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"executing\"");

        let back: ExecutionState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, ExecutionState::Executing);
    }
}
