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

import siteConfig from "../../site.json";
import { sql } from "~/db";
import { areaForSubject, type AreaCode } from "~/lib/areas";
import {
  AI_ROUTE_CONNECTED,
  MAX_FILE_BYTES,
  MAX_FILES,
  MONTHLY_DOCUMENT_CAP,
  SESSION_COOKIE,
  SESSION_DAYS,
  SUBJECT_KEYS,
  type SubjectKey,
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
/*
 * THE SIGN-IN THROTTLE — the whole rule, in two numbers.
 *
 *   - After LOCKOUT_THRESHOLD failed attempts for ONE email address, that address
 *     is refused for LOCKOUT_MINUTES — even with the correct password.
 *   - Failures older than LOCKOUT_MINUTES do not count (see `authenticate`), so
 *     occasional typos never accumulate into a lockout.
 *   - A successful sign-in clears the count.
 *
 * WHAT IT DOES NOT DO (state it plainly, do not imply otherwise):
 *   - It is per email address, not per IP. Someone guessing across many addresses
 *     is slowed only by the 300 ms pause on each failure, not by a lockout.
 *   - Because the lockout is per address, anyone who knows an address can lock
 *     that person out for fifteen minutes by failing five times. That is the
 *     deliberate trade: a locked-out person is a smaller harm than an account
 *     taken over. A locked-out user is unlocked by hand today (no email reset).
 *   - A database failure inside `recordFailure` is swallowed, so a broken database
 *     means no throttle at all — the sign-in then simply fails on the query.
 */
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

/*
 * The tables and their migrations live in `./schema.server.ts` — one module, so
 * the area rules the database enforces are in one place. Imported here because
 * every function below calls it before its first query, and re-exported so the
 * rest of the server code keeps its single entry point.
 */
import { ensureSchema } from "./schema.server";
export { ensureSchema };

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
    await q`select failed_count, locked_until, updated_at from login_attempts where email_norm = ${emailNorm} limit 1`;
  if (attempts.length > 0) {
    const lockedUntil = attempts[0].locked_until as Date | null;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return { ok: false, code: "locked" };
    }
    /*
     * FAILURES EXPIRE. Without this line the count never aged: four typos in
     * January plus one in June would lock an honest person out, because nothing
     * ever reset `failed_count` except a successful sign-in or a lockout. A
     * failure older than the lockout window is no longer evidence of guessing, so
     * the row is dropped and the count starts again. The window is the same
     * fifteen minutes as the lockout — one number, `LOCKOUT_MINUTES`.
     */
    const lastFailure = new Date(String(attempts[0].updated_at)).getTime();
    if (Number.isFinite(lastFailure) && Date.now() - lastFailure > LOCKOUT_MINUTES * 60_000) {
      await q`delete from login_attempts where email_norm = ${emailNorm}`;
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
  /** OUR generated name (`<uuid>.<ext>`). The only name that becomes a path or a URL. */
  filename: string;
  /** The person's own name, sanitised. Shown as text; never a path, URL or header. */
  originalName: string;
  /** Decided from the file's magic bytes, never from what the browser declared. */
  mimeType: string;
  /** The real length of `contentBase64` after decoding. */
  size: number;
  contentBase64: string;
  /**
   * Does this document go to an AI provider? Decided once, in the server
   * function, from `aiMeteringEnabled()` — then written onto the row so the pilot
   * meter (`countDocumentsThisMonth`) and the record itself can never disagree
   * about what was AI work. `false` means we only store it, and storing is
   * unlimited.
   */
  aiMetered: boolean;
};

export type IncomingRequest = {
  userId: string;
  city: string;
  state: string;
  /** A subject key, already validated — the area is derived from it, never sent. */
  subject: SubjectKey;
  message: string;
  phone: string | null;
  documents: IncomingDocument[];
  /**
   * The reading-aid acknowledgement, when the person gave one.
   *
   * Not part of the browser's choice of wording: `version` comes from
   * `READING_AID_VERSION` and `locale` from the visitor's language cookie inside
   * the server function. The browser only ever says "yes, I confirmed it".
   * `null` means no acknowledgement, which is only acceptable for a request
   * carrying no documents — the server function refuses the other combination
   * before this function is reached.
   */
  readingAid: { version: string; locale: string } | null;
};

/**
 * THE WRITE PATH for a case. The only place a request or a document is created.
 *
 * The area of life is not part of the input: it is derived here, from the subject
 * the person picked, through the one mapping in `src/lib/areas.ts`. Each document
 * is stamped with the case's own area — the same value, in the same statement
 * sequence — and the database refuses any document whose area differs from its
 * case's (`documents_request_area_fkey`).
 *
 * The reading-aid acknowledgement is written onto the case itself, in the same
 * INSERT as the area: which wording version, which language, and when. So the
 * record of what the person confirmed lives inside the case, in its own area of
 * life, and cannot drift from the documents it covers.
 */
export async function saveRequest(
  input: IncomingRequest,
): Promise<{
  id: string;
  area: AreaCode;
  documents: { id: string; filename: string; originalName: string }[];
}> {
  await ensureSchema();
  const q = db();
  const requestId = randomUUID();
  const area = areaForSubject(input.subject);
  const readingAid = input.readingAid;
  await q`insert into requests (id, user_id, city, state, subject, area, message, phone,
                                reading_aid_version, reading_aid_locale,
                                reading_aid_confirmed_at)
          values (${requestId}, ${input.userId}, ${input.city}, ${input.state},
                  ${input.subject}, ${area}, ${input.message}, ${input.phone},
                  ${readingAid ? readingAid.version : null},
                  ${readingAid ? readingAid.locale : null},
                  ${readingAid ? new Date() : null})`;
  const documents: { id: string; filename: string; originalName: string }[] = [];
  for (const doc of input.documents) {
    const documentId = randomUUID();
    await q`insert into documents (id, request_id, area, filename, original_name,
                                   mime_type, content_base64, size, ai_metered)
            values (${documentId}, ${requestId}, ${area}, ${doc.filename},
                    ${doc.originalName}, ${doc.mimeType}, ${doc.contentBase64},
                    ${doc.size}, ${doc.aiMetered === true})`;
    documents.push({
      id: documentId,
      filename: doc.filename,
      originalName: doc.originalName,
    });
  }
  return { id: requestId, area, documents };
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
 * IS A DOCUMENT SENT TO AN AI PROVIDER? — the switch the pilot meter reads.
 *
 * Mirrors `AI_ROUTE_CONNECTED` in `src/lib/constants.ts` (the one line to flip
 * when a provider is connected), with one extra: the environment can turn the
 * meter on or off for a single test process (`PILOT_AI_METER=1` / `=0`), which is
 * how `scripts/pilot-cap-check.mjs` exercises the refusal against the real
 * database. Nothing else reads this; the browser cannot set it.
 */
export function aiMeteringEnabled(): boolean {
  const raw = process.env.PILOT_AI_METER?.trim().toLowerCase();
  if (raw === "1" || raw === "on" || raw === "true") return true;
  if (raw === "0" || raw === "off" || raw === "false") return false;
  return AI_ROUTE_CONNECTED;
}

/**
 * The pilot's monthly document cap, in one place.
 *
 * The number itself lives in `MONTHLY_DOCUMENT_CAP` (`src/lib/constants.ts`) so
 * that the client can show it and the smoke test can check it without importing
 * server code. This function only adds the owner's override: `PILOT_DOCUMENT_CAP`
 * in the environment, read the same way `BOOKING_URL` is. A value that is not a
 * whole number of zero or more is ignored in favour of the constant, so a typo in
 * configuration cannot switch the cap off or make it negative.
 */
export function monthlyDocumentCap(): number {
  const raw = process.env.PILOT_DOCUMENT_CAP?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return MONTHLY_DOCUMENT_CAP;
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

/**
 * The contact address shown in the footer. Read from `site.json` so the address
 * is configuration: changing it is an edit to that one file, never a code change.
 * Anything that is not a plain email address is dropped rather than rendered.
 */
export function contactEmail(): string | null {
  const raw = String(siteConfig.contactEmail ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

export type Bootstrap = {
  locale: Locale;
  user: { name: string; email: string } | null;
  bookingUrl: string | null;
  contactEmail: string | null;
};

export async function bootstrap(): Promise<Bootstrap> {
  const sessionUser = await currentUser();
  return {
    locale: currentLocale(),
    user: sessionUser ? { name: sessionUser.name, email: sessionUser.email } : null,
    bookingUrl: bookingUrl(),
    contactEmail: contactEmail(),
  };
}

export { MAX_FILES, MAX_FILE_BYTES, SUBJECT_KEYS };
