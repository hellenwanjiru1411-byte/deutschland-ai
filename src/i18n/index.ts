import { de, type Dictionary } from "./de";
import { en } from "./en";

/**
 * Locale registry. Adding a third language is a data change:
 *   1. write `src/i18n/<code>.ts` and export a dictionary of the same shape,
 *   2. import it and add it here,
 *   3. add its code to `LOCALES`.
 * The switcher in the header, the cookie and `<html lang>` all read from this list.
 */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie that remembers the visitor's language. Plain data, no secrets in it. */
export const LANG_COOKIE = "lang";

const DICTIONARIES: Record<Locale, Dictionary> = { de, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export type { Dictionary };

/** Short label shown in the language switcher (always in the target language). */
export const LOCALE_LABELS: Record<Locale, string> = { de: "DE", en: "EN" };

export const LOCALE_NAMES: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};
