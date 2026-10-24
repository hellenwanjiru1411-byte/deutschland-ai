/**
 * THE ACCESS MODULE — the only place in this codebase that reads a case
 * (`requests`) or a document (`documents`).
 *
 * THE RULE (also written for humans in `docs/areas-of-life.md`):
 *   No route, no server function, no component and no script may assemble its own
 *   query against `requests` or `documents`. Everything reads through this file.
 *   Every accessor takes the viewer and an area of life, and there is no
 *   accessor that returns cases from more than one area except `listCasesByArea`,
 *   which hands them back already separated.
 *
 * WHY IT IS SHAPED THIS WAY: the product promises that nothing crosses between
 * areas of life — a Bürgeramt case must never expose health-insurance documents.
 * A rule that depends on every future call site remembering to add `and area = …`
 * is a rule that will eventually be broken. So the area is not an optional filter
 * here: it is a required argument, it is in the SQL of every query, and the result
 * is passed through `inAreaOnly`, which throws if a row from another area ever
 * comes back.
 *
 * CONFIDENTIALITY: never log a row, a filename or a message from this file. The
 * two error messages below carry no personal data on purpose.
 */
import { sql } from "~/db";
import { inAreaOnly, groupByArea, type AreaCode } from "~/lib/areas";
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

/** The viewer for a signed-in person. The one way to build a Viewer. */
export function viewerForUser(user: { id: string }): Viewer {
  return { userId: user.id, scope: "own" };
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
  createdAt: string;
  documentCount: number;
};

/** One document's metadata. The file contents are fetched separately, never listed. */
export type CaseDocument = {
  id: string;
  requestId: string;
  /** Inherited from the case: a document is never in a different area than its case. */
  area: AreaCode;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
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
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.created_at,
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
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.created_at,
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
  const rows = await q`select d.id, d.request_id, d.area, d.filename, d.mime_type,
                              d.size, d.created_at
                       from documents d
                       where d.request_id = ${parent.id} and d.area = ${area}
                       order by d.created_at asc`;
  return inAreaOnly(
    area,
    rows.map((row) => ({
      id: String(row.id),
      requestId: String(row.request_id),
      area: String(row.area) as AreaCode,
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      size: Number(row.size),
      createdAt: String(row.created_at),
    })),
  );
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
  const rows = await q`select r.id, r.area, r.subject, r.city, r.state, r.created_at,
                              (select count(*) from documents d where d.request_id = r.id)
                                as document_count
                       from requests r
                       where r.user_id = ${viewer.userId}
                       order by r.created_at desc`;
  return groupByArea(rows.map(caseSummary));
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

/* ------------------------------------------------------------------ helpers */

type CaseRow = Record<string, unknown>;

function caseSummary(row: CaseRow): CaseSummary {
  return {
    id: String(row.id),
    area: String(row.area) as AreaCode,
    subject: String(row.subject),
    city: String(row.city),
    state: String(row.state),
    createdAt: String(row.created_at),
    documentCount: Number(row.document_count),
  };
}
