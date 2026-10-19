import { de, type Dictionary } from "./de";
import { en } from "./en";

/**
 * THE LANGUAGE REGISTRY — the one place that knows which languages this site has.
 *
 * Adding a language is a data change and nothing else:
 *   1. write `src/i18n/<code>.ts`, exporting a dictionary with the same shape as
 *      `de` (missing or misspelled keys stop the build — that is the point),
 *   2. add one entry to `LANGUAGES` below.
 * Nothing else in the app names a language: the visible switcher, `<html lang>`,
 * `<html dir>`, the server-side language resolution and the smoke test all read
 * this list, so a new entry reaches every one of them at once.
 *
 * The full procedure — including what a native speaker has to check before a new
 * language goes live — is in `docs/adding-a-language.md`.
 */

/** Text direction. `rtl` mirrors the whole layout, right-to-left. */
export type Direction = "ltr" | "rtl";

/** Everything the app needs to know about one language. */
export type Language = {
  /** Short code: what the language cookie holds and what code refers to. */
  code: string;
  /** The `lang` attribute — a BCP-47 tag, usually equal to `code` (`de`, `pt-BR`). */
  lang: string;
  /** Writing direction. `rtl` for Arabic, Hebrew, Persian, Urdu. */
  dir: Direction;
  /** Switcher label, written in the language itself (`DE`, `EN`, `ع`). */
  label: string;
  /** Full name in the language itself — the switcher button's tooltip. */
  name: string;
  /** The translated strings. */
  dictionary: Dictionary;
};

/**
 * Every language of the site, in the order the switcher shows them.
 *
 * The FIRST entry is the default: the language a visitor gets with no cookie,
 * and the last-resort language of the failure screens.
 */
export const LANGUAGES = [
  {
    code: "de",
    lang: "de",
    dir: "ltr",
    label: "DE",
    name: "Deutsch",
    dictionary: de,
  },
  {
    code: "en",
    lang: "en",
    dir: "ltr",
    label: "EN",
    name: "English",
    dictionary: en,
  },
] as const satisfies readonly Language[];

/** The default language: the first entry above. */
export const DEFAULT_LANGUAGE: Language = LANGUAGES[0];

/** The language codes, in registry order. */
export const LOCALES: readonly string[] = LANGUAGES.map((language) => language.code);

/** A code the registry actually declares, e.g. `"de" | "en"`. */
export type Locale = (typeof LANGUAGES)[number]["code"];

/** Cookie that remembers the visitor's language. Plain data, no secrets in it. */
export const LANG_COOKIE = "lang";

export const DEFAULT_LOCALE: Locale = LANGUAGES[0].code;

/** One registry entry, with its literal `code` and `dir` kept. */
type LanguageEntry = (typeof LANGUAGES)[number];

const BY_CODE = new Map<string, Language>(
  LANGUAGES.map((language) => [language.code, language] as const),
);

/*
 * A repeated code would make one of the two languages unreachable and silently
 * serve the other one's strings. It is a developer mistake, not a visitor
 * situation, so it fails loudly and immediately at startup instead.
 */
if (BY_CODE.size !== LANGUAGES.length) {
  throw new Error("i18n: the language registry declares the same code twice");
}

const BY_TAG = new Map<string, LanguageEntry>();
for (const language of LANGUAGES) {
  BY_TAG.set(language.code.toLowerCase(), language);
  BY_TAG.set(language.lang.toLowerCase(), language);
}

/** Is this value one of our language codes? */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && BY_CODE.has(value);
}

/**
 * The visitor's language from any value we may hold: a cookie, a `lang`
 * attribute, a `lang` tag such as `de-DE`. Anything unknown — including
 * `undefined` — becomes the default language.
 */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  return BY_TAG.get(value.trim().toLowerCase())?.code ?? DEFAULT_LOCALE;
}

/** The registry entry for a code, or the default language's entry. */
export function languageOf(locale: Locale): Language {
  return BY_CODE.get(locale) ?? DEFAULT_LANGUAGE;
}

/** The dictionary for a language. */
export function getDictionary(locale: Locale): Dictionary {
  return languageOf(locale).dictionary;
}

export type { Dictionary };
