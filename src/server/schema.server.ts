/**
 * Server-only schema: the tables, and every migration of them.
 *
 * WHY THIS IS ITS OWN MODULE: it is the only file allowed to change the shape of
 * the database, and it imports nothing from the web framework — so the schema
 * (and therefore the area rules it enforces) can be exercised by a plain script
 * as well as by the app.
 *
 * It is imported by `./data.server.ts` and `./access.server.ts`, never by client
 * code.
 *
 * CONFIDENTIALITY: nothing here logs, and the migration below reads a subject and
 * an area code — never a message, a name or a document.
 */
import { sql } from "~/db";
import {
  FALLBACK_AREA,
  areaForSubject,
  type AreaCode,
} from "~/lib/areas";
import { isSubjectKey } from "~/lib/constants";

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
  const q = sql();

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

  /*
   * AREA OF LIFE — a case always belongs to exactly one, and the database says so:
   * `area` is NOT NULL, and it is part of a unique key that documents point at
   * (below), so a document cannot be filed under a different area than its case.
   * The value is one of the codes in `src/lib/areas.ts`; the app can only ever
   * write one of those, because the write path is typed `AreaCode`.
   */
  await q`create table if not exists requests (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    city text not null,
    state text not null,
    subject text not null,
    area text not null,
    message text not null,
    phone text,
    created_at timestamptz not null default now(),
    reading_aid_version text,
    reading_aid_locale text,
    reading_aid_confirmed_at timestamptz
  )`;
  await q`create index if not exists requests_user_id_idx on requests (user_id)`;

  await q`create table if not exists documents (
    id text primary key,
    request_id text not null references requests(id) on delete cascade,
    area text not null,
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

  await migrateAreas();
  await migrateReadingAid();
}

/**
 * The reading-aid acknowledgement columns on `requests`.
 *
 * Three nullable columns, added the same idempotent way as the area column so an
 * existing database is brought up to date on the next start:
 *   - `reading_aid_version`     — which wording of the acknowledgement was confirmed
 *                                 (`READING_AID_VERSION` in `src/lib/constants.ts`),
 *   - `reading_aid_locale`      — the language the person read it in, because the
 *                                 wording exists per language and that is the
 *                                 honest record of what they actually confirmed,
 *   - `reading_aid_confirmed_at`— when they confirmed it.
 *
 * They are NULL when no acknowledgement was given, which is only possible for a
 * request carrying no documents: the server function refuses every other
 * combination before the write path is reached. When they are set, all three are
 * set together by the one write path, so a half-filled record cannot happen.
 */
async function migrateReadingAid(): Promise<void> {
  const q = sql();
  await q`alter table requests add column if not exists reading_aid_version text`;
  await q`alter table requests add column if not exists reading_aid_locale text`;
  await q`alter table requests add column if not exists reading_aid_confirmed_at timestamptz`;
}

/**
 * Brings an existing database up to the area rules. Safe to run on every start,
 * and a no-op once it has run.
 *
 * Rows that predate the column are given the area their subject already implies —
 * the same mapping the app uses, from `src/lib/areas.ts`, so there is no second
 * copy of the decision in SQL. Only then is the column made NOT NULL: a case with
 * no area of life must be impossible, not merely unusual.
 */
async function migrateAreas(): Promise<void> {
  const q = sql();

  await q`alter table requests add column if not exists area text`;
  const unfiled = await q`select id, subject from requests where area is null`;
  for (const row of unfiled) {
    const subject = String(row.subject);
    const area: AreaCode = isSubjectKey(subject)
      ? areaForSubject(subject)
      : FALLBACK_AREA;
    await q`update requests set area = ${area} where id = ${String(row.id)}`;
  }
  await q`alter table requests alter column area set not null`;

  await q`alter table documents add column if not exists area text`;
  // A document takes its case's area. There is no other source for it.
  await q`update documents d set area = r.area
          from requests r
          where d.request_id = r.id and d.area is null`;
  await q`alter table documents alter column area set not null`;

  // The pair (id, area) is what documents point at, so the two can never disagree.
  const constraints = await q`select conname from pg_constraint
                              where conname in ('requests_id_area_key',
                                                'documents_request_area_fkey')`;
  const present = new Set(constraints.map((row) => String(row.conname)));
  if (!present.has("requests_id_area_key")) {
    await q`alter table requests
            add constraint requests_id_area_key unique (id, area)`;
  }
  if (!present.has("documents_request_area_fkey")) {
    await q`alter table documents
            add constraint documents_request_area_fkey
            foreign key (request_id, area) references requests (id, area)
            on delete cascade`;
  }
}
