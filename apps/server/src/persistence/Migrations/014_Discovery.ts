import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // ── discovery_runs ────────────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_runs (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      mode TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'gathering-context',
      config_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_seconds REAL,
      scheduled INTEGER NOT NULL DEFAULT 0,
      parent_run_id TEXT,
      error TEXT,
      FOREIGN KEY (parent_run_id) REFERENCES discovery_runs(id)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_runs_started_at
    ON discovery_runs(started_at DESC)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_runs_phase
    ON discovery_runs(phase)
  `;

  // ── discovery_agent_results ───────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_agent_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      role TEXT,
      report_markdown TEXT,
      log_text TEXT,
      exit_code INTEGER,
      duration_seconds REAL,
      timed_out INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE,
      UNIQUE(run_id, agent)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_agent_results_run_id
    ON discovery_agent_results(run_id)
  `;

  // ── discovery_reports ─────────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_reports (
      run_id TEXT PRIMARY KEY,
      merged_markdown TEXT NOT NULL,
      doc_suggestions TEXT,
      metadata_json TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE
    )
  `;

  // ── discovery_agent_health ────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_agent_health (
      agent TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'healthy',
      cooldown_until TEXT,
      cooldown_reason TEXT,
      last_seen_at TEXT
    )
  `;

  // ── discovery_triage ──────────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_triage (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_triage_run_id
    ON discovery_triage(run_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_triage_status
    ON discovery_triage(status)
  `;

  // ── discovery_schedule ────────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_schedule (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      cron_expression TEXT,
      scope_rotation_json TEXT NOT NULL DEFAULT '["full"]',
      full_audit_every_n INTEGER NOT NULL DEFAULT 7,
      focus TEXT,
      next_run_at TEXT,
      updated_at TEXT NOT NULL
    )
  `;

  // ── discovery_config ──────────────────────────────────────────────
  yield* sql`
    CREATE TABLE IF NOT EXISTS discovery_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      agents_json TEXT NOT NULL DEFAULT '["codex","claude"]',
      default_scope TEXT NOT NULL DEFAULT 'full',
      default_timeout_seconds INTEGER NOT NULL DEFAULT 600,
      merge_agent TEXT,
      cooldown_hours INTEGER NOT NULL DEFAULT 6,
      max_history_runs INTEGER NOT NULL DEFAULT 3,
      max_history_items_per_run INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL
    )
  `;
});
