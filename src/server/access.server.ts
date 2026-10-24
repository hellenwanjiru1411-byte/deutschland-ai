/**
 * THE ACCESS MODULE — the only place in this codebase that reads a case
 * (`requests`) or a document (`documents`).
 *
 * THE RULE (also written for humans in `docs/areas-of-life.md`):
 *   No route, no server function, no component and no script may assemble its own
 *   query against `requests` or `documents`. Everything reads through this file.
 *   Every accessor takes the viewer and, where a case is named, the area of life
 *   it belongs to.
 *
 * WHY IT IS SHAPED THIS WAY: the product promises that nothing crosses between
 * areas of life — a Bürgeramt case must never expose health-insurance documents.
 * A rule that depends on every future call site remembering to add `and area = …`
 * is a rule that will eventually be broken. So the area is not an optional filter
 * here: it is a required argument, it is in the SQL of every query, and the result
 * is passed through `inAreaOnly`, which throws if a row from another area ever
 * comes back.
 *
 * THE ACCESSORS THAT RETURN MORE THAN ONE AREA, AND WHY THEY ARE SAFE:
 *   - `listCasesByArea` hands cases back **grouped**, one bucket per area, so a
 *     caller can never read across areas by accident (the dashboard uses it).
 *   - `listOwnCases` (stage 10) hands back ONE PERSON'S OWN cases newest first,
 *     each row carrying its own area. It is what a person's own list needs — "my
 *     requests, newest first" — and it is not a way to see across areas: every
 *     row is the viewer's own, and the area label on a row describes that row and
 *     nothing else. Documents are still read per case through an area-checked
 *     accessor, and no row of another person can appear: `user_id` is in the SQL.
 *   - `listAllCasesForOwner` is the owner's casework view: every person's cases,
 *     reachable only with an `OwnerViewer`, which only `viewerForOwner` can build
 *     and which throws for any account whose role is not `owner`. It is one
 *     owner's view of the whole pilot, not a way for one person to see another:
 *     the rows are still grouped by case, and a person's list never uses it.
 *
 * CONFIDENTIALITY: never log a row, a filename or a message from this file. The
 * error messages below carry no personal data on purpose.
 */
import { sql } from "~/db";
import { inAreaOnly, isAreaCode, groupByArea, type AreaCode } from "~/lib/areas";
import { DEFAULT_CASE_STATUS, isCaseStatus, type CaseStatus } from "~/lib/cases";
import { isOwnerRole, type UserRole } from "~/lib/roles";
import { ensureSchema } from "./schema.server";

/* ------------------------------------------------------------------- viewer */

/**
 * Who is asking.
 *
 * Today the only viewer is the person whose cases these are: they see their own
 * cases and nothing else. When human help is staffed (business plan: helpers with
 * their own accounts, each seeing only the case assigned to them) this type gains
 * a second variant carrying the assigned case ids, and the WHERE clauses below
 * gain one condition. Nothing outside this file has to change — that is the point
 * of routing every read through here.
 */
export type Viewer = {
  /** The signed-in person's id. Never a value from the browser. */
  userId: string;
  /** `"own"` = this person's own cases. The helper scope is not built yet. */
  scope: "own";
};

/**
 * The owner's viewer — the ONLY way to read every person's cases.
 *
 * It is a different type from `Viewer` on purpose: `listAllCasesForOwner` cannot
 * be called with a person's viewer, because the compiler will not accept it. And
 * it cannot be built by hand either, because `viewerForOwner` below is the only
 * function that returns one and it refuses any account whose stored role is not
 * `owner`. Two conditions, one of which is checked by the type system.
 *
 * WHEN A HELPER ACCOUNT IS ADDED (not built, and nothing here blocks it): the same
 * shape carries `scope: "assigned"` with the case ids that helper may see, and
 * `viewerForHelper` builds it the same way — so every accessor's WHERE clause
 * gains one condition and no call site changes. The owner's inbox stays keyed to
 * `"owner"`, which is why adding a helper does not widen it.
 */
export type OwnerViewer = {
  userId: string;
  scope: "owner";
};

/** The viewer for a signed-in person. The one way to build a Viewer. */
export function viewerForUser(user: { id: string }): Viewer {
  return { userId: user.id, scope: "own" };
}

/**
 * The viewer for the owner's casework view. Throws for every other account.
 *
 * The role comes from the account row (`users.role`), read on the server from the
 * session cookie — never from a request body. A person who somehow reached the
 * owner's page gets an exception here, which the page turns into "not found".
 */
export function viewerForOwner(user: { id: string; role: UserRole }): OwnerViewer {
  if (!isOwnerRole(user.role)) {
    throw new Error("access: an owner view needs an owner account");
  }
  return { userId: user.id, scope: "owner" };
}

/* -------------------------------------------------------------------- types */

/** One case, as much of it as a list needs. */
export type CaseSummary = {
  id: string;
  /** The area of life this case belongs to. Always the area that was asked for. */
  area: AreaCode;
  subject: string;
  city: string;
  state: string;
  /** Where the case has got to. Set by the owner only (`src/lib/cases.ts`). */
  status: CaseStatus;
  /** What the person wrote. Their own words, shown back to them and to the owner. */
  message: string;
  createdAt: string;
  documentCount: number;
};

/** One document's metadata. The file contents are fetched separately, never listed. */
export type CaseDocument = {
  id: string;
  requestId: string;
  /** Inherited from the case: a document is never in a different area than its case. */
  area: AreaCode;
  /** The name we generated. The only one used in a URL or a header. */
  filename: string;
  /** The person's own filename, shown as text so they recognise what they sent. */
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

/**
 * One notice about a missing document (`request_notices`).
 *
 * `dismissedAt` and `fulfilledAt` are null while the notice is open: it is what
 * the person sees on their list and what the owner is still waiting for.
 */
export type CaseNotice = {
  id: string;
  requestId: string;
  /** What the owner asked for, in their own words. From us, never from an authority. */
  message: string;
  createdAt: string;
  dismissedAt: string | null;
  fulfilledAt: string | null;
};

/**
 * One document's contents, for a download. Never listed, never cached: it is read
 * only when the person asks for that one file (`getDocumentForDownload` below).
 */
export type StoredDocument = {
  id: string;
  area: AreaCode;
  /** The name we generated at upload time — the only one used in a URL or header. */
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
};

/* -------------------------------------------------------------------- reads */

/**
 * The viewer's cases **in one area of life**, newest first.
 *
 * There is deliberately no "all my cases" variant that returns a flat list: the
 * whole promise is that one area cannot see another. Callers that genuinely need
 * the full picture ask `listCasesByArea` and get it already separated.
 */
export async function listCasesInArea(
  viewer: Viewer,
  area: AreaCode,
): Promise<CaseSummary[]> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                              r.message, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.user_id = ${viewer.userId} and r.area = ${area}
                       order by r.created_at desc`;
  return inAreaOnly(area, rows.map(caseSummary));
}

/**
 * One case, but only if it belongs to this viewer **and** sits in the given area.
 *
 * Asking for a case id through the wrong area returns `null` — it is not an error,
 * because from that area's point of view the case does not exist. That is what
 * "nothing crosses between areas" has to mean at the code level.
 */
export async function getCaseInArea(
  viewer: Viewer,
  area: AreaCode,
  requestId: string,
): Promise<CaseSummary | null> {
  if (!requestId) return null;
  await ensureSchema();
  const q = sql();
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                              r.message, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.id = ${requestId}
                         and r.user_id = ${viewer.userId}
                         and r.area = ${area}
                       limit 1`;
  const kept = inAreaOnly(area, rows.map(caseSummary));
  return kept[0] ?? null;
}

/**
 * The documents of one case, inside one area of life.
 *
 * The case is checked first through `getCaseInArea`, so a document can only be
 * reached by a viewer who may see its case, through the case's own area. The
 * document query repeats the area condition as well — belt and braces, because
 * this is the query that hands out someone's papers.
 */
export async function listDocumentsInArea(
  viewer: Viewer,
  area: AreaCode,
  requestId: string,
): Promise<CaseDocument[]> {
  const parent = await getCaseInArea(viewer, area, requestId);
  if (!parent) return [];
  const q = sql();
  const rows = await q`select d.id, d.request_id, d.area, d.filename, d.original_name,
                              d.mime_type, d.size, d.created_at
                       from documents d
                       where d.request_id = ${parent.id} and d.area = ${area}
                       order by d.created_at asc`;
  return inAreaOnly(area, rows.map(caseDocument));
}

/**
 * The viewer's cases, grouped by area of life — one bucket per area, never a
 * mixed list. This is what the dashboard (next stage) is allowed to use: it can
 * show one card per area, and no card can contain another area's case.
 */
export async function listCasesByArea(
  viewer: Viewer,
): Promise<Map<AreaCode, CaseSummary[]>> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                              r.message, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.user_id = ${viewer.userId}
                       order by r.created_at desc`;
  return groupByArea(rows.map(caseSummary));
}

/**
 * One document's BYTES, for the person who owns it — and for nobody else.
 *
 * This is the only read of `documents.content_base64` in the codebase. It is
 * reached from one place, the download route (`src/routes/dokument.$id.ts`), which
 * serves the file as an attachment with the type we decided at upload time.
 *
 * The area is not an argument here, because the browser only ever knows a document
 * id and must not be able to name an area: the document's own area is read from
 * the row, and the join to `requests` proves both that the viewer owns the case
 * and that the document sits in the same area as its case (`d.area = r.area`, the
 * pair the database itself enforces through `documents_request_area_fkey`). A
 * document of another person, or of another area, is simply not found.
 */
export async function getDocumentForDownload(
  viewer: Viewer,
  documentId: string,
): Promise<StoredDocument | null> {
  if (!documentId || documentId.length > 64) return null;
  await ensureSchema();
  const q = sql();
  const rows = await q`select d.id, d.area, d.filename, d.mime_type, d.size,
                              d.content_base64
                       from documents d
                       join requests r on r.id = d.request_id
                       where d.id = ${documentId}
                         and r.user_id = ${viewer.userId}
                         and d.area = r.area
                       limit 1`;
  if (rows.length === 0) return null;
  const area = String(rows[0].area) as AreaCode;
  const row = rows[0];
  const stored: StoredDocument = {
    id: String(row.id),
    area,
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    contentBase64: String(row.content_base64),
  };
  // The same guard the list reads use: a row from another area must never be
  // handed back, even if a future query forgot a condition.
  return inAreaOnly(area, [stored])[0] ?? null;
}

/**
 * THE PILOT METER — how many of this viewer's documents the AI has taken on in
 * the current calendar month. **Documents stored but not AI work are not
 * counted.**
 *
 * This is a read of `documents`, so it belongs here and nowhere else. It returns
 * one number and nothing else: no filenames, no cases, no areas. The number is
 * used for one purpose only — the pilot's monthly cap on our own AI bill — and it
 * never leaves our database for a third party. There is no tracker involved.
 *
 * THE COUNTING RULE (one line, on purpose): only documents marked
 * `ai_metered` count. Owner's rule, Oct 2026 — archiving and organising paperwork
 * is unlimited; the limit is a meter on what the AI does with a letter, because
 * that is what costs money. `ai_metered` is stamped when a document is written
 * (`saveRequest` in `./data.server`), from the one switch `AI_ROUTE_CONNECTED` in
 * `src/lib/constants.ts`. While no provider is connected, `ai_metered` is `false`
 * for every row, this returns 0, and nothing anyone uploads is refused.
 *
 * To change what the cap counts, change the one condition `and d.ai_metered`
 * below — and nothing else in the codebase.
 *
 * The month is a German calendar month (`Europe/Berlin`), because the people this
 * serves live in Germany and "this month" has to mean their month, not UTC's.
 */
export async function countDocumentsThisMonth(viewer: Viewer): Promise<number> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select count(*)::int as used
                       from documents d
                       join requests r on r.id = d.request_id
                       where r.user_id = ${viewer.userId}
                         and d.ai_metered
                         and d.created_at >= (
                           date_trunc('month', now() at time zone 'Europe/Berlin')
                             at time zone 'Europe/Berlin'
                         )`;
  return Number(rows[0]?.used ?? 0);
}

/* ------------------------------------------------ the person's own list */

/**
 * THE PERSON'S OWN CASES, NEWEST FIRST — the read behind `/meine-anliegen`.
 *
 * Every row is the viewer's own (`r.user_id` is in the SQL) and carries its own
 * area of life, so the page can label each case without ever mixing two areas in
 * one bucket. It is not a way to read across areas: a row's area describes that
 * row, the documents are still read through the area-checked accessor below, and
 * no row of another person can come back.
 *
 * A row whose area is not one of our codes throws rather than rendering: that can
 * only mean the database was edited by hand, and a silent wrong label is worse
 * than a visible failure.
 */
export async function listOwnCases(viewer: Viewer): Promise<CaseSummary[]> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                              r.message, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.user_id = ${viewer.userId}
                       order by r.created_at desc, r.id desc`;
  return rows.map(caseSummary).map(knownArea);
}

/**
 * Every document of the viewer's own cases, in one read — the list page shows
 * them under each case, and one query is enough for a pilot of thirty people.
 *
 * The join carries the area rule in both directions: `d.area = r.area` (the pair
 * the database enforces through `documents_request_area_fkey`) and
 * `r.user_id = …`. A document can therefore only appear for the person whose case
 * it belongs to, in its own case's area.
 */
export async function listDocumentsForOwnCases(
  viewer: Viewer,
): Promise<CaseDocument[]> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select d.id, d.request_id, d.area, d.filename, d.original_name,
                              d.mime_type, d.size, d.created_at
                       from documents d
                       join requests r on r.id = d.request_id
                       where r.user_id = ${viewer.userId} and d.area = r.area
                       order by d.created_at asc`;
  return rows.map(caseDocument).map(knownArea);
}

/**
 * The notices that are still open on the viewer's own cases.
 *
 * "Open" is `dismissed_at is null and fulfilled_at is null`: the person has not
 * put it away, and no document has arrived since it was written. A dismissed or
 * answered notice is never shown again, which is what keeps the notice from
 * nagging — one line, once.
 */
export async function listOpenNoticesForOwnCases(
  viewer: Viewer,
): Promise<CaseNotice[]> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select n.id, n.request_id, n.message, n.created_at,
                              n.dismissed_at, n.fulfilled_at
                       from request_notices n
                       join requests r on r.id = n.request_id
                       where r.user_id = ${viewer.userId}
                         and n.dismissed_at is null
                         and n.fulfilled_at is null
                       order by n.created_at desc`;
  return rows.map(caseNotice);
}

/**
 * One of the viewer's own cases, by id, whatever area it is in.
 *
 * This is the read the "attach the missing document" path makes before it writes:
 * it proves the case belongs to the signed-in person and hands back the case's own
 * area, which is what the write needs (a document never gets to choose its area).
 * Asking for someone else's case id returns `null` — the same answer as for an id
 * that does not exist, so nothing can be learned by guessing.
 */
export async function getOwnCase(
  viewer: Viewer,
  requestId: string,
): Promise<CaseSummary | null> {
  if (!requestId || requestId.length > 64) return null;
  await ensureSchema();
  const q = sql();
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                              r.message, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.id = ${requestId} and r.user_id = ${viewer.userId}
                       limit 1`;
  if (rows.length === 0) return null;
  return knownArea(caseSummary(rows[0]));
}

/**
 * One notice, but only if it belongs to one of the viewer's own cases.
 *
 * Used by the dismiss path: the ownership check happens here, and the write is
 * then keyed on the notice id this function returned. A notice of another person
 * is `null`, exactly like a notice that does not exist.
 */
export async function getOwnNotice(
  viewer: Viewer,
  noticeId: string,
): Promise<CaseNotice | null> {
  if (!noticeId || noticeId.length > 64) return null;
  await ensureSchema();
  const q = sql();
  const rows = await q`select n.id, n.request_id, n.message, n.created_at,
                              n.dismissed_at, n.fulfilled_at
                       from request_notices n
                       join requests r on r.id = n.request_id
                       where n.id = ${noticeId} and r.user_id = ${viewer.userId}
                       limit 1`;
  if (rows.length === 0) return null;
  return caseNotice(rows[0]);
}

/* ------------------------------------------- the owner's casework view */

/**
 * ONE CASE IN THE OWNER'S VIEW: the case, the person who sent it, their documents
 * and every notice about it (open, dismissed or answered).
 *
 * The person's details are the ones they gave us at registration — their own name
 * and e-mail address, nothing else. There is no master profile here and none is
 * built: the row holds what the person typed on the form, and the case holds what
 * they wrote about it. That is the whole record.
 */
export type OwnerCase = CaseSummary & {
  person: { name: string; email: string };
  phone: string | null;
  documents: CaseDocument[];
  notices: CaseNotice[];
};

/**
 * EVERY PERSON'S CASES, NEWEST FIRST — the read behind `/postfach`.
 *
 * Reachable only with an `OwnerViewer` (see `viewerForOwner` above), which is a
 * type a person's viewer cannot be and a value only the owner's role can build.
 * This is the owner handling cases personally during the pilot, not an officer
 * console: no authority is involved, no organisation tenancy exists, and the rows
 * are the same rows the person sees on their own list.
 *
 * Three queries rather than one join, so nothing has to be de-duplicated in SQL:
 * the cases, then the documents of those cases, then the notices. A case with no
 * documents and no notices is still a case and appears with empty lists.
 */
export async function listAllCasesForOwner(
  owner: OwnerViewer,
): Promise<OwnerCase[]> {
  assertOwnerScope(owner);
  await ensureSchema();
  const q = sql();

  const caseRows = await q`select r.id, r.area, r.subject, r.city, r.state, r.status,
                                  r.message, r.phone, r.created_at,
                                  u.name as person_name, u.email as person_email,
                                  (select count(*) from documents d where d.request_id = r.id)
                                    as document_count
                           from requests r
                           join users u on u.id = r.user_id
                           order by r.created_at desc, r.id desc`;

  const documentRows = await q`select d.id, d.request_id, d.area, d.filename,
                                      d.original_name, d.mime_type, d.size, d.created_at
                               from documents d
                               join requests r on r.id = d.request_id
                               where d.area = r.area
                               order by d.created_at asc`;

  const noticeRows = await q`select n.id, n.request_id, n.message, n.created_at,
                                    n.dismissed_at, n.fulfilled_at
                             from request_notices n
                             order by n.created_at desc`;

  const documentsByCase = new Map<string, CaseDocument[]>();
  for (const row of documentRows.map(caseDocument).map(knownArea)) {
    const bucket = documentsByCase.get(row.requestId);
    if (bucket) bucket.push(row);
    else documentsByCase.set(row.requestId, [row]);
  }

  const noticesByCase = new Map<string, CaseNotice[]>();
  for (const row of noticeRows.map(caseNotice)) {
    const bucket = noticesByCase.get(row.requestId);
    if (bucket) bucket.push(row);
    else noticesByCase.set(row.requestId, [row]);
  }

  return caseRows.map((row) => ({
    ...knownArea(caseSummary(row)),
    person: {
      name: String(row.person_name),
      email: String(row.person_email),
    },
    phone: row.phone ? String(row.phone) : null,
    documents: documentsByCase.get(String(row.id)) ?? [],
    notices: noticesByCase.get(String(row.id)) ?? [],
  }));
}

/**
 * One document's BYTES, for the owner handling the case — and only for the owner.
 *
 * The mirror of `getDocumentForDownload` below, and deliberately a separate
 * function with its own query: this one has no ownership condition because the
 * owner may read every case, so it must be impossible to reach it by accident with
 * a person's viewer. The type does that — it takes an `OwnerViewer`, which only
 * `viewerForOwner` builds. It is reached from one place, the owner's download link
 * (`/dokument/<id>?als=owner` is NOT a thing: the route asks the session which
 * scope it has, see `src/routes/dokument.$id.ts`).
 */
export async function getDocumentForOwner(
  owner: OwnerViewer,
  documentId: string,
): Promise<StoredDocument | null> {
  assertOwnerScope(owner);
  if (!documentId || documentId.length > 64) return null;
  await ensureSchema();
  const q = sql();
  const rows = await q`select d.id, d.area, d.filename, d.mime_type, d.size,
                              d.content_base64
                       from documents d
                       where d.id = ${documentId}
                       limit 1`;
  if (rows.length === 0) return null;
  const row = rows[0];
  const area = String(row.area) as AreaCode;
  return knownArea({
    id: String(row.id),
    area,
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    contentBase64: String(row.content_base64),
  });
}

/* ------------------------------------------------------------------ helpers */

type CaseRow = Record<string, unknown>;

/**
 * The multi-area counterpart of `inAreaOnly`.
 *
 * Accessors that hand back rows from more than one area (a person's own list, the
 * owner's inbox) cannot compare against a single area, so they check the other
 * thing that must hold: every row's area is one of our codes. A row whose area we
 * do not recognise can only come from a hand-edited database, and a page must fail
 * visibly rather than label a person's case with nothing.
 */
function knownArea<T extends { area: AreaCode }>(row: T): T {
  if (!isAreaCode(row.area)) {
    throw new Error("access: a read returned a row with no known area");
  }
  return row;
}

/**
 * Belt and braces for the owner's viewer: the type already says `scope: "owner"`,
 * but a value could in principle have been cast into it, so the scope is checked
 * once more at the door of every owner-only read.
 */
function assertOwnerScope(owner: OwnerViewer): void {
  if (owner.scope !== "owner") {
    throw new Error("access: an owner read needs an owner viewer");
  }
}

function caseSummary(row: CaseRow): CaseSummary {
  return {
    id: String(row.id),
    area: String(row.area) as AreaCode,
    subject: String(row.subject),
    city: String(row.city),
    state: String(row.state),
    // An unknown stored value becomes `received` rather than throwing: a case
    // whose status we cannot read is still a case we have, and the database's
    // CHECK constraint means this can only happen after a hand edit.
    status: isCaseStatus(row.status) ? row.status : DEFAULT_CASE_STATUS,
    message: String(row.message ?? ""),
    createdAt: String(row.created_at),
    documentCount: Number(row.document_count),
  };
}

function caseDocument(row: CaseRow): CaseDocument {
  const filename = String(row.filename);
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    area: String(row.area) as AreaCode,
    filename,
    // Rows written before `original_name` existed have none; their own generated
    // name is then the honest label — never an empty line.
    originalName: String(row.original_name ?? "") || filename,
    mimeType: String(row.mime_type),
    size: Number(row.size),
    createdAt: String(row.created_at),
  };
}

function caseNotice(row: CaseRow): CaseNotice {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    message: String(row.message),
    createdAt: String(row.created_at),
    dismissedAt: row.dismissed_at ? String(row.dismissed_at) : null,
    fulfilledAt: row.fulfilled_at ? String(row.fulfilled_at) : null,
  };
}
