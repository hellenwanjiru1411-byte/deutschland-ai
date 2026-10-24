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
import { DEFAULT_CASE_STATUS, type CaseStatus } from "~/lib/cases";
import { DEFAULT_USER_ROLE, isOwnerRole, isUserRole, type UserRole } from "~/lib/roles";
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

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  /**
   * `person` or `owner`. Read from the row, never from the browser: the only way
   * an account becomes the owner is `OWNER_EMAIL` matching its address (see
   * `currentUser` below), and the only page that uses it is the owner's inbox.
   */
  role: UserRole;
};

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
    // Every new account is a `person`. The database default says the same thing,
    // and it is written out here so the intent is visible where the row is made.
    await q`insert into users (id, name, email, email_norm, password_hash, role)
            values (${id}, ${input.name.trim()}, ${input.email.trim()}, ${emailNorm},
                    ${passwordHash}, ${DEFAULT_USER_ROLE})`;
  } catch {
    // Unique index raced with another sign-up for the same address.
    return { ok: false, code: "email_taken" };
  }
  return {
    ok: true,
    user: {
      id,
      name: input.name.trim(),
      email: input.email.trim(),
      role: DEFAULT_USER_ROLE,
    },
  };
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
    await q`select id, name, email, role, password_hash from users where email_norm = ${emailNorm} limit 1`;
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
    user: {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: isUserRole(row.role) ? row.role : DEFAULT_USER_ROLE,
    },
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

/**
 * A signed-in account, with the normalised address kept alongside it.
 *
 * `emailNorm` exists for exactly one purpose — `promoteOwnerIfNamed` comparing the
 * account with `OWNER_EMAIL` — and it never leaves the server: `PublicUser` (what
 * the pages get) has no such field, and nothing puts it in a URL, a header or a
 * log line.
 */
type SessionUser = PublicUser & { emailNorm: string };

export async function userForToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 256) return null;
  await ensureSchema();
  const q = db();
  const rows = await q`select u.id, u.name, u.email, u.email_norm, u.role
                       from sessions s join users u on u.id = s.user_id
                       where s.token_hash = ${hashToken(token)} and s.expires_at > now()
                       limit 1`;
  if (rows.length === 0) return null;
  return {
    id: String(rows[0].id),
    name: String(rows[0].name),
    email: String(rows[0].email),
    role: isUserRole(rows[0].role) ? rows[0].role : DEFAULT_USER_ROLE,
    emailNorm: String(rows[0].email_norm),
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
  await q`insert into requests (id, user_id, city, state, subject, area, status, message,
                                phone, reading_aid_version, reading_aid_locale,
                                reading_aid_confirmed_at)
          values (${requestId}, ${input.userId}, ${input.city}, ${input.state},
                  ${input.subject}, ${area}, ${DEFAULT_CASE_STATUS}, ${input.message},
                  ${input.phone},
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

/* ------------------------------------------------------- the case's status */

/**
 * Move one case to another status. The only place a status is written.
 *
 * WHO MAY CALL IT: only the owner's server function (`ownerSetCaseStatus` in
 * `./fns`), which refuses anybody whose stored role is not `owner` before it
 * reaches this line. This function does not authorise anything itself — like
 * `saveRequest`, it is a write path, and the rule lives one level up where the
 * caller is known.
 *
 * It answers with the case id when a row changed, and `null` when none did — a
 * case that no longer exists, which the caller reports as "not found" rather than
 * as a success.
 */
export async function setCaseStatus(input: {
  requestId: string;
  status: CaseStatus;
}): Promise<string | null> {
  await ensureSchema();
  const q = db();
  const rows = await q`update requests set status = ${input.status}
                       where id = ${input.requestId}
                       returning id`;
  return rows.length > 0 ? String(rows[0].id) : null;
}

/* ------------------------------------------------------- deleting a case */

/**
 * DELETE A CASE AND EVERYTHING THAT BELONGS TO IT — for real, from the table.
 *
 * `where id = … and user_id = …` is one statement and the ownership condition is
 * inside it: even if a caller passed someone else's case id, no row would match
 * and nothing would be deleted. That is deliberate belt and braces, because this
 * is the one function that removes a person's papers.
 *
 * WHAT GOES WITH IT: the documents (two foreign keys, both `on delete cascade` —
 * `documents.request_id` and the area pair `documents_request_area_fkey`) and the
 * notices about missing documents. Nothing is hidden, nothing is marked deleted,
 * and there is no `deleted_at`: after this statement the rows are gone, which is
 * what "I want my data deleted" has to mean. It is also why the page asks the
 * person to confirm first, with the number of documents it is about to remove.
 */
export async function deleteCase(input: {
  requestId: string;
  userId: string;
}): Promise<boolean> {
  await ensureSchema();
  const q = db();
  const rows = await q`delete from requests
                       where id = ${input.requestId} and user_id = ${input.userId}
                       returning id`;
  return rows.length > 0;
}

/* --------------------------------------------- a document added to a case */

/**
 * Add documents to a case that already exists — the "attach the missing
 * document" path, reached from a notice on the person's own list.
 *
 * THE AREA IS NOT TAKEN FROM THE CALLER'S OPINION: it is read from the case by
 * `getOwnCase` in `./access.server` (which also proves the case belongs to the
 * signed-in person) and passed in, and the foreign key `documents_request_area_fkey`
 * then refuses any document whose area differs from its case's. If the case has
 * gone in between the two statements, that same foreign key fails and this
 * answers `not_found` — the honest answer, not a document hanging in mid-air.
 *
 * THE READING-AID ACKNOWLEDGEMENT: an upload always carries one, so the caller
 * refuses a document without it before reaching this line. It is stamped on the
 * case only when the case has no acknowledgement yet (a case filed without
 * documents); a case that already carries one keeps the wording its person
 * actually confirmed for the documents already there.
 *
 * THE NOTICE IS ANSWERED HERE, not by the person: as soon as a document lands on
 * the case, every open notice about that case is marked fulfilled. So the person
 * cannot tick "done" without sending anything, and the owner stops waiting the
 * moment the document arrives.
 */
export async function addDocumentToCase(input: {
  requestId: string;
  area: AreaCode;
  documents: IncomingDocument[];
  readingAid: { version: string; locale: string } | null;
}): Promise<
  | { ok: true; documents: { id: string; filename: string; originalName: string }[] }
  | { ok: false; code: "not_found" }
> {
  await ensureSchema();
  const q = db();
  const stored: { id: string; filename: string; originalName: string }[] = [];

  try {
    for (const doc of input.documents) {
      const documentId = randomUUID();
      await q`insert into documents (id, request_id, area, filename, original_name,
                                     mime_type, content_base64, size, ai_metered)
              values (${documentId}, ${input.requestId}, ${input.area}, ${doc.filename},
                      ${doc.originalName}, ${doc.mimeType}, ${doc.contentBase64},
                      ${doc.size}, ${doc.aiMetered === true})`;
      stored.push({
        id: documentId,
        filename: doc.filename,
        originalName: doc.originalName,
      });
    }
  } catch {
    // The case was deleted between the accessor's read and this write, so the
    // foreign key refused the row. Nothing is written under a case that is gone.
    return { ok: false, code: "not_found" };
  }

  if (input.readingAid) {
    await q`update requests
            set reading_aid_version = coalesce(reading_aid_version, ${input.readingAid.version}),
                reading_aid_locale = coalesce(reading_aid_locale, ${input.readingAid.locale}),
                reading_aid_confirmed_at = coalesce(reading_aid_confirmed_at, now())
            where id = ${input.requestId}`;
  }

  if (stored.length > 0) {
    await q`update request_notices set fulfilled_at = now()
            where request_id = ${input.requestId} and fulfilled_at is null`;
  }

  return { ok: true, documents: stored };
}

/* ---------------------------------------------------- notices about a case */

/**
 * The owner asks for one specific missing document. The only place a notice is
 * created.
 *
 * WHO MAY CALL IT: `ownerRequestDocument` in `./fns`, which refuses anybody whose
 * stored role is not `owner`. The notice is from us — AIE Deutschland — and the
 * words the person reads say so (`myRequests.noticeFrom` in the language files);
 * nothing here claims to be an authority, and no authority's name is involved.
 */
export async function createNotice(input: {
  requestId: string;
  message: string;
}): Promise<string | null> {
  await ensureSchema();
  const q = db();
  const id = randomUUID();
  try {
    await q`insert into request_notices (id, request_id, message)
            values (${id}, ${input.requestId}, ${input.message})`;
  } catch {
    // The case does not exist (or was deleted a moment ago): the foreign key
    // refused the row, and there is nobody to ask.
    return null;
  }
  return id;
}

/**
 * The person puts a notice away. `dismissed_at` is stamped, the row is kept.
 *
 * The ownership condition is not in this statement (that would mean reading
 * `requests` from the write path); the caller checks the notice belongs to the
 * signed-in person through the access module first, and the statement is keyed on
 * the notice id it got back. A dismissed notice never appears again and is never
 * re-sent: dismissing is a decision, not a snooze.
 */
export async function dismissNotice(input: {
  noticeId: string;
}): Promise<boolean> {
  await ensureSchema();
  const q = db();
  const rows = await q`update request_notices set dismissed_at = now()
                       where id = ${input.noticeId} and dismissed_at is null
                       returning id`;
  return rows.length > 0;
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
 *
 * THE ONE PLACE AN ACCOUNT BECOMES THE OWNER. `OWNER_EMAIL` is an environment
 * variable in the business's own secrets store. When it is set and a signed-in
 * account's normalised address equals it, the stored role is set to `owner` once
 * and from then on read from the row. Nothing else in the codebase promotes
 * anybody, no page can ask for the role, and the browser never sends it.
 *
 * WITH `OWNER_EMAIL` UNSET, NOBODY IS EVER PROMOTED: the inbox answers "not found"
 * to every account that has not already been given the role. An account that
 * already holds `owner` keeps it — the stored role is the truth, and taking it
 * away is a deliberate change to the row, not a side effect of a missing variable.
 */
export async function currentUser(): Promise<PublicUser | null> {
  if (!dbConfigured()) return null;
  const token = readSessionCookie();
  if (!token) return null;
  try {
    const user = await userForToken(token);
    if (!user) return null;
    const role = await promoteOwnerIfNamed(user);
    const { emailNorm: _emailNorm, ...publicUser } = user;
    return { ...publicUser, role };
  } catch {
    return null;
  }
}

/**
 * `OWNER_EMAIL`, normalised, or null when it is not set or is not an address.
 *
 * Read from the environment like `PILOT_DOCUMENT_CAP` and `BOOKING_URL`; a value
 * that is not a plain address is ignored rather than half-trusted, so a typo in
 * configuration cannot quietly make some other account the owner.
 */
export function ownerEmail(): string | null {
  const raw = process.env.OWNER_EMAIL?.trim();
  if (!raw) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return normalizeEmail(raw);
}

/**
 * Give this account the owner role if `OWNER_EMAIL` names it, and answer with the
 * role to use for this request either way.
 *
 * A failed update does not throw: the answer is then simply the role already on
 * the row (`person`), which is the safe answer — the person keeps seeing their own
 * cases, and the inbox stays closed.
 */
async function promoteOwnerIfNamed(user: SessionUser): Promise<UserRole> {
  if (user.role === "owner") return "owner";
  const named = ownerEmail();
  if (!named || named !== user.emailNorm) return user.role;
  try {
    const q = db();
    await q`update users set role = 'owner' where id = ${user.id}`;
    return "owner";
  } catch {
    return user.role;
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
  /**
   * Is the signed-in account the owner? It decides exactly one thing: whether the
   * header offers a link to the private inbox. It is NOT the access rule — the
   * inbox checks the role on the server for every request, so a browser that
   * flipped this boolean would get a 404 page, not a case list.
   */
  isOwner: boolean;
  bookingUrl: string | null;
  contactEmail: string | null;
};

export async function bootstrap(): Promise<Bootstrap> {
  const sessionUser = await currentUser();
  return {
    locale: currentLocale(),
    user: sessionUser ? { name: sessionUser.name, email: sessionUser.email } : null,
    isOwner: isOwnerRole(sessionUser?.role),
    bookingUrl: bookingUrl(),
    contactEmail: contactEmail(),
  };
}

export { MAX_FILES, MAX_FILE_BYTES, SUBJECT_KEYS };
