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

/** Stable keys for the "what is it about?" field. Labels live in the i18n files. */
export const SUBJECT_KEYS: readonly string[] = [
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
];

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
