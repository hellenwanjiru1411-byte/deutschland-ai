import { Link, createFileRoute } from "@tanstack/react-router";

import { useApp, useT } from "~/components/app";
import { RouteErrorScreen } from "~/components/status";
import { getDictionary } from "~/i18n";
import { pageLocale } from "~/lib/page-locale";

export const Route = createFileRoute("/")({
  head: async ({ loaderData, matches }) => {
    // The visitor's language, resolved so the server-rendered title is right
    // even before any JavaScript runs — see `src/lib/page-locale.ts`.
    const t = getDictionary(await pageLocale(loaderData?.locale, matches));
    return {
      meta: [
        { title: t.meta.homeTitle },
        { name: "description", content: t.meta.homeDescription },
      ],
    };
  },
  errorComponent: RouteErrorScreen,
  component: Home,
});

function Arrow() {
  return (
    // An arrow points the way the text runs: mirrored in a right-to-left
    // language, so it still means "onwards".
    <span aria-hidden="true" className="text-base leading-none rtl:-scale-x-100">
      →
    </span>
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-1 h-5 w-5 shrink-0 text-brand"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  );
}

function Home() {
  const t = useT();
  const { bookingUrl, user } = useApp();

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-14 sm:px-6 sm:pt-16 sm:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* min-w-0 keeps a long word from stretching the grid column, and the
              heading scales down on narrow phones so the word still fits. */}
          <div className="min-w-0">
            <p className="eyebrow">{t.hero.eyebrow}</p>
            {/*
              "Behördenfrust." is one unbreakable German word: at 2.7rem it is
              wider than a 320px phone. It is set smaller on narrow screens,
              hyphenated where the browser can, and only broken as a last resort
              — never hidden or clipped.
            */}
            <h1 className="mt-5 text-[1.95rem] leading-[1.06] font-semibold tracking-tight hyphens-auto break-words min-[360px]:text-[2.35rem] sm:text-6xl sm:leading-[1.03] lg:text-[4.1rem]">
              {t.hero.title}{" "}
              <span className="text-brand">{t.hero.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {t.hero.lead}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/anliegen" className="btn-primary">
                {t.hero.ctaPrimary} <Arrow />
              </Link>
              {user ? null : (
                <Link to="/registrieren" className="btn-secondary">
                  {t.hero.ctaSecondary}
                </Link>
              )}
            </div>

            <p className="mt-6 flex items-center gap-2.5 text-sm text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lime" />
              {t.free}
            </p>
          </div>

          <div className="card p-6 shadow-[0_30px_70px_-45px_rgba(23,35,31,0.55)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t.panel.title}</h2>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold tracking-wide text-brand-dark uppercase">
                {t.footer.pilot}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t.panel.intro}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {t.panel.chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink-soft"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- how it works */}
      <section id="how" className="scroll-mt-24 bg-brand-soft/60 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.how.title}
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {t.how.steps.map((step, index) => (
              <li key={step.title} className="card p-6">
                <span className="font-display text-sm font-bold text-brand">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- services */}
      <section id="services" className="scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.services.title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            {t.services.intro}
          </p>
          <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {t.services.items.map((item) => (
              <li key={item} className="flex gap-3 text-base text-ink-soft">
                <Check />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ newcomers */}
      <section className="bg-brand py-16 text-white sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-14">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.newcomers.title}
            </h2>
            <div>
              <p className="max-w-2xl text-lg leading-relaxed text-white/85">
                {t.newcomers.body}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/anliegen"
                  className="btn bg-lime text-ink hover:bg-white"
                >
                  {t.hero.ctaPrimary} <Arrow />
                </Link>
                {bookingUrl ? (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn border border-white/35 text-white hover:bg-white/10"
                  >
                    {t.booking.cta}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- booking */}
      {bookingUrl ? (
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="card flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t.booking.title}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
                  {t.booking.body}
                </p>
              </div>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary shrink-0"
              >
                {t.booking.cta} <Arrow />
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
