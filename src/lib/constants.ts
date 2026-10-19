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
