use rusqlite::{Connection, Result as SqliteResult, params};
use std::path::Path;

use crate::shard::Shard;

/// Get the path to the SQLite database file within the data directory.
fn db_path(data_dir: &str) -> String {
    let expanded = shellexpand(data_dir);
    let dir = Path::new(&expanded);
    dir.join("keeper.db").to_string_lossy().to_string()
}

/// Open a connection to the keeper database.
fn open_db(data_dir: &str) -> SqliteResult<Connection> {
    let path = db_path(data_dir);
    Connection::open(&path)
}

/// Initialize the database, creating tables if they don't exist.
pub fn init_db(data_dir: &str) -> SqliteResult<()> {
    let expanded = shellexpand(data_dir);
    std::fs::create_dir_all(&expanded).ok();

    let conn = open_db(data_dir)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS shards (
            id TEXT PRIMARY KEY,
            genome_hash TEXT NOT NULL,
            shard_type TEXT NOT NULL,
            species TEXT NOT NULL,
            name TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            xp INTEGER NOT NULL DEFAULT 0,
            owner_id TEXT,
            is_wild INTEGER NOT NULL DEFAULT 1,
            avatar_json TEXT NOT NULL,
            personality TEXT NOT NULL,
            stats_json TEXT NOT NULL,
            decay_factor REAL NOT NULL DEFAULT 1.0,
            created_at INTEGER NOT NULL,
            last_interaction INTEGER NOT NULL,
            elo_rating INTEGER NOT NULL DEFAULT 1200,
            execution_state TEXT NOT NULL DEFAULT 'idle',
            capabilities_json TEXT NOT NULL DEFAULT '{}',
            tasks_completed INTEGER NOT NULL DEFAULT 0,
            tasks_failed INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shard_id TEXT NOT NULL REFERENCES shards(id),
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            xp_gained INTEGER NOT NULL DEFAULT 0,
            timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS keeper_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS action_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shard_id TEXT NOT NULL REFERENCES shards(id),
            task_description TEXT NOT NULL,
            tool_name TEXT,
            tool_input TEXT,
            tool_output TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            xp_awarded INTEGER NOT NULL DEFAULT 0,
            stat_bonuses TEXT,
            started_at INTEGER NOT NULL,
            completed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS tracked_loans (
            loan_id TEXT PRIMARY KEY,
            state TEXT NOT NULL DEFAULT 'Funded',
            added_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shard_id TEXT NOT NULL REFERENCES shards(id),
            action_id INTEGER NOT NULL REFERENCES action_log(id),
            task_type TEXT NOT NULL,
            goal TEXT NOT NULL,
            approach TEXT NOT NULL,
            tools_used_json TEXT NOT NULL,
            outcome TEXT NOT NULL,
            errors_json TEXT NOT NULL,
            fixes_json TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            success INTEGER NOT NULL DEFAULT 0,
            extractor_confidence REAL NOT NULL,
            applicability_confidence REAL NOT NULL,
            reusability REAL NOT NULL,
            score REAL NOT NULL DEFAULT 0.5,
            artifact_path TEXT NOT NULL,
            times_retrieved INTEGER NOT NULL DEFAULT 0,
            times_helpful INTEGER NOT NULL DEFAULT 0,
            times_unhelpful INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lesson_retrieval_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shard_id TEXT NOT NULL REFERENCES shards(id),
            action_id INTEGER NOT NULL REFERENCES action_log(id),
            task TEXT NOT NULL,
            task_type TEXT NOT NULL,
            lesson_ids_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER,
            success INTEGER,
            duration_ms INTEGER,
            latency_delta_ms INTEGER,
            helpful INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_shards_type ON shards(shard_type);
        CREATE INDEX IF NOT EXISTS idx_shards_wild ON shards(is_wild);
        CREATE INDEX IF NOT EXISTS idx_interactions_shard ON interactions(shard_id);
        CREATE INDEX IF NOT EXISTS idx_action_log_shard ON action_log(shard_id);
        CREATE INDEX IF NOT EXISTS idx_action_log_status ON action_log(status);
        CREATE INDEX IF NOT EXISTS idx_tracked_loans_state ON tracked_loans(state);
        CREATE INDEX IF NOT EXISTS idx_task_lessons_shard_created ON task_lessons(shard_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_task_lessons_shard_type ON task_lessons(shard_id, task_type);
        CREATE INDEX IF NOT EXISTS idx_task_lessons_score ON task_lessons(score DESC);
        CREATE INDEX IF NOT EXISTS idx_lesson_retrieval_events_shard_created ON lesson_retrieval_events(shard_id, created_at DESC);
        ",
    )?;

    // Backward-compatible migrations for older local DBs.
    ensure_column_exists(
        &conn,
        "shards",
        "execution_state",
        "TEXT NOT NULL DEFAULT 'idle'",
    )?;
    ensure_column_exists(
        &conn,
        "shards",
        "capabilities_json",
        "TEXT NOT NULL DEFAULT '{}'",
    )?;
    ensure_column_exists(
        &conn,
        "shards",
        "tasks_completed",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column_exists(
        &conn,
        "shards",
        "tasks_failed",
        "INTEGER NOT NULL DEFAULT 0",
    )?;

    tracing::info!("Database initialized at {}", db_path(data_dir));
    Ok(())
}

fn ensure_column_exists(
    conn: &Connection,
    table: &str,
    column: &str,
    definition_sql: &str,
) -> SqliteResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<SqliteResult<Vec<_>>>()?;
    if !columns.iter().any(|c| c == column) {
        conn.execute(
            &format!(
                "ALTER TABLE {} ADD COLUMN {} {}",
                table, column, definition_sql
            ),
            [],
        )?;
    }
    Ok(())
}

/// Insert a new shard into the database.
pub fn insert_shard(data_dir: &str, shard: &Shard) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;

    let avatar_json = serde_json::to_string(&shard.avatar).unwrap_or_default();
    let stats_json = serde_json::to_string(&shard.stats).unwrap_or_default();

    let capabilities_json = serde_json::to_string(&shard.capabilities).unwrap_or_default();
    let exec_state = serde_json::to_string(&shard.execution_state)
        .unwrap_or_else(|_| "\"idle\"".to_string())
        .trim_matches('"')
        .to_string();

    conn.execute(
        "INSERT INTO shards (
            id, genome_hash, shard_type, species, name, level, xp,
            owner_id, is_wild, avatar_json, personality, stats_json,
            decay_factor, created_at, last_interaction, elo_rating,
            execution_state, capabilities_json, tasks_completed, tasks_failed
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
        params![
            shard.id,
            shard.genome_hash,
            shard.shard_type,
            shard.species,
            shard.name,
            shard.level,
            shard.xp,
            shard.owner_id,
            shard.is_wild as i32,
            avatar_json,
            shard.personality,
            stats_json,
            shard.decay_factor,
            shard.created_at,
            shard.last_interaction,
            shard.elo_rating,
            exec_state,
            capabilities_json,
            shard.tasks_completed,
            shard.tasks_failed,
        ],
    )?;

    tracing::debug!("Inserted shard {} into database", &shard.id[..8]);
    Ok(())
}

/// Get all shards from the database.
pub fn get_shards(data_dir: &str) -> SqliteResult<Vec<Shard>> {
    let conn = open_db(data_dir)?;

    let mut stmt = conn.prepare(
        "SELECT id, genome_hash, shard_type, species, name, level, xp,
                owner_id, is_wild, avatar_json, personality, stats_json,
                decay_factor, created_at, last_interaction, elo_rating,
                execution_state, capabilities_json, tasks_completed, tasks_failed
         FROM shards
         ORDER BY created_at DESC",
    )?;

    let shards = stmt
        .query_map([], |row| {
            Ok(row_to_shard(row)?)
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(shards)
}

/// Parse a shard from a database row (shared between get_shards and get_shard_by_id).
fn row_to_shard(row: &rusqlite::Row) -> SqliteResult<Shard> {
    let avatar_json: String = row.get(9)?;
    let stats_json: String = row.get(11)?;
    let is_wild_int: i32 = row.get(8)?;

    let avatar = serde_json::from_str(&avatar_json).unwrap_or(crate::shard::AvatarParams {
        primary_color: "#00d4aa".to_string(),
        secondary_color: "#ffffff".to_string(),
        glow_intensity: 0.5,
        size: 1.0,
        pattern: 0,
    });

    let stats = serde_json::from_str(&stats_json).unwrap_or(crate::shard::ShardStats {
        intelligence: 50,
        creativity: 50,
        precision: 50,
        resilience: 50,
        charisma: 50,
    });

    let exec_state_str: String = row.get(16)?;
    let execution_state = match exec_state_str.as_str() {
        "executing" => crate::shard::ExecutionState::Executing,
        "waiting_for_input" => crate::shard::ExecutionState::WaitingForInput,
        "cooldown" => crate::shard::ExecutionState::Cooldown,
        _ => crate::shard::ExecutionState::Idle,
    };

    let caps_json: String = row.get(17)?;
    let capabilities = serde_json::from_str(&caps_json).unwrap_or_default();

    Ok(Shard {
        id: row.get(0)?,
        genome_hash: row.get(1)?,
        shard_type: row.get(2)?,
        species: row.get(3)?,
        name: row.get(4)?,
        level: row.get(5)?,
        xp: row.get(6)?,
        owner_id: row.get(7)?,
        is_wild: is_wild_int != 0,
        avatar,
        personality: row.get(10)?,
        stats,
        decay_factor: row.get(12)?,
        created_at: row.get(13)?,
        last_interaction: row.get(14)?,
        elo_rating: row.get(15)?,
        execution_state,
        capabilities,
        tasks_completed: row.get(18)?,
        tasks_failed: row.get(19)?,
    })
}

/// Update a shard's mutable fields in the database.
pub fn update_shard(data_dir: &str, shard: &Shard) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;

    let stats_json = serde_json::to_string(&shard.stats).unwrap_or_default();
    let capabilities_json = serde_json::to_string(&shard.capabilities).unwrap_or_default();
    let exec_state = serde_json::to_string(&shard.execution_state)
        .unwrap_or_else(|_| "\"idle\"".to_string())
        .trim_matches('"')
        .to_string();

    conn.execute(
        "UPDATE shards SET
            level = ?1,
            xp = ?2,
            owner_id = ?3,
            is_wild = ?4,
            stats_json = ?5,
            decay_factor = ?6,
            last_interaction = ?7,
            elo_rating = ?8,
            execution_state = ?9,
            capabilities_json = ?10,
            tasks_completed = ?11,
            tasks_failed = ?12
         WHERE id = ?13",
        params![
            shard.level,
            shard.xp,
            shard.owner_id,
            shard.is_wild as i32,
            stats_json,
            shard.decay_factor,
            shard.last_interaction,
            shard.elo_rating,
            exec_state,
            capabilities_json,
            shard.tasks_completed,
            shard.tasks_failed,
            shard.id,
        ],
    )?;

    tracing::debug!("Updated shard {} in database", &shard.id[..8]);
    Ok(())
}

/// Delete a shard from the database by ID.
pub fn delete_shard(data_dir: &str, shard_id: &str) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;
    conn.execute("DELETE FROM shards WHERE id = ?1", params![shard_id])?;
    tracing::debug!("Deleted shard {} from database", &shard_id[..8.min(shard_id.len())]);
    Ok(())
}

/// A single interaction (message) in a shard's training history.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Interaction {
    pub id: i64,
    pub shard_id: String,
    pub role: String,
    pub content: String,
    pub xp_gained: u32,
    pub timestamp: u64,
}

/// Insert a new interaction into the database.
pub fn insert_interaction(
    data_dir: &str,
    shard_id: &str,
    role: &str,
    content: &str,
    xp_gained: u32,
) -> SqliteResult<i64> {
    let conn = open_db(data_dir)?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    conn.execute(
        "INSERT INTO interactions (shard_id, role, content, xp_gained, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![shard_id, role, content, xp_gained, timestamp],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Get interactions for a shard, ordered by timestamp ASC, with an optional limit.
pub fn get_interactions(data_dir: &str, shard_id: &str, limit: u32) -> SqliteResult<Vec<Interaction>> {
    let conn = open_db(data_dir)?;

    let mut stmt = conn.prepare(
        "SELECT id, shard_id, role, content, xp_gained, timestamp
         FROM interactions
         WHERE shard_id = ?1
         ORDER BY timestamp ASC
         LIMIT ?2",
    )?;

    let interactions = stmt
        .query_map(params![shard_id, limit], |row| {
            Ok(Interaction {
                id: row.get(0)?,
                shard_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                xp_gained: row.get(4)?,
                timestamp: row.get(5)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(interactions)
}

/// Get a single shard by ID.
pub fn get_shard_by_id(data_dir: &str, shard_id: &str) -> SqliteResult<Option<Shard>> {
    let conn = open_db(data_dir)?;

    let mut stmt = conn.prepare(
        "SELECT id, genome_hash, shard_type, species, name, level, xp,
                owner_id, is_wild, avatar_json, personality, stats_json,
                decay_factor, created_at, last_interaction, elo_rating,
                execution_state, capabilities_json, tasks_completed, tasks_failed
         FROM shards
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query_map(params![shard_id], |row| row_to_shard(row))?;

    match rows.next() {
        Some(Ok(shard)) => Ok(Some(shard)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

// ── Action log (task execution tracking) ────────────────────────────

/// A logged action from shard task execution.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActionLog {
    pub id: i64,
    pub shard_id: String,
    pub task_description: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>,
    pub tool_output: Option<String>,
    pub status: String, // "pending", "running", "success", "failed"
    pub xp_awarded: u32,
    pub stat_bonuses: Option<String>, // JSON: {"intelligence": 2, "precision": 1}
    pub started_at: u64,
    pub completed_at: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TaskLesson {
    pub id: i64,
    pub shard_id: String,
    pub action_id: i64,
    pub task_type: String,
    pub goal: String,
    pub approach: String,
    pub tools_used: Vec<String>,
    pub outcome: String,
    pub errors: Vec<String>,
    pub fixes: Vec<String>,
    pub duration_ms: u64,
    pub success: bool,
    pub extractor_confidence: f64,
    pub applicability_confidence: f64,
    pub reusability: f64,
    pub score: f64,
    pub artifact_path: String,
    pub times_retrieved: u32,
    pub times_helpful: u32,
    pub times_unhelpful: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone)]
pub struct NewTaskLesson<'a> {
    pub shard_id: &'a str,
    pub action_id: i64,
    pub task_type: &'a str,
    pub goal: &'a str,
    pub approach: &'a str,
    pub tools_used: &'a [String],
    pub outcome: &'a str,
    pub errors: &'a [String],
    pub fixes: &'a [String],
    pub duration_ms: u64,
    pub success: bool,
    pub extractor_confidence: f64,
    pub applicability_confidence: f64,
    pub reusability: f64,
    pub artifact_path: &'a str,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LessonRetrievalEvent {
    pub id: i64,
    pub shard_id: String,
    pub action_id: i64,
    pub task: String,
    pub task_type: String,
    pub lesson_ids: Vec<i64>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub success: Option<bool>,
    pub duration_ms: Option<u64>,
    pub latency_delta_ms: Option<i64>,
    pub helpful: Option<bool>,
}

/// Insert a new action log entry (status=pending). Returns the row ID.
pub fn insert_action(
    data_dir: &str,
    shard_id: &str,
    task_description: &str,
) -> SqliteResult<i64> {
    let conn = open_db(data_dir)?;
    let now = now_millis();

    conn.execute(
        "INSERT INTO action_log (shard_id, task_description, status, started_at)
         VALUES (?1, ?2, 'pending', ?3)",
        params![shard_id, task_description, now],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Update an action log entry with tool call info and result.
pub fn complete_action(
    data_dir: &str,
    action_id: i64,
    tool_name: &str,
    tool_input: &str,
    tool_output: &str,
    status: &str,
    xp_awarded: u32,
    stat_bonuses: Option<&str>,
) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;
    let now = now_millis();

    conn.execute(
        "UPDATE action_log SET
            tool_name = ?1,
            tool_input = ?2,
            tool_output = ?3,
            status = ?4,
            xp_awarded = ?5,
            stat_bonuses = ?6,
            completed_at = ?7
         WHERE id = ?8",
        params![tool_name, tool_input, tool_output, status, xp_awarded, stat_bonuses, now, action_id],
    )?;

    Ok(())
}

/// Get recent actions for a shard.
pub fn get_actions(data_dir: &str, shard_id: &str, limit: u32) -> SqliteResult<Vec<ActionLog>> {
    let conn = open_db(data_dir)?;

    let mut stmt = conn.prepare(
        "SELECT id, shard_id, task_description, tool_name, tool_input, tool_output,
                status, xp_awarded, stat_bonuses, started_at, completed_at
         FROM action_log
         WHERE shard_id = ?1
         ORDER BY started_at DESC
         LIMIT ?2",
    )?;

    let actions = stmt
        .query_map(params![shard_id, limit], |row| {
            Ok(ActionLog {
                id: row.get(0)?,
                shard_id: row.get(1)?,
                task_description: row.get(2)?,
                tool_name: row.get(3)?,
                tool_input: row.get(4)?,
                tool_output: row.get(5)?,
                status: row.get(6)?,
                xp_awarded: row.get(7)?,
                stat_bonuses: row.get(8)?,
                started_at: row.get(9)?,
                completed_at: row.get(10)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(actions)
}

/// Get action counts by status for a shard (for stats).
pub fn get_action_summary(data_dir: &str, shard_id: &str) -> SqliteResult<(u32, u32, u32)> {
    let conn = open_db(data_dir)?;

    let total: u32 = conn.query_row(
        "SELECT COUNT(*) FROM action_log WHERE shard_id = ?1",
        params![shard_id],
        |row| row.get(0),
    )?;

    let success: u32 = conn.query_row(
        "SELECT COUNT(*) FROM action_log WHERE shard_id = ?1 AND status = 'success'",
        params![shard_id],
        |row| row.get(0),
    )?;

    let failed: u32 = conn.query_row(
        "SELECT COUNT(*) FROM action_log WHERE shard_id = ?1 AND status = 'failed'",
        params![shard_id],
        |row| row.get(0),
    )?;

    Ok((total, success, failed))
}

pub fn insert_task_lesson(data_dir: &str, lesson: &NewTaskLesson) -> SqliteResult<i64> {
    let conn = open_db(data_dir)?;
    let now = now_millis();
    let tools_used_json = serde_json::to_string(lesson.tools_used).unwrap_or_else(|_| "[]".to_string());
    let errors_json = serde_json::to_string(lesson.errors).unwrap_or_else(|_| "[]".to_string());
    let fixes_json = serde_json::to_string(lesson.fixes).unwrap_or_else(|_| "[]".to_string());
    let success_f = if lesson.success { 1.0 } else { 0.0 };
    let initial_score = (0.15 * success_f
        + 0.30 * lesson.extractor_confidence
        + 0.30 * lesson.applicability_confidence
        + 0.25 * lesson.reusability)
        .clamp(0.0, 1.0);

    conn.execute(
        "INSERT INTO task_lessons (
            shard_id, action_id, task_type, goal, approach, tools_used_json, outcome,
            errors_json, fixes_json, duration_ms, success, extractor_confidence,
            applicability_confidence, reusability, score, artifact_path,
            times_retrieved, times_helpful, times_unhelpful, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 0, 0, 0, ?17, ?18)",
        params![
            lesson.shard_id,
            lesson.action_id,
            lesson.task_type,
            lesson.goal,
            lesson.approach,
            tools_used_json,
            lesson.outcome,
            errors_json,
            fixes_json,
            lesson.duration_ms,
            if lesson.success { 1 } else { 0 },
            lesson.extractor_confidence,
            lesson.applicability_confidence,
            lesson.reusability,
            initial_score,
            lesson.artifact_path,
            now,
            now
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn get_recent_task_lessons(
    data_dir: &str,
    shard_id: &str,
    limit: u32,
) -> SqliteResult<Vec<TaskLesson>> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT id, shard_id, action_id, task_type, goal, approach, tools_used_json, outcome,
                errors_json, fixes_json, duration_ms, success, extractor_confidence,
                applicability_confidence, reusability, score, artifact_path,
                times_retrieved, times_helpful, times_unhelpful, created_at, updated_at
         FROM task_lessons
         WHERE shard_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;

    let lessons = stmt
        .query_map(params![shard_id, limit], row_to_task_lesson)?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(lessons)
}

pub fn retrieve_relevant_lessons(
    data_dir: &str,
    shard_id: &str,
    task: &str,
    task_type: &str,
    max_lessons: usize,
) -> SqliteResult<Vec<TaskLesson>> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT id, shard_id, action_id, task_type, goal, approach, tools_used_json, outcome,
                errors_json, fixes_json, duration_ms, success, extractor_confidence,
                applicability_confidence, reusability, score, artifact_path,
                times_retrieved, times_helpful, times_unhelpful, created_at, updated_at
         FROM task_lessons
         WHERE shard_id = ?1
         ORDER BY created_at DESC
         LIMIT 300",
    )?;
    let mut lessons = stmt
        .query_map(params![shard_id], row_to_task_lesson)?
        .collect::<SqliteResult<Vec<_>>>()?;

    let query_tokens = tokenize(task);
    let now = now_millis();
    let mut ranked: Vec<(TaskLesson, f64)> = lessons
        .drain(..)
        .map(|l| {
            let score = lesson_rank(&l, &query_tokens, task_type, now);
            (l, score)
        })
        .collect();

    ranked.sort_by(|a, b| {
        let sa = a.1;
        let sb = b.1;
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut selected: Vec<TaskLesson> = Vec::new();
    let target_max = max_lessons.min(7);
    for (lesson, rank) in &ranked {
        if selected.len() >= target_max {
            break;
        }
        // Quality floor once we already have enough context candidates.
        if selected.len() >= 3 && *rank < 0.22 {
            break;
        }
        if selected.iter().any(|s| near_duplicate(s, lesson)) {
            continue;
        }
        selected.push(lesson.clone());
    }

    // Fallback fill to ensure up to `target_max` when corpus is small/noisy.
    if selected.len() < target_max {
        for (lesson, _) in ranked {
            if selected.len() >= target_max {
                break;
            }
            if selected.iter().any(|s| near_duplicate(s, &lesson)) {
                continue;
            }
            selected.push(lesson);
        }
    }

    Ok(selected)
}

pub fn start_lesson_retrieval_event(
    data_dir: &str,
    shard_id: &str,
    action_id: i64,
    task: &str,
    task_type: &str,
    lesson_ids: &[i64],
) -> SqliteResult<i64> {
    let conn = open_db(data_dir)?;
    let now = now_millis();
    let lesson_ids_json = serde_json::to_string(lesson_ids).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO lesson_retrieval_events (
            shard_id, action_id, task, task_type, lesson_ids_json, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![shard_id, action_id, task, task_type, lesson_ids_json, now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn complete_lesson_retrieval_event(
    data_dir: &str,
    event_id: i64,
    success: bool,
    duration_ms: u64,
    latency_delta_ms: Option<i64>,
    helpful: bool,
) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;
    let now = now_millis();
    conn.execute(
        "UPDATE lesson_retrieval_events
         SET completed_at = ?1, success = ?2, duration_ms = ?3, latency_delta_ms = ?4, helpful = ?5
         WHERE id = ?6",
        params![
            now,
            if success { 1 } else { 0 },
            duration_ms,
            latency_delta_ms,
            if helpful { 1 } else { 0 },
            event_id
        ],
    )?;
    Ok(())
}

pub fn apply_lesson_feedback(
    data_dir: &str,
    lesson_ids: &[i64],
    helpful: bool,
) -> SqliteResult<()> {
    if lesson_ids.is_empty() {
        return Ok(());
    }
    let conn = open_db(data_dir)?;
    let now = now_millis();
    let delta = if helpful { 0.08 } else { -0.05 };
    for id in lesson_ids {
        conn.execute(
            "UPDATE task_lessons
             SET times_retrieved = times_retrieved + 1,
                 times_helpful = times_helpful + ?1,
                 times_unhelpful = times_unhelpful + ?2,
                 score = MIN(1.0, MAX(0.0, score + ?3)),
                 updated_at = ?4
             WHERE id = ?5",
            params![
                if helpful { 1 } else { 0 },
                if helpful { 0 } else { 1 },
                delta,
                now,
                id
            ],
        )?;
    }
    Ok(())
}

pub fn avg_success_duration_by_task_type(
    data_dir: &str,
    shard_id: &str,
    task_type: &str,
) -> SqliteResult<Option<u64>> {
    let conn = open_db(data_dir)?;
    let avg: Option<f64> = conn.query_row(
        "SELECT AVG(duration_ms) FROM task_lessons
         WHERE shard_id = ?1 AND task_type = ?2 AND success = 1",
        params![shard_id, task_type],
        |row| row.get(0),
    )?;
    Ok(avg.map(|v| v.max(0.0) as u64))
}

pub fn get_recent_lesson_retrieval_events(
    data_dir: &str,
    shard_id: &str,
    limit: u32,
) -> SqliteResult<Vec<LessonRetrievalEvent>> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT id, shard_id, action_id, task, task_type, lesson_ids_json, created_at,
                completed_at, success, duration_ms, latency_delta_ms, helpful
         FROM lesson_retrieval_events
         WHERE shard_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;

    let events = stmt
        .query_map(params![shard_id, limit], |row| {
            let lesson_ids_json: String = row.get(5)?;
            Ok(LessonRetrievalEvent {
                id: row.get(0)?,
                shard_id: row.get(1)?,
                action_id: row.get(2)?,
                task: row.get(3)?,
                task_type: row.get(4)?,
                lesson_ids: serde_json::from_str(&lesson_ids_json).unwrap_or_default(),
                created_at: row.get(6)?,
                completed_at: row.get(7)?,
                success: row.get::<_, Option<i64>>(8)?.map(|v| v != 0),
                duration_ms: row.get(9)?,
                latency_delta_ms: row.get(10)?,
                helpful: row.get::<_, Option<i64>>(11)?.map(|v| v != 0),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(events)
}

/// Get all tracked loan IDs with state = 'Funded' for liquidation checks.
pub fn get_funded_loans(data_dir: &str) -> SqliteResult<Vec<String>> {
    let conn = open_db(data_dir)?;

    let mut stmt = conn.prepare(
        "SELECT loan_id FROM tracked_loans WHERE state = 'Funded'"
    )?;

    let loans = stmt
        .query_map([], |row| row.get(0))?
        .collect::<SqliteResult<Vec<String>>>()?;

    Ok(loans)
}

/// Track a funded loan for periodic liquidation checks.
pub fn track_loan(data_dir: &str, loan_id: &str) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;
    let now = now_millis();
    conn.execute(
        "INSERT OR REPLACE INTO tracked_loans (loan_id, state, added_at) VALUES (?1, 'Funded', ?2)",
        params![loan_id, now],
    )?;
    Ok(())
}

/// Remove a loan from tracking (e.g., after repayment or liquidation).
pub fn untrack_loan(data_dir: &str, loan_id: &str) -> SqliteResult<()> {
    let conn = open_db(data_dir)?;
    conn.execute("DELETE FROM tracked_loans WHERE loan_id = ?1", params![loan_id])?;
    Ok(())
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn row_to_task_lesson(row: &rusqlite::Row) -> SqliteResult<TaskLesson> {
    let tools_json: String = row.get(6)?;
    let errors_json: String = row.get(8)?;
    let fixes_json: String = row.get(9)?;
    Ok(TaskLesson {
        id: row.get(0)?,
        shard_id: row.get(1)?,
        action_id: row.get(2)?,
        task_type: row.get(3)?,
        goal: row.get(4)?,
        approach: row.get(5)?,
        tools_used: serde_json::from_str(&tools_json).unwrap_or_default(),
        outcome: row.get(7)?,
        errors: serde_json::from_str(&errors_json).unwrap_or_default(),
        fixes: serde_json::from_str(&fixes_json).unwrap_or_default(),
        duration_ms: row.get(10)?,
        success: row.get::<_, i64>(11)? != 0,
        extractor_confidence: row.get(12)?,
        applicability_confidence: row.get(13)?,
        reusability: row.get(14)?,
        score: row.get(15)?,
        artifact_path: row.get(16)?,
        times_retrieved: row.get(17)?,
        times_helpful: row.get(18)?,
        times_unhelpful: row.get(19)?,
        created_at: row.get(20)?,
        updated_at: row.get(21)?,
    })
}

fn lesson_rank(
    lesson: &TaskLesson,
    query_tokens: &[String],
    task_type: &str,
    now_ms: u64,
) -> f64 {
    let corpus = format!("{} {} {}", lesson.goal, lesson.approach, lesson.outcome);
    let lesson_tokens = tokenize(&corpus);
    let lexical = jaccard(query_tokens, &lesson_tokens);
    let type_boost = if lesson.task_type == task_type { 0.2 } else { 0.0 };
    let helpful_rate = (lesson.times_helpful as f64 + 1.0)
        / (lesson.times_retrieved as f64 + 2.0);
    let age_days = ((now_ms.saturating_sub(lesson.created_at)) as f64 / 86_400_000.0).max(0.0);
    let recency = 1.0 / (1.0 + age_days / 14.0);
    lexical * 0.45 + lesson.score * 0.30 + helpful_rate * 0.15 + recency * 0.10 + type_boost
}

fn tokenize(input: &str) -> Vec<String> {
    input
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 3)
        .map(|t| t.to_ascii_lowercase())
        .collect()
}

fn jaccard(a: &[String], b: &[String]) -> f64 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let a_set: std::collections::HashSet<&str> = a.iter().map(|s| s.as_str()).collect();
    let b_set: std::collections::HashSet<&str> = b.iter().map(|s| s.as_str()).collect();
    let inter = a_set.intersection(&b_set).count() as f64;
    let union = a_set.union(&b_set).count() as f64;
    if union == 0.0 { 0.0 } else { inter / union }
}

fn near_duplicate(a: &TaskLesson, b: &TaskLesson) -> bool {
    if a.task_type != b.task_type {
        return false;
    }
    let ta = tokenize(&format!("{} {}", a.goal, a.approach));
    let tb = tokenize(&format!("{} {}", b.goal, b.approach));
    jaccard(&ta, &tb) >= 0.82
}

/// Expand ~ to home directory in paths.
fn shellexpand(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shard::Shard;

    fn temp_data_dir() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        (dir, path)
    }

    #[test]
    fn init_db_idempotent() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();
        init_db(&path).unwrap(); // should not error on second call
    }

    #[test]
    fn insert_and_get_shards() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(Some("oracle"));
        insert_shard(&path, &shard).unwrap();

        let shards = get_shards(&path).unwrap();
        assert_eq!(shards.len(), 1);
        assert_eq!(shards[0].id, shard.id);
        assert_eq!(shards[0].shard_type, "Oracle");
    }

    #[test]
    fn get_shard_by_id_found_and_missing() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(Some("cipher"));
        insert_shard(&path, &shard).unwrap();

        let found = get_shard_by_id(&path, &shard.id).unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, shard.name);

        let missing = get_shard_by_id(&path, "nonexistent-id").unwrap();
        assert!(missing.is_none());
    }

    #[test]
    fn update_shard_persists() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let mut shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();

        shard.xp = 500;
        shard.level = 6;
        update_shard(&path, &shard).unwrap();

        let loaded = get_shard_by_id(&path, &shard.id).unwrap().unwrap();
        assert_eq!(loaded.xp, 500);
        assert_eq!(loaded.level, 6);
    }

    #[test]
    fn delete_shard_removes() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();
        assert_eq!(get_shards(&path).unwrap().len(), 1);

        delete_shard(&path, &shard.id).unwrap();
        assert_eq!(get_shards(&path).unwrap().len(), 0);
    }

    #[test]
    fn interactions_crud() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();

        insert_interaction(&path, &shard.id, "user", "Hello shard", 0).unwrap();
        insert_interaction(&path, &shard.id, "assistant", "Hello trainer!", 10).unwrap();

        let history = get_interactions(&path, &shard.id, 100).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].role, "user");
        assert_eq!(history[1].role, "assistant");
        assert_eq!(history[1].xp_gained, 10);
    }

    #[test]
    fn action_log_crud() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();

        let action_id = insert_action(&path, &shard.id, "Analyze this CSV file").unwrap();
        assert!(action_id > 0);

        complete_action(
            &path,
            action_id,
            "code_eval",
            r#"{"language":"python","code":"import csv"}"#,
            "CSV parsed successfully",
            "success",
            25,
            Some(r#"{"intelligence":2}"#),
        )
        .unwrap();

        let actions = get_actions(&path, &shard.id, 10).unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].status, "success");
        assert_eq!(actions[0].xp_awarded, 25);
        assert_eq!(actions[0].tool_name.as_deref(), Some("code_eval"));
    }

    #[test]
    fn action_summary() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();

        let a1 = insert_action(&path, &shard.id, "task 1").unwrap();
        complete_action(&path, a1, "shell_exec", "{}", "ok", "success", 10, None).unwrap();

        let a2 = insert_action(&path, &shard.id, "task 2").unwrap();
        complete_action(&path, a2, "http_fetch", "{}", "err", "failed", 0, None).unwrap();

        let a3 = insert_action(&path, &shard.id, "task 3").unwrap();
        complete_action(&path, a3, "code_eval", "{}", "done", "success", 15, None).unwrap();

        let (total, success, failed) = get_action_summary(&path, &shard.id).unwrap();
        assert_eq!(total, 3);
        assert_eq!(success, 2);
        assert_eq!(failed, 1);
    }

    #[test]
    fn interactions_limit() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();

        for i in 0..10 {
            insert_interaction(&path, &shard.id, "user", &format!("msg {}", i), 0).unwrap();
        }

        let limited = get_interactions(&path, &shard.id, 3).unwrap();
        assert_eq!(limited.len(), 3);
    }

    #[test]
    fn task_lessons_insert_retrieve_and_feedback() {
        let (_dir, path) = temp_data_dir();
        init_db(&path).unwrap();

        let shard = Shard::spawn(None);
        insert_shard(&path, &shard).unwrap();
        let action_id = insert_action(&path, &shard.id, "Fix failing tests in parser").unwrap();
        let tools = vec!["shell_exec".to_string(), "code_eval".to_string()];
        let errors = vec!["shell_exec: initial command failed".to_string()];
        let fixes = vec!["Recovered by narrowing command scope".to_string()];

        let lesson = NewTaskLesson {
            shard_id: &shard.id,
            action_id,
            task_type: "debug",
            goal: "Fix failing tests in parser",
            approach: "Used shell_exec and code_eval to isolate failing case",
            tools_used: &tools,
            outcome: "Tests passed after patching parser edge case",
            errors: &errors,
            fixes: &fixes,
            duration_ms: 1450,
            success: true,
            extractor_confidence: 0.8,
            applicability_confidence: 0.75,
            reusability: 0.7,
            artifact_path: "/tmp/memory.json",
        };
        let lesson_id = insert_task_lesson(&path, &lesson).unwrap();
        assert!(lesson_id > 0);

        let retrieved = retrieve_relevant_lessons(
            &path,
            &shard.id,
            "parser tests are failing",
            "debug",
            5,
        )
        .unwrap();
        assert!(!retrieved.is_empty());
        assert_eq!(retrieved[0].id, lesson_id);

        apply_lesson_feedback(&path, &[lesson_id], true).unwrap();
        let recent = get_recent_task_lessons(&path, &shard.id, 5).unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].times_retrieved, 1);
        assert_eq!(recent[0].times_helpful, 1);
    }
}
