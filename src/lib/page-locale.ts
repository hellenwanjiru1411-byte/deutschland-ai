import { DEFAULT_LOCALE, isLocale, resolveLocale, type Locale } from "~/i18n";
import { getPageLocale } from "~/server/fns";

/**
 * Which language the document itself is in — for `head()`, where the title and
 * the description of the server-rendered HTML are decided.
 *
 * Why this exists: `head()` runs while the document is being built, and the
 * match data a route's own head receives is not reliably filled in at that
 * point on the server. The language is therefore resolved from what is always
 * available:
 *
 *   1. the route's own loader result, when the framework hands it over;
 *   2. on the server, the language cookie of the request (a small server call);
 *   3. in the browser, the language the server already put on the document,
 *      which is the same decision — the language switcher reloads the page, so
 *      `<html lang>` never goes stale;
 *   4. German, the site's default language, if none of that works.
 *
 * The result is the same HTML with and without JavaScript, which is the point:
 * the visitor gets the title in their language even before any script runs.
 */
export async function pageLocale(loaderDataLocale?: unknown): Promise<Locale> {
  if (isLocale(loaderDataLocale)) return loaderDataLocale;

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
