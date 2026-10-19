# Areas of life

The product's promise is that **nothing crosses between areas of life**: a
person's Bürgeramt case must never let that office see their health-insurance
documents, and a helper working on a housing case must never be able to read a
residence case. This document is the rule, where it lives in the code, and how
the next stage (the owner's inbox) must build on it without re-deciding any of it.

Everything here is enforced by code, not by good intentions: the mapping is
exhaustive at compile time, the database refuses a document whose area differs
from its case's, and the smoke test fails if a new file starts reading cases on
its own.

---

## 1. What an area is

A **closed set of nine areas**, each with a **stable internal code** that is never
translated and never shown:

| Code | German label | English label |
| --- | --- | --- |
| `residence` | Aufenthalt und Einwanderung | Residence and immigration |
| `health_insurance` | Krankenversicherung | Health insurance |
| `taxes` | Steuern | Taxes |
| `family` | Familie und Kindergeld | Family and child benefit |
| `housing` | Wohnen und Miete | Housing and rent |
| `work` | Arbeit und Selbstständigkeit | Work and self-employment |
| `appointments` | Termine und Fristen | Appointments and deadlines |
| `legal` | Recht und Gericht | Legal and court |
| `other` | Sonstiges | Other (the fallback) |

The codes live in `AREA_CODES` in **`src/lib/areas.ts`**. The labels live in the
language files under **`areas.*`** (`src/i18n/de.ts`, `src/i18n/en.ts`, and every
language added later), so an area translates like every other word on the site.
German's `areas` object is typed `satisfies Record<AreaCode, string>`: a new area
code without German copy is a build error, and every other language must match
the German shape or the build fails too.

**A case belongs to exactly one area.** It is stored on the request (`requests.area`,
`NOT NULL`) and on each of its documents (`documents.area`, `NOT NULL`).

## 2. Where the mapping lives — one place, one question

The person picks a **subject** on the intake form ("Aufenthalt und Visa",
"Krankenversicherung", …). They are never asked a second question about the area.
The area is derived from that subject in **one place only**:

```ts
// src/lib/areas.ts
export const SUBJECT_AREA: Record<SubjectKey, AreaCode> = {
  anmeldung: "residence",
  aufenthalt_visa: "residence",
  anerkennung: "work",
  krankenversicherung: "health_insurance",
  kindergeld: "family",
  steuern: "taxes",
  gewerbe: "work",
  wohnung: "housing",
  termin_frist: "appointments",
  anwalt_gericht: "legal",
  sonstiges: "other",
};
```

`Record<SubjectKey, AreaCode>` is the exhaustiveness guarantee: **a subject with
no area is a build error, not a silent default**, and only a declared area code
can be the answer. `SubjectKey` comes from `SUBJECT_KEYS` in
`src/lib/constants.ts`, which is a closed `as const` list for the same reason.

Rules that follow from this:

- **Never** infer an area from a message, a filename, a city or a keyword. If a
  new subject is needed, add it to `SUBJECT_KEYS` *and* to `SUBJECT_AREA` — the
  build will tell you if you forget the second one.
- **Never** store a translated label. The database holds the code; the label is
  looked up from the language file at the moment it is shown
  (`t.areas[areaCode]`).
- **Never** ask the person which area their case is in. The subject they already
  chose answers it.

The single write path is `saveRequest()` in **`src/server/data.server.ts`**. It
takes a validated `SubjectKey` (not an area, and certainly not an area from the
browser), derives the area, and stamps it on the request and on every document of
that request in the same call. The database backs this up: `documents` has a
foreign key `(request_id, area) → requests (id, area)`, so a document whose area
differs from its case's is rejected by Postgres itself.

Existing rows: the migration in `src/server/schema.server.ts` (`migrateAreas`)
fills `requests.area` from the row's own subject using the same
`SUBJECT_AREA` mapping — not a second copy of it in SQL — then copies each
request's area onto its documents, and only then makes both columns `NOT NULL`.
A row that predates the column therefore never stays `null`, and an unknown
subject falls back to `other` rather than blocking the migration.

## 3. The one module every read must go through

**`src/server/access.server.ts`** is the only place that reads a case or a
document. No route, no server function, no component, no script may write its own
`select … from requests` or `… from documents`.

Every accessor takes the viewer **and the area of life**:

```ts
listCasesInArea(viewer, area)            // the viewer's cases in ONE area
getCaseInArea(viewer, area, requestId)   // one case, or null if it is not in that area
listDocumentsInArea(viewer, area, requestId)
listCasesByArea(viewer)                  // every area, already separated into buckets
```

How the guarantee is made structural rather than a convention:

- **The area is a required argument, not an optional filter.** There is no
  `listCases(viewer)` that returns a flat list of everything. A caller that wants
  one area's cases has to name the area, and a caller that wants the whole picture
  gets a `Map<AreaCode, CaseSummary[]>` — separated, one bucket at a time.
- **The area is in the SQL of every query** (`where … and r.area = ${area}`), so
  the database never returns another area's row to begin with.
- **Every result is passed through `inAreaOnly(area, rows)`** (in
  `src/lib/areas.ts`), which keeps only the requested area and **throws** if it
  had to drop anything. A row from another area coming back means a query lost its
  filter — a bug that must be seen, not quietly filtered away. There is no
  argument that widens it.
- **The parent is checked before the children.** `listDocumentsInArea` first asks
  `getCaseInArea` for the case; if the case is not the viewer's, or not in that
  area, the answer is `null` and no document is read at all. Asking for a case id
  through the wrong area returns "not found", not an error — from that area's
  point of view the case does not exist.

**The smoke test enforces the rule, not just this document.** `bun run smoke`
reads the source tree and fails if any file outside
`src/server/access.server.ts` (and the schema module, whose migration reads the
rows it fills in) contains a read of `requests`/`documents`, or if any file
outside the write path and the schema module writes to them. It also checks that
every subject maps to a declared area, that every language labels every area, and
that `inAreaOnly` really does refuse a mixed set.

### What is *not* yet guaranteed

Say this plainly in reviews rather than assuming otherwise:

- **The access module has no consumer in the app yet.** There is no inbox and no
  case list, so no page reads a case today; the module is exercised by the
  verification run described in the pull request, and the inbox (next stage) is
  its first real caller. The rule above is what makes that safe to build on.
- **One person, one account.** `Viewer` is `{ userId, scope: "own" }`. A helper's
  scope does not exist yet (see §4) — until it does, "who may see this" means "the
  person whose case it is", and nothing else.
- **The database enforces area consistency, not the closed set of codes.** A
  `CHECK (area in (…))` constraint would duplicate the code list in SQL; instead
  the closed set is enforced by TypeScript on the only write path, and by the
  composite foreign key for the request↔document agreement. Manual `psql` access
  could still write an unknown string — nothing in the app can.

## 4. Design note for the next stages (not built)

Two things are deliberately **not** built yet, with the shape they should take so
the next stage does not have to rethink the model.

### 4a. Helper scoping — one helper sees only their assigned case, in one area

`Viewer` gains a second variant. Nothing outside `access.server.ts` changes,
because every read already takes the viewer:

```ts
export type Viewer =
  | { scope: "own"; userId: string }
  | { scope: "helper"; userId: string; assignedRequestIds: readonly string[] };
```

and every `where` clause gains one condition:

```sql
where … and r.user_id = ${viewer.userId}   -- own
-- or, for a helper:
where … and r.id = any(${viewer.assignedRequestIds}::text[])
```

The assignment table, one row per (helper, case) — the `area` is copied in and
tied to the case by the same composite key, so an assignment can never be made in
a different area than the case:

```sql
create table case_helpers (
  request_id     text not null,
  helper_user_id text not null references users(id) on delete cascade,
  area           text not null,
  assigned_at    timestamptz not null default now(),
  primary key (request_id, helper_user_id),
  foreign key (request_id, area) references requests (id, area) on delete cascade
);
create index case_helpers_helper_idx on case_helpers (helper_user_id);
```

A helper needs a role on `users` (or a separate `helpers` table) before this is
switched on; that, the legal check the business plan requires before human help is
staffed, and the "we must say so honestly" wording for the person whose case is
shared, all belong to that stage.

### 4b. The access log — "you can see who looked at what"

Every read that returns a case or a document writes one row. The `area` is copied
at write time so the log itself can be read per area without joining back to a
case the reader might not be allowed to see:

```sql
create table case_access_log (
  id            text primary key,
  request_id    text not null references requests(id) on delete cascade,
  area          text not null,
  actor_user_id text not null references users(id) on delete cascade,
  actor_role    text not null,           -- 'owner' | 'helper' | 'system'
  action        text not null,           -- 'view' | 'download' | 'delete' | 'assign'
  created_at    timestamptz not null default now()
);
create index case_access_log_request_idx on case_access_log (request_id, created_at desc);
```

Rules for whoever builds it: it is written by `access.server.ts` only (the same
one-read-path rule), it stores **no** filename, message or document content — ids
and actions only, because it is itself personal data — and the person can see it
for their own case, per area, in plain language ("Ihr Fall wurde am … von …
angesehen").

---

## 5. Checklist for anyone adding a case read (the inbox, next stage)

1. Read only through `src/server/access.server.ts`. If the accessor you need does
   not exist, add it **there** — with the area as a required argument — not in the
   route.
2. Build the `Viewer` from the signed-in session (`viewerForUser`), never from
   anything the browser sends.
3. Show the area label from the language file (`t.areas[code]`); never print the
   code, never store the label.
4. Run `bun run smoke` — it fails if a read escaped the module.
5. If the change alters what may be seen, update this document in the same pull
   request.
