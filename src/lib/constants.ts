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

/** Upload rules. Files are stored inside Postgres as base64 text. */
export const MAX_FILES = 2;
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const ALLOWED_FILE_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;

/* ------------------------------------------------------- pilot safeguards */

/*
 * THE PILOT DOCUMENT CAP — one number, and this is the only place it is written.
 *
 * The owner pays for every letter out of their own pocket during the pilot, so the
 * number of documents one person may send is counted and limited. The owner's
 * draft figure (Oct 2026) is 3 per person per calendar month; it is a limit on
 * OUR bill, never a charge to the person, and it is lifted as soon as funding
 * allows. `src/server/data.server.ts` reads this default and lets the owner
 * override it with the `PILOT_DOCUMENT_CAP` environment variable, so raising the
 * cap during the pilot is configuration, not a code change.
 *
 * WHAT COUNTS: every document sent with a request (see `countDocumentsThisMonth`
 * in `src/server/access.server.ts`). Today that is the same as "every document
 * uploaded", because no AI provider is connected yet. The owner has NOT decided
 * whether the cap should later count documents actually sent to an AI provider
 * instead of uploads — when that decision is taken, the counting rule changes in
 * that one function and nowhere else.
 */
export const MONTHLY_DOCUMENT_CAP = 3;

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
