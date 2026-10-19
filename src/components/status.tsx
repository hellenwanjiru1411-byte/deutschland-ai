import { Link } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";

import { useApp, useT } from "~/components/app";
import {
  DEFAULT_LOCALE,
  getDictionary,
  languageOf,
  type Locale,
} from "~/i18n";
import appCss from "~/styles/app.css?url";
import siteConfig from "../../site.json";

/**
 * Status and failure screens: the error page, the 404 page and the loading
 * notice. Every word comes from the language files, so translating them is a
 * data change and nothing here can show a stack trace, an error code, a file
 * path or any other internal detail.
 */

/**
 * Log that something failed — and nothing about the person it failed for.
 * No error message (a database message can quote a value), no stack, no
 * filename, no form content, no URL: only where it broke and what kind of
 * error it was, which is what a failure needs to be understood at all.
 */
export function reportFailure(scope: string, error: unknown): void {
  const kind =
    error instanceof Error ? error.name : typeof error === "string" ? "string" : "unknown";
  console.error(`[aie] failure in ${scope}: ${kind}`);
}

/**
 * The contact address for the last-resort screens. The normal pages read it
 * from the server (like the footer does), but the error page must survive the
 * server being the thing that failed — so it reads the same configuration file
 * directly. `site.json` holds no secret: the address is shown in the footer.
 */
function configuredContact(): string | null {
  const raw = String(siteConfig.contactEmail ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}

/**
 * The error page body: a calm sentence, the contact address and a way home.
 *
 * `locale` and `contactEmail` are optional. Without them the screen uses the
 * app context (correct on every page inside the site layout) and falls back to
 * the site's default language plus the configured address, which is what the
 * last-resort screens need: they must not depend on a loader that just failed.
 */
export function ErrorView({
  locale,
  contactEmail,
}: {
  locale?: Locale;
  contactEmail?: string | null;
}) {
  const app = useApp();
  const t = getDictionary(locale ?? app.locale);
  const email = contactEmail ?? app.contactEmail ?? configuredContact();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.error.title}
      </h1>
      <p className="mt-5 text-base leading-relaxed text-muted">{t.error.lead}</p>

      <div className="mt-8 flex justify-center">
        <Link to="/" className="btn-primary">
          {t.nav.home}
        </Link>
      </div>

      {email ? (
        <p className="mt-8 text-sm leading-relaxed text-muted">
          {t.error.contactLead}{" "}
          <a
            href={`mailto:${email}`}
            className="font-semibold break-all text-brand underline underline-offset-4"
          >
            {email}
          </a>
        </p>
      ) : null}
    </section>
  );
}

/**
 * The error screen with a minimal brand line and the legal disclaimer — used
 * when the normal layout cannot be trusted, i.e. when the layout itself is what
 * broke. It renders no loader data and calls nothing.
 */
export function ErrorShell({
  locale = DEFAULT_LOCALE,
  contactEmail,
}: {
  locale?: Locale;
  contactEmail?: string | null;
}) {
  const t = getDictionary(locale);
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-2 sm:h-20 sm:px-6 sm:py-0">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-display text-base font-bold text-ink"
          >
            {t.brand.mark}
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            {t.brand.name}
          </span>
        </div>
      </header>
      <main className="flex-1">
        <ErrorView locale={locale} contactEmail={contactEmail} />
      </main>
      <footer className="mt-16 bg-ink py-8 text-paper">
        <div className="mx-auto w-full max-w-6xl px-4 text-sm leading-relaxed text-paper/70 sm:px-6">
          {t.footer.disclaimer}
        </div>
      </footer>
    </>
  );
}

/**
 * The error page for a crash in the root route itself: the site layout is
 * replaced, so this screen brings its own document. It stays deliberately
 * plain — no router head content, no hydration scripts, no data — because
 * whatever it would read is exactly what may have failed. The link home is an
 * ordinary link, so it works even without JavaScript.
 */
export function RootErrorScreen({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = getDictionary(locale);
  // `lang` and `dir` come from the language registry: the last-resort screen
  // mirrors itself for a right-to-left language like every other page.
  const language = languageOf(locale);
  return (
    <html lang={language.lang} dir={language.dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{`${t.error.title} — ${t.brand.name}`}</title>
        <link rel="stylesheet" href={appCss} />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </head>
      <body className="flex min-h-dvh flex-col bg-paper text-ink">
        <ErrorShell locale={locale} />
      </body>
    </html>
  );
}

/**
 * What a route's own error boundary shows. It sits inside the site layout, so
 * the visitor keeps the header, the footer and the language switch — only the
 * broken page is replaced. The failure is logged without any personal data.
 */
export function RouteErrorScreen({ error }: { error: unknown }) {
  reportFailure("route", error);
  return <ErrorView />;
}

/**
 * 404 page. Every word comes from the language file, so translating it is a
 * data change. Used as the root route's not-found component and as the router's
 * default one, so there is exactly one 404 experience on the site.
 */
export function NotFoundView() {
  const t = useT();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-3xl font-semibold">{t.notFound.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{t.notFound.lead}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-secondary">
          {t.nav.home}
        </Link>
        <Link to="/anliegen" className="btn-primary">
          {t.nav.intake}
        </Link>
      </div>
    </section>
  );
}

/**
 * Shown while a page that needs the server is still loading. It only appears
 * if the wait is long enough to be noticed (see the router's `defaultPendingMs`),
 * so a normal page never flashes a notice at the visitor.
 */
export function LoadingNotice() {
  const t = useT();
  return (
    <section
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-6"
    >
      <p className="text-base text-muted">{t.status.loading}</p>
    </section>
  );
}

/**
 * Last line of defence around the app shell. A React error boundary catches
 * crashes that happen while rendering — the route-level boundaries handle a
 * broken page, this one handles a broken layout — and shows the visitor the
 * same calm error screen instead of an empty page.
 */
export class AppErrorBoundary extends Component<
  { scope: string; fallback: () => ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportFailure(this.props.scope, error);
  }

  render() {
    return this.state.failed ? this.props.fallback() : this.props.children;
  }
}
