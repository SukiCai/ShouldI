/** Phone + password auth: signup/signin against the real `users` table, JWT issuance/verification. */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { createUser, getUserByPhone, getUserById, updatePasswordHash } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'change-me-local-dev';
const JWT_EXPIRES_IN = '30d';
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

export type AuthResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'INVALID_PHONE' | 'WEAK_PASSWORD' | 'PHONE_TAKEN' | 'INVALID_CREDENTIALS' };

function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  // Expect E.164-ish: leading + and 8-15 digits total. Frontend is responsible
  // for combining dial code + national digits into this shape before calling us.
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null;
  return trimmed;
}

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function signUp(phoneRaw: string, password: string): AuthResult {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, reason: 'INVALID_PHONE' };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'WEAK_PASSWORD' };
  if (getUserByPhone(phone)) return { ok: false, reason: 'PHONE_TAKEN' };

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const user = createUser(phone, passwordHash);
  return { ok: true, userId: user.id, token: issueToken(user.id) };
}

export function signIn(phoneRaw: string, password: string): AuthResult {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, reason: 'INVALID_PHONE' };
  const user = getUserByPhone(phone);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }
  return { ok: true, userId: user.id, token: issueToken(user.id) };
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'INVALID_CURRENT_PASSWORD' | 'WEAK_PASSWORD' | 'USER_NOT_FOUND' };

/** Requires the caller to already be authenticated (userId comes from a verified JWT, not the request body). */
export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): ChangePasswordResult {
  const user = getUserById(userId);
  if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return { ok: false, reason: 'INVALID_CURRENT_PASSWORD' };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'WEAK_PASSWORD' };

  updatePasswordHash(userId, bcrypt.hashSync(newPassword, BCRYPT_ROUNDS));
  return { ok: true };
}

/** Verifies a `Bearer <jwt>` Authorization header value. Returns the real userId, or null. */
export function verifyAuthHeader(authorization: string | undefined): string | null {
  const raw = authorization?.trim();
  if (!raw?.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice('bearer '.length).trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const sub = typeof payload === 'object' && payload !== null ? payload.sub : null;
    if (typeof sub !== 'string' || !sub) return null;
    // Confirm the user still exists (covers deleted accounts / stale tokens).
    return getUserById(sub) ? sub : null;
  } catch {
    return null;
  }
}
