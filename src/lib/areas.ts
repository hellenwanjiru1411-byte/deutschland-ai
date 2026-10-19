/**
 * AREAS OF LIFE — the closed set, and the one mapping from subject to area.
 *
 * The product's central promise is that nothing crosses between areas of life: a
 * person's Bürgeramt case must never let that office see their health-insurance
 * documents. That promise starts here.
 *
 * Two rules, both enforced by the type system:
 *
 *   1. An area is a **stable internal code** (`residence`, `health_insurance`, …).
 *      It is what the database stores. The user-visible label lives in the
 *      language files (`areas.*` in `src/i18n/*.ts`) and is looked up by code, so
 *      a new language never changes what is stored.
 *   2. The area is **derived from the subject the person already picks**, in
 *      `SUBJECT_AREA` below and nowhere else. The person is never asked twice.
 *      `SUBJECT_AREA` is typed `Record<SubjectKey, AreaCode>`, so a new subject
 *      without an area — or an area that does not exist — is a build error, never
 *      a silent default.
 *
 * This module is pure data and pure functions: no database, no React, no
 * cookies. It is imported by the client (to show a label), by the server (to
 * store and filter) and by the smoke test (to check the mapping).
 *
 * The full rule — and the one module every read must go through — is in
 * `docs/areas-of-life.md`.
 */
import { type SubjectKey } from "./constants";

/**
 * Every area of life, in the order the product presents them.
 *
 * Closed set: adding one is a deliberate change here, a label in every language
 * file, and a mapping below — all three are build errors if forgotten.
 */
export const AREA_CODES = [
  "residence",
  "health_insurance",
  "taxes",
  "family",
  "housing",
  "work",
  "appointments",
  "legal",
  "other",
] as const;

/** An area of life. Stored in the database; never translated, never shown. */
export type AreaCode = (typeof AREA_CODES)[number];

/** The fallback area. A subject that genuinely fits nowhere goes here. */
export const FALLBACK_AREA: AreaCode = "other";

/** Is this value one of our area codes? */
export function isAreaCode(value: unknown): value is AreaCode {
  return typeof value === "string" && (AREA_CODES as readonly string[]).includes(value);
}

/**
 * THE MAPPING — subject (what the person picked) to area of life.
 *
 * This is the only place in the codebase where that decision is made. Nothing
 * else may infer an area from a subject, a message or a filename.
 *
 * `Record<SubjectKey, AreaCode>` is the exhaustiveness guarantee: every subject
 * must appear, and only a declared area code may be the answer.
 */
export const SUBJECT_AREA: Record<SubjectKey, AreaCode> = {
  // Registering an address is a matter for the Bürgeramt, and it is what the
  // residence paperwork is built on — the same office, the same area of life.
  anmeldung: "residence",
  aufenthalt_visa: "residence",
  // Recognition of a foreign qualification exists to let someone work.
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

/** The area of life for a subject the person picked. Total: every subject has one. */
export function areaForSubject(subject: SubjectKey): AreaCode {
  return SUBJECT_AREA[subject];
}

/** A row that carries an area — a request or a document read from the database. */
export type AreaBearing = { area: string };

/**
 * THE GUARD. Every read in `src/server/access.server.ts` passes its rows through
 * this before returning them.
 *
 * It keeps only rows of the requested area, and it **throws** if it had to drop
 * anything: a row from another area coming back means the query lost its area
 * filter, which is a bug we must see rather than quietly filter away. There is
 * no argument that widens it — you cannot ask it for "all areas".
 */
export function inAreaOnly<T extends AreaBearing>(
  area: AreaCode,
  rows: readonly T[],
): T[] {
  const kept = rows.filter((row) => row.area === area);
  if (kept.length !== rows.length) {
    // No ids, no names, no contents: a bug report, not personal data.
    throw new Error("access: a read returned rows outside the requested area");
  }
  return kept;
}

/**
 * Group rows by area, keeping only areas that actually occur.
 *
 * Used where the product genuinely needs the whole picture *per area* (for
 * example a dashboard with one card per area of life). The result is a map, not
 * a flat list, so there is no way to read across areas by accident: you get one
 * bucket at a time, and every bucket is re-checked by `inAreaOnly`.
 */
export function groupByArea<T extends AreaBearing>(
  rows: readonly T[],
): Map<AreaCode, T[]> {
  const collected = new Map<AreaCode, T[]>();
  for (const row of rows) {
    if (!isAreaCode(row.area)) {
      throw new Error("access: a read returned a row with no known area");
    }
    const bucket = collected.get(row.area);
    if (bucket) bucket.push(row);
    else collected.set(row.area, [row]);
  }
  const grouped = new Map<AreaCode, T[]>();
  for (const area of AREA_CODES) {
    const bucket = collected.get(area);
    if (bucket) grouped.set(area, inAreaOnly(area, bucket));
  }
  return grouped;
}
