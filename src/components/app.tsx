import { Link } from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  getDictionary,
  LOCALES,
  LOCALE_LABELS,
  LOCALE_NAMES,
  type Dictionary,
  type Locale,
} from "~/i18n";
import { setLanguage, signOut } from "~/server/fns";

export type AppUser = { name: string; email: string } | null;

export type AppState = {
  locale: Locale;
  user: AppUser;
  bookingUrl: string | null;
  /** From `site.json` — the one contact route the site offers. */
  contactEmail: string | null;
};

const AppContext = createContext<AppState>({
  locale: "de",
  user: null,
  bookingUrl: null,
  contactEmail: null,
});

export function AppProvider({
  value,
  children,
}: {
  value: AppState;
  children: ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  return useContext(AppContext);
}

/** The dictionary for the visitor's current language. */
export function useT(): Dictionary {
  return getDictionary(useContext(AppContext).locale);
}

/* -------------------------------------------------------------- brand mark */

export function BrandMark({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-display text-base font-bold text-ink ${className}`}
    >
      {t.brand.mark}
    </span>
  );
}

function Wordmark() {
  const t = useT();
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={t.brand.name}>
      <BrandMark />
      <span className="font-display text-lg font-bold tracking-tight">
        {t.brand.name}
      </span>
    </Link>
  );
}

/* ------------------------------------------------------ language switcher */

/**
 * Language switcher. The choice is stored in a cookie on the server and the page
 * then reloads, so the server-rendered `<html lang>` and the page title are right
 * immediately — there is no flash of the wrong language.
 *
 * While the choice is being saved the visitor sees that it is happening, and if
 * saving fails the page does NOT pretend the language changed: it says so and
 * stays where it is.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(next: Locale) {
    if (next === locale || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await setLanguage({
        data: { locale: next, next: window.location.pathname + window.location.search },
      });
      window.location.reload();
    } catch {
      // The language was not saved — reloading here would leave the visitor on
      // the same page with no explanation, so tell them instead.
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <div
        role="group"
        aria-label={t.lang.label}
        className={`flex items-center rounded-full border border-line bg-surface p-0.5 ${className}`}
      >
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              onClick={() => void choose(code)}
              disabled={busy}
              aria-busy={busy}
              aria-current={active ? "true" : undefined}
              title={LOCALE_NAMES[code]}
              className={`min-w-9 rounded-full px-2.5 py-1.5 text-xs font-bold tracking-wide transition disabled:opacity-60 ${
                active ? "bg-brand text-white" : "text-ink-soft hover:text-brand"
              }`}
            >
              {LOCALE_LABELS[code]}
            </button>
          );
        })}
      </div>
      {busy ? (
        <span role="status" className="max-w-[13rem] text-xs leading-tight text-ink-soft">
          {t.lang.switching}
        </span>
      ) : null}
      {failed ? (
        <span role="alert" className="max-w-[13rem] text-xs leading-tight text-brand">
          {t.errors.generic}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ header */

/**
 * Sign out. The label says that it is happening, and if ending the session
 * fails the visitor stays on the page with a short message rather than being
 * sent home looking signed in.
 */
function SignOutButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <button
        type="button"
        className="btn-ghost min-h-11 px-1.5 text-sm sm:px-5"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await signOut();
            window.location.href = "/";
          } catch {
            setFailed(true);
            setBusy(false);
          }
        }}
      >
        {busy ? t.nav.signingOut : t.nav.signOut}
      </button>
      {failed ? (
        <span role="alert" className="max-w-[13rem] text-xs leading-tight text-brand">
          {t.errors.generic}
        </span>
      ) : null}
    </span>
  );
}

export function Header() {
  const { user, bookingUrl } = useApp();
  const t = useT();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      {/*
        On phones the header wraps onto two rows instead of being clipped: the
        brand on the first row, the language switch and the account links on the
        second. From `sm` up it stays a single row exactly as before.
      */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:h-20 sm:flex-nowrap sm:px-6 sm:py-0">
        <Wordmark />

        <nav
          aria-label={t.nav.label}
          className="hidden items-center gap-7 text-sm font-medium text-ink-soft lg:flex"
        >
          <Link to="/" hash="how" className="transition hover:text-brand">
            {t.nav.how}
          </Link>
          <Link to="/" hash="services" className="transition hover:text-brand">
            {t.nav.services}
          </Link>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-brand"
            >
              {t.booking.cta}
            </a>
          ) : null}
        </nav>

        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-x-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link
                to="/anliegen"
                className="btn-primary px-3.5 text-[13px] sm:px-5 sm:text-sm"
              >
                {t.nav.intake}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                to="/anmelden"
                className="inline-flex min-h-11 items-center px-1.5 text-sm font-semibold text-ink-soft transition hover:text-brand"
              >
                {t.nav.signIn}
              </Link>
              <Link
                to="/registrieren"
                className="btn-primary px-3.5 text-[13px] sm:px-5 sm:text-sm"
              >
                {t.nav.signUp}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ footer */

export function Footer() {
  const t = useT();
  const { user, contactEmail } = useApp();

  return (
    <footer className="mt-20 bg-ink text-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="font-display text-lg font-bold tracking-tight">
                {t.brand.name}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-paper/70">{t.free}</p>
          </div>

          <div className="flex flex-col gap-4">
            <nav
              aria-label={t.footer.navLabel}
              className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/80"
            >
              <Link to="/anliegen" className="transition hover:text-lime">
                {t.nav.intake}
              </Link>
              {user ? null : (
                <>
                  <Link to="/anmelden" className="transition hover:text-lime">
                    {t.nav.signIn}
                  </Link>
                  <Link to="/registrieren" className="transition hover:text-lime">
                    {t.nav.signUp}
                  </Link>
                </>
              )}
            </nav>

            {/*
              CONTACT — the owner's address, read from `site.json` so it is
              configuration, not copy. It is the only contact route on the site:
              no phone number, no postal address, no opening hours.
            */}
            {contactEmail ? (
              <p className="text-sm text-paper/80">
                {t.footer.contactLabel}{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-semibold break-all text-lime underline underline-offset-4 transition hover:text-white"
                >
                  {contactEmail}
                </a>
              </p>
            ) : null}
          </div>
        </div>

        {/*
          LEGAL DISCLAIMER — comes from the language file. Before any new language
          goes live, this sentence has to be checked by a native speaker: it is a
          legal statement, not marketing copy. Never machine-translate it.
        */}
        <p className="mt-10 max-w-3xl border-t border-paper/15 pt-6 text-sm leading-relaxed text-paper/70">
          {t.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
