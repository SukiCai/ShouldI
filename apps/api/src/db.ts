/**
 * SQLite-backed persistence for real user accounts.
 *
 * This is intentionally scoped to just the `users` table (phase 2 of the
 * account-isolation plan — real login). Session/decision/explore state is
 * still in-memory (phase 3); this file is the first real, durable store so
 * accounts survive an `apps/api` restart.
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
    created_at INTEGER NOT NULL
  );
`);

export type UserRow = {
  id: string;
  phone: string;
  password_hash: string;
  created_at: number;
};

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, phone, password_hash, created_at) VALUES (?, ?, ?, ?)',
);
const getUserByPhoneStmt = db.prepare('SELECT * FROM users WHERE phone = ?');
const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const updatePasswordHashStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

export function createUser(phone: string, passwordHash: string): UserRow {
  const row: UserRow = {
    id: randomUUID(),
    phone,
    password_hash: passwordHash,
    created_at: Date.now(),
  };
  insertUserStmt.run(row.id, row.phone, row.password_hash, row.created_at);
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
