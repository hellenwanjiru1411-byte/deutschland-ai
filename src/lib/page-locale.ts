import { DEFAULT_LOCALE, isLocale, resolveLocale, type Locale } from "~/i18n";
import { getPageLocale } from "~/server/fns";

/**
 * Which language the document itself is in — for `head()`, where the title and
 * the description of the server-rendered HTML are decided.
 *
 * Why this exists: `head()` runs while the document is being built, and the
 * match data a route's own head receives is not reliably filled in at that
 * point on the server. Measured on a production build: the root route's head
 * gets its own loader result, but a page without its own loader (the home page,
 * the sign-up and sign-in pages) gets no loader data at all, and the `matches`
 * array carries no loader data on the server. The language is therefore
 * resolved from the first source that actually has it:
 *
 *   1. the route's own loader result, when the framework hands it over
 *      (the root route — this is the same value `<html lang>` is rendered
 *      from, so the title can never disagree with the document language);
 *   2. the language the root route's loader put on its match, when it is there;
 *   3. in the browser, the language the server already put on the document
 *      (`<html lang>`, resolved through the language registry, which matches a
 *      code or a `lang` tag) — the language switcher reloads the page, so
 *      `<html lang>` never goes stale;
 *   4. on the server, the language cookie of the request (a small server call
 *      that reads one cookie and nothing else);
 *   5. German, the site's default language, if none of that works.
 *
 * The result is the same HTML with and without JavaScript, which is the point:
 * the visitor gets the title in their language even before any script runs.
 */
export async function pageLocale(
  loaderDataLocale?: unknown,
  matches?: unknown,
): Promise<Locale> {
  if (isLocale(loaderDataLocale)) return loaderDataLocale;

  const fromMatches = localeFromMatches(matches);
  if (fromMatches) return fromMatches;

  if (typeof document !== "undefined") {
    return resolveLocale(document.documentElement.lang);
  }

  try {
    const { locale } = await getPageLocale();
    return locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * The language the root route's loader resolved, if the framework exposed it.
 * The root match comes first, so the first locale found is the document's.
 */
function localeFromMatches(matches: unknown): Locale | undefined {
  if (!Array.isArray(matches)) return undefined;
  for (const match of matches) {
    const data = (match as { loaderData?: unknown } | null | undefined)
      ?.loaderData;
    if (isLocale(data)) return data;
    const locale = (data as { locale?: unknown } | null | undefined)?.locale;
    if (isLocale(locale)) return locale;
  }
  return undefined;
}
