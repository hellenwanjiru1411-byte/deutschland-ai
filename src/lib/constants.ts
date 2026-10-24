/**
 * Language-independent reference data. These values are stored in the database
 * as they are, so they never change when a new language is added.
 */

/** The 16 federal states, spelled the official way (as on German documents). */
export const STATES: readonly string[] = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];

/**
 * Stable keys for the "what is it about?" field. Labels live in the i18n files.
 *
 * A closed set: the area of life a case belongs to is derived from exactly these
 * keys (see `src/lib/areas.ts`), so a new subject must be given an area or the
 * build fails.
 */
export const SUBJECT_KEYS = [
  "anmeldung",
  "aufenthalt_visa",
  "anerkennung",
  "krankenversicherung",
  "kindergeld",
  "steuern",
  "gewerbe",
  "wohnung",
  "termin_frist",
  "anwalt_gericht",
  "sonstiges",
] as const;

/** One subject the person can pick on the intake form. */
export type SubjectKey = (typeof SUBJECT_KEYS)[number];

/** Is this value one of our subject keys? Narrows, so no cast is needed later. */
export function isSubjectKey(value: unknown): value is SubjectKey {
  return (
    typeof value === "string" &&
    (SUBJECT_KEYS as readonly string[]).includes(value)
  );
}

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_MESSAGE_LENGTH = 20;

/*
 * UPLOAD RULES. Files are stored inside Postgres as base64 text.
 *
 * THE CAPS ARE ENFORCED ON THE REAL BYTES, ON THE SERVER (`src/server/uploads.server.ts`),
 * after base64 is decoded — never on the number the browser declares.
 *   - MAX_FILE_BYTES  — 2 MB per file, measured on the decoded bytes,
 *   - MAX_TOTAL_BYTES — 3 MB for one submission, measured the same way. It is
 *     deliberately below 2 × MAX_FILES: two big phone photos are refused together
 *     even when each one fits, because every stored byte lives in our Postgres
 *     database during the pilot. Raising it is a one-line change here.
 *
 * ALLOWED_FILE_TYPES is a HINT for the file picker (`accept`) and for the
 * immediate message in the browser. It is NOT the gate: the browser's declared
 * type is a string the visitor's browser chooses, so the server decides what a
 * file is from its first bytes (magic bytes) and stores only PDF, JPEG or PNG.
 */
export const MAX_FILES = 2;
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024; // 3 MB per submission
export const ALLOWED_FILE_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;

/* ------------------------------------------------------- pilot safeguards */

/*
 * THE PILOT CAP — ONE NUMBER, AND IT IS A METER ON AI WORK, NOT ON STORING.
 *
 * Owner's rule (Oct 2026): storing and organising documents is unlimited; the
 * limit is on what the AI does with them. So the number below counts documents
 * that are sent to an AI provider, per person, per calendar month. It exists
 * because the owner pays for every letter out of their own pocket during the
 * pilot: it is a limit on OUR bill, never a charge to the person, and it is
 * lifted as soon as funding allows. `src/server/data.server.ts` reads this
 * default and lets the owner override it with the `PILOT_DOCUMENT_CAP`
 * environment variable, so raising it during the pilot is configuration, not a
 * code change.
 *
 * WHAT COUNTS: only documents marked as going to an AI provider — the
 * `documents.ai_metered` column. The counting rule itself is one line in
 * `countDocumentsThisMonth` (`src/server/access.server.ts`); the mark is stamped
 * at write time from `AI_ROUTE_CONNECTED` below, so the whole rule flips with
 * that one constant.
 */
export const MONTHLY_DOCUMENT_CAP = 3;

/*
 * IS THE AI ROUTE CONNECTED? — THE ONE LINE TO FLIP.
 *
 * `false` is the truth today: no model is connected, so the app cannot explain a
 * letter, find a deadline or translate anything, and no document is ever sent to
 * an AI provider. While it is `false`, no document is marked as AI work, the
 * pilot meter therefore stays at 0, and NOTHING a person uploads is refused:
 * storing paperwork is unlimited, exactly as the owner asked.
 *
 * When a provider is chosen and its contract signed, this becomes `true` in the
 * same change: from then on the documents of a request count against
 * `MONTHLY_DOCUMENT_CAP`, and the app refuses those past the limit — still never
 * the storing of paperwork, only the AI work on it.
 *
 * The server also accepts `PILOT_AI_METER=1` / `=0` in the environment, so the
 * rules can be exercised against the real database (`scripts/pilot-cap-check.mjs`)
 * without editing this file. Configuration can turn the meter for a test process;
 * only this constant turns it for the live site.
 */
export const AI_ROUTE_CONNECTED = false;

/*
 * THE READING-AID ACKNOWLEDGEMENT VERSION.
 *
 * Every request that carries documents stores which wording of the reading-aid
 * acknowledgement the person confirmed, plus when. This string is that version.
 * If the wording in ANY language changes, bump it here in the same change: a
 * stored confirmation must always point at the text the person actually read.
 * The version is a plain label, not a date, so it cannot be mistaken for a
 * deadline or a promise.
 */
export const READING_AID_VERSION = "reading-aid-v1";
