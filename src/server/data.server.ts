/**
 * Server-only data layer.
 *
 * CONFIDENTIALITY RULES THAT APPLY TO EVERYTHING IN THIS FILE:
 *   - Never console.log / console.error any personal data: no names, no email
 *     addresses, no filenames, no message text, no passwords, no session tokens.
 *     Log a short generic reason instead, or nothing at all.
 *   - Nothing here may put personal data into a URL.
 *   - The whole module is only ever reached through a dynamic `import()` inside a
 *     server-function handler, never from client code.
 *
 * This file is imported as `./data.server` from `src/server/fns.ts` only.
 */
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { getCookie, setCookie } from "@tanstack/react-start/server";

import { sql } from "~/db";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  SESSION_COOKIE,
  SESSION_DAYS,
  SUBJECT_KEYS,
} from "~/lib/constants";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  resolveLocale,
  type Locale,
} from "~/i18n";

/* ------------------------------------------------------------------ helpers */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function db() {
  return sql();
}

/* -------------------------------------------------------------- password */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT_KEYLEN);
  return `scrypt$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[2], "base64");
    const expected = Buffer.from(parts[3], "base64");
    if (expected.length === 0) return false;
    const key = await scryptAsync(
      password.normalize("NFKC"),
      salt,
      expected.length,
    );
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------------- schema */

let schemaReady: Promise<void> | null = null;

/** Idempotent: safe to call before every query, runs once per server process. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createTables().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function createTables(): Promise<void> {
  const q = db();
  await q`create table if not exists users (
    id text primary key,
    name text not null,
    email text not null,
    email_norm text not null,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`;
  await q`create unique index if not exists users_email_norm_key on users (email_norm)`;
  await q`create table if not exists sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
  )`;
  await q`create index if not exists sessions_user_id_idx on sessions (user_id)`;
  await q`create table if not exists requests (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    city text not null,
    state text not null,
    subject text not null,
    message text not null,
    phone text,
    created_at timestamptz not null default now()
  )`;
  await q`create index if not exists requests_user_id_idx on requests (user_id)`;
  await q`create table if not exists documents (
    id text primary key,
    request_id text not null references requests(id) on delete cascade,
    filename text not null,
    mime_type text not null,
    content_base64 text not null,
    size integer not null,
    created_at timestamptz not null default now()
  )`;
  await q`create index if not exists documents_request_id_idx on documents (request_id)`;
  await q`create table if not exists login_attempts (
    email_norm text primary key,
    failed_count integer not null default 0,
    locked_until timestamptz,
    updated_at timestamptz not null default now()
  )`;
}

/* ------------------------------------------------------------------ users */

export type PublicUser = { id: string; name: string; email: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}):
  Promise<
    { ok: true; user: PublicUser } | { ok: false; code: "email_taken" }
  > {
  await ensureSchema();
  const q = db();
  const emailNorm = normalizeEmail(input.email);
  const existing = await q`select id from users where email_norm = ${emailNorm} limit 1`;
  if (existing.length > 0) return { ok: false, code: "email_taken" };

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  try {
    await q`insert into users (id, name, email, email_norm, password_hash)
            values (${id}, ${input.name.trim()}, ${input.email.trim()}, ${emailNorm}, ${passwordHash})`;
  } catch {
    // Unique index raced with another sign-up for the same address.
    return { ok: false, code: "email_taken" };
  }
  return { ok: true, user: { id, name: input.name.trim(), email: input.email.trim() } };
}

export async function authenticate(input: {
  email: string;
  password: string;
}): Promise<
  { ok: true; user: PublicUser } | { ok: false; code: "invalid" | "locked" }
> {
  await ensureSchema();
  const q = db();
  const emailNorm = normalizeEmail(input.email);

  const attempts =
    await q`select failed_count, locked_until from login_attempts where email_norm = ${emailNorm} limit 1`;
  if (attempts.length > 0) {
    const lockedUntil = attempts[0].locked_until as Date | null;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return { ok: false, code: "locked" };
    }
  }

  const rows =
    await q`select id, name, email, password_hash from users where email_norm = ${emailNorm} limit 1`;
  if (rows.length === 0) {
    // Same delay whether or not the account exists, so the response does not
    // reveal which email addresses have an account.
    await recordFailure(emailNorm);
    return { ok: false, code: "invalid" };
  }

  const row = rows[0];
  const valid = await verifyPassword(input.password, String(row.password_hash));
  if (!valid) {
    await recordFailure(emailNorm);
    return { ok: false, code: "invalid" };
  }

  await q`delete from login_attempts where email_norm = ${emailNorm}`;
  return {
    ok: true,
    user: { id: String(row.id), name: String(row.name), email: String(row.email) },
  };
}

async function recordFailure(emailNorm: string): Promise<void> {
  try {
    const q = db();
    const rows =
      await q`select failed_count from login_attempts where email_norm = ${emailNorm} limit 1`;
    const next = rows.length > 0 ? Number(rows[0].failed_count) + 1 : 1;
    if (next >= LOCKOUT_THRESHOLD) {
      await q`insert into login_attempts (email_norm, failed_count, locked_until, updated_at)
              values (${emailNorm}, 0, now() + make_interval(mins => ${LOCKOUT_MINUTES}), now())
              on conflict (email_norm) do update
                set failed_count = 0,
                    locked_until = now() + make_interval(mins => ${LOCKOUT_MINUTES}),
                    updated_at = now()`;
    } else {
      await q`insert into login_attempts (email_norm, failed_count, locked_until, updated_at)
              values (${emailNorm}, ${next}, null, now())
              on conflict (email_norm) do update
                set failed_count = ${next}, locked_until = null, updated_at = now()`;
    }
  } catch {
    // A failure here must not change the answer the visitor gets.
  }
  // Slow down automated guessing a little, on every failure.
  await sleep(300);
}

/* --------------------------------------------------------------- sessions */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 256 bits of randomness. Only the hash of this value is ever stored. */
export async function createSession(userId: string): Promise<string> {
  await ensureSchema();
  const token = randomBytes(32).toString("base64url");
  const q = db();
  await q`insert into sessions (token_hash, user_id, expires_at)
          values (${hashToken(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  return token;
}

export async function userForToken(token: string): Promise<PublicUser | null> {
  if (!token || token.length < 20 || token.length > 256) return null;
  await ensureSchema();
  const q = db();
  const rows = await q`select u.id, u.name, u.email
                       from sessions s join users u on u.id = s.user_id
                       where s.token_hash = ${hashToken(token)} and s.expires_at > now()
                       limit 1`;
  if (rows.length === 0) return null;
  return {
    id: String(rows[0].id),
    name: String(rows[0].name),
    email: String(rows[0].email),
  };
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await ensureSchema();
  const q = db();
  await q`delete from sessions where token_hash = ${hashToken(token)}`;
}

/** Ends the session of whoever is making the current request. */
export async function signOutCurrent(): Promise<void> {
  const token = readSessionCookie();
  if (token) await deleteSession(token);
}

/* --------------------------------------------------------------- requests */

export type IncomingDocument = {
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
};

export type IncomingRequest = {
  userId: string;
  city: string;
  state: string;
  subject: string;
  message: string;
  phone: string | null;
  documents: IncomingDocument[];
};

export async function saveRequest(input: IncomingRequest): Promise<string> {
  await ensureSchema();
  const q = db();
  const requestId = randomUUID();
  await q`insert into requests (id, user_id, city, state, subject, message, phone)
          values (${requestId}, ${input.userId}, ${input.city}, ${input.state},
                  ${input.subject}, ${input.message}, ${input.phone})`;
  for (const doc of input.documents) {
    await q`insert into documents (id, request_id, filename, mime_type, content_base64, size)
            values (${randomUUID()}, ${requestId}, ${doc.filename}, ${doc.mimeType},
                    ${doc.contentBase64}, ${doc.size})`;
  }
  return requestId;
}

/* ------------------------------------------------------------ request glue */

/** The visitor's language: remembered in a cookie, German by default. */
export function currentLocale(): Locale {
  try {
    return resolveLocale(getCookie(LANG_COOKIE));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLanguageCookie(locale: Locale): void {
  setCookie(LANG_COOKIE, locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function setSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export function clearSessionCookie(): void {
  setCookie(SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

function readSessionCookie(): string {
  try {
    return getCookie(SESSION_COOKIE) ?? "";
  } catch {
    return "";
  }
}

/**
 * The signed-in user, or null. Never throws — a missing or broken database must
 * not stop the public pages from rendering.
 */
export async function currentUser(): Promise<PublicUser | null> {
  if (!dbConfigured()) return null;
  const token = readSessionCookie();
  if (!token) return null;
  try {
    return await userForToken(token);
  } catch {
    return null;
  }
}

/**
 * The owner's Google Calendar appointment page. Read from one place only
 * (BOOKING_URL) and only exposed when it is a real http(s) link — the site must
 * never show a dead or placeholder booking link.
 */
export function bookingUrl(): string | null {
  const raw = process.env.BOOKING_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type Bootstrap = {
  locale: Locale;
  user: { name: string; email: string } | null;
  bookingUrl: string | null;
};

export async function bootstrap(): Promise<Bootstrap> {
  const sessionUser = await currentUser();
  return {
    locale: currentLocale(),
    user: sessionUser ? { name: sessionUser.name, email: sessionUser.email } : null,
    bookingUrl: bookingUrl(),
  };
}

export { MAX_FILES, MAX_FILE_BYTES, SUBJECT_KEYS };
