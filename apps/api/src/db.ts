/**
 * SQLite-backed persistence.
 *
 * Phase 2 (real login) added the `users` table. Phase 3 extends this to
 * every other piece of state that used to live only in in-memory `Map`s
 * (interview sessions, expert discoveries, decision records/lenses/replays,
 * decision DNA, product events, explore cards) so none of it is lost when
 * `apps/api` restarts.
 */
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import DatabaseConstructor, { type Database } from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = process.env.SHOULDI_DB_PATH || join(DATA_DIR, 'shouldi.db');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db: Database = new DatabaseConstructor(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at DESC);

  CREATE TABLE IF NOT EXISTS expert_discoveries (
    user_id TEXT NOT NULL,
    expert_id TEXT NOT NULL,
    last_used_at INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (user_id, expert_id)
  );

  CREATE TABLE IF NOT EXISTS decision_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decision_lenses (
    decision_record_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outcome_replays (
    decision_record_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decision_dna (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decision_dna_history (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_dna_history_user ON decision_dna_history (user_id, seq DESC);

  CREATE TABLE IF NOT EXISTS product_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS explore_cards (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

// Migration: decision_records predates the user_id column (originally had
// no ownership tracking at all — see the G3 cross-account-access fix).
// CREATE TABLE IF NOT EXISTS is a no-op against an already-existing table,
// so a pre-existing dev DB needs this column added explicitly — and the
// index has to be created AFTER this runs, never inside the CREATE TABLE
// block above, or it 500s on a pre-existing table that predates the column.
{
  const decisionRecordCols = db.prepare('PRAGMA table_info(decision_records)').all() as { name: string }[];
  if (decisionRecordCols.length > 0 && !decisionRecordCols.some((c) => c.name === 'user_id')) {
    db.exec("ALTER TABLE decision_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous-local'");
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_decision_records_user_updated ON decision_records (user_id, updated_at DESC)');

// Migration: users predates token_version (JWTs used to have no way to be
// revoked short of waiting out the 30-day expiry — see the D3 fix in
// docs/engineering/user-account-isolation-test-plan.md).
{
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (userCols.length > 0 && !userCols.some((c) => c.name === 'token_version')) {
    db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  }
}

export type UserRow = {
  id: string;
  phone: string;
  password_hash: string;
  token_version: number;
  created_at: number;
};

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, phone, password_hash, token_version, created_at) VALUES (?, ?, ?, ?, ?)',
);
const getUserByPhoneStmt = db.prepare('SELECT * FROM users WHERE phone = ?');
const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const updatePasswordHashStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const incrementTokenVersionStmt = db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?');

export function createUser(phone: string, passwordHash: string): UserRow {
  const row: UserRow = {
    id: randomUUID(),
    phone,
    password_hash: passwordHash,
    token_version: 0,
    created_at: Date.now(),
  };
  insertUserStmt.run(row.id, row.phone, row.password_hash, row.token_version, row.created_at);
  return row;
}

export function getUserByPhone(phone: string): UserRow | undefined {
  return getUserByPhoneStmt.get(phone) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return getUserByIdStmt.get(id) as UserRow | undefined;
}

export function updatePasswordHash(id: string, passwordHash: string): void {
  updatePasswordHashStmt.run(passwordHash, id);
}

/** Invalidates every JWT issued before this call — see issueToken()/verifyAuthHeader()
 * in auth.ts, which embed and check this value. Call whenever a token should stop
 * working immediately instead of riding out its 30-day expiry (e.g. password change). */
export function incrementTokenVersion(id: string): void {
  incrementTokenVersionStmt.run(id);
}

// ---------- Interview sessions ----------
// (JSON-blob generic — the concrete `Session` shape lives in harmence-interview.ts;
// keeping it generic here avoids a circular import.)

const upsertSessionStmt = db.prepare(`
  INSERT INTO sessions (id, user_id, updated_at, data) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at, data = excluded.data
`);
const getSessionStmt = db.prepare('SELECT data FROM sessions WHERE id = ?');
const listSessionsForUserStmt = db.prepare(
  'SELECT data FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
);

export function saveSessionRow<T>(id: string, userId: string | undefined, updatedAt: number, data: T): void {
  upsertSessionStmt.run(id, userId ?? null, updatedAt, JSON.stringify(data));
}

export function getSessionRow<T>(id: string): T | undefined {
  const row = getSessionStmt.get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

/** Scoped by user_id — sessions are private, never list across accounts. */
export function listSessionRowsForUser<T>(userId: string, limit: number): T[] {
  const rows = listSessionsForUserStmt.all(userId, limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

// ---------- Expert discoveries ----------

const upsertDiscoveryStmt = db.prepare(`
  INSERT INTO expert_discoveries (user_id, expert_id, last_used_at, data) VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, expert_id) DO UPDATE SET last_used_at = excluded.last_used_at, data = excluded.data
`);
const getDiscoveryStmt = db.prepare('SELECT data FROM expert_discoveries WHERE user_id = ? AND expert_id = ?');
const listDiscoveriesForUserStmt = db.prepare(
  'SELECT data FROM expert_discoveries WHERE user_id = ? ORDER BY last_used_at DESC',
);

export function saveDiscoveryRow<T>(userId: string, expertId: string, lastUsedAt: number, data: T): void {
  upsertDiscoveryStmt.run(userId, expertId, lastUsedAt, JSON.stringify(data));
}

export function getDiscoveryRow<T>(userId: string, expertId: string): T | undefined {
  const row = getDiscoveryStmt.get(userId, expertId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

export function listDiscoveryRowsForUser<T>(userId: string): T[] {
  const rows = listDiscoveriesForUserStmt.all(userId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

/** Test helper. */
export function clearExpertDiscoveryRows(): void {
  db.exec('DELETE FROM expert_discoveries');
}

// ---------- Decision records ----------

const upsertDecisionRecordStmt = db.prepare(`
  INSERT INTO decision_records (id, user_id, updated_at, data) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at, data = excluded.data
`);
const getDecisionRecordStmt = db.prepare('SELECT data FROM decision_records WHERE id = ?');
const listDecisionRecordsForUserStmt = db.prepare(
  'SELECT data FROM decision_records WHERE user_id = ? ORDER BY updated_at DESC',
);

export function saveDecisionRecordRow<T>(id: string, userId: string, updatedAt: number, data: T): void {
  upsertDecisionRecordStmt.run(id, userId, updatedAt, JSON.stringify(data));
}

export function getDecisionRecordRow<T>(id: string): T | undefined {
  const row = getDecisionRecordStmt.get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

/** Scoped by user_id — decision records are private, never list across accounts. */
export function listDecisionRecordRowsForUser<T>(userId: string): T[] {
  const rows = listDecisionRecordsForUserStmt.all(userId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

const listAllDecisionRecordsStmt = db.prepare('SELECT data FROM decision_records');

/** System-wide, unscoped — only for aggregate metrics (e.g. PMF dashboards)
 * that intentionally span every account. Never expose individual records
 * from this path; use listDecisionRecordRowsForUser for anything user-facing. */
export function listAllDecisionRecordRows<T>(): T[] {
  const rows = listAllDecisionRecordsStmt.all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

// ---------- Decision lenses ----------

const upsertLensStmt = db.prepare(`
  INSERT INTO decision_lenses (decision_record_id, data) VALUES (?, ?)
  ON CONFLICT(decision_record_id) DO UPDATE SET data = excluded.data
`);
const getLensStmt = db.prepare('SELECT data FROM decision_lenses WHERE decision_record_id = ?');

export function saveDecisionLensRow<T>(decisionRecordId: string, data: T): void {
  upsertLensStmt.run(decisionRecordId, JSON.stringify(data));
}

export function getDecisionLensRow<T>(decisionRecordId: string): T | undefined {
  const row = getLensStmt.get(decisionRecordId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

// ---------- Outcome replays ----------

const upsertReplayStmt = db.prepare(`
  INSERT INTO outcome_replays (decision_record_id, data) VALUES (?, ?)
  ON CONFLICT(decision_record_id) DO UPDATE SET data = excluded.data
`);
const getReplayStmt = db.prepare('SELECT data FROM outcome_replays WHERE decision_record_id = ?');

export function saveOutcomeReplayRow<T>(decisionRecordId: string, data: T): void {
  upsertReplayStmt.run(decisionRecordId, JSON.stringify(data));
}

export function getOutcomeReplayRow<T>(decisionRecordId: string): T | undefined {
  const row = getReplayStmt.get(decisionRecordId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

// ---------- Decision DNA ----------

const upsertDnaStmt = db.prepare(`
  INSERT INTO decision_dna (user_id, data) VALUES (?, ?)
  ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
`);
const getDnaStmt = db.prepare('SELECT data FROM decision_dna WHERE user_id = ?');

export function saveDnaRow<T>(userId: string, data: T): void {
  upsertDnaStmt.run(userId, JSON.stringify(data));
}

export function getDnaRow<T>(userId: string): T | undefined {
  const row = getDnaStmt.get(userId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

const insertDnaHistoryStmt = db.prepare(
  'INSERT INTO decision_dna_history (user_id, created_at, data) VALUES (?, ?, ?)',
);
const listDnaHistoryStmt = db.prepare(
  'SELECT data FROM decision_dna_history WHERE user_id = ? ORDER BY seq DESC',
);

export function insertDnaHistoryRow<T>(userId: string, createdAt: number, data: T): void {
  insertDnaHistoryStmt.run(userId, createdAt, JSON.stringify(data));
}

export function listDnaHistoryRows<T>(userId: string): T[] {
  const rows = listDnaHistoryStmt.all(userId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

// ---------- Product events ----------

const insertProductEventStmt = db.prepare('INSERT INTO product_events (data) VALUES (?)');
const listRecentProductEventsStmt = db.prepare('SELECT data FROM product_events ORDER BY seq DESC LIMIT ?');

export function insertProductEventRow<T>(data: T): void {
  insertProductEventStmt.run(JSON.stringify(data));
}

/** Most recent `limit` events, oldest-first (matches the old array's `.slice(-limit)` order). */
export function listRecentProductEventRows<T>(limit: number): T[] {
  const rows = listRecentProductEventsStmt.all(limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T).reverse();
}

// ---------- Explore cards ----------

const upsertExploreCardStmt = db.prepare(`
  INSERT INTO explore_cards (id, data) VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data
`);
const getExploreCardStmt = db.prepare('SELECT data FROM explore_cards WHERE id = ?');
const listExploreCardsStmt = db.prepare('SELECT data FROM explore_cards');
const countExploreCardsStmt = db.prepare('SELECT COUNT(*) AS n FROM explore_cards');

export function saveExploreCardRow<T>(id: string, data: T): void {
  upsertExploreCardStmt.run(id, JSON.stringify(data));
}

export function getExploreCardRow<T>(id: string): T | undefined {
  const row = getExploreCardStmt.get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

export function listExploreCardRows<T>(): T[] {
  const rows = listExploreCardsStmt.all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

export function countExploreCardRows(): number {
  return (countExploreCardsStmt.get() as { n: number }).n;
}
