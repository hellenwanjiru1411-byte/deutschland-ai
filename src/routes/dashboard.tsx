import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { useT } from "~/components/app";
import { CapabilityCard } from "~/components/capabilities";
import { LoadingNotice, RouteErrorScreen } from "~/components/status";
import { getDictionary, languageOf } from "~/i18n";
import { CAPABILITY_CODES } from "~/lib/capabilities";
import { isSubjectKey } from "~/lib/constants";
import { pageLocale } from "~/lib/page-locale";
import { getDashboard } from "~/server/fns";

/**
 * THE DASHBOARD — where a signed-in person lands.
 *
 * Two things it must do, and one it must not:
 *
 *   1. Show the seven capabilities as cards, each with BOTH routes clearly
 *      labelled — the app with AI, and a human doing it with the person. That is
 *      an owner requirement, so the routes are rendered by the card component
 *      for every capability, never conditionally.
 *   2. Show the person their own cases, grouped by area of life. The cases come
 *      from `listCasesByArea` through `getDashboard`; this page never queries the
 *      database itself, so one area of life cannot appear inside another.
 *   3. NOT claim that anything works which does not. No AI model is connected and
 *      there is no calendar yet, so the AI route says so on every card and the
 *      section above the cards says it in one plain paragraph. The human route is
 *      the one that works today: it is the intake form.
 *
 * RIGHT-TO-LEFT: every class here is logical (`ms-`, `me-`, `ps-`, `pe-`,
 * `text-start`, `border-s`) and nothing is positioned with left/right, so the
 * whole page mirrors itself when the registry declares `dir: "rtl"` for a
 * language. The smoke test fails if a hardcoded direction creeps back in.
 */
export const Route = createFileRoute("/dashboard")({
  // Signed-in people only — a signed-out visitor is sent to the sign-in page,
  // exactly like the intake form. `getDashboard` is a server function: it reads
  // the session cookie and returns only what this page shows.
  loader: async () => {
    const data = await getDashboard();
    if (!data.user) throw redirect({ to: "/anmelden" });
    return data;
  },
  head: async ({ loaderData, matches }) => {
    // The title in the visitor's language, in the server-rendered HTML — see
    // `src/lib/page-locale.ts`.
    const t = getDictionary(await pageLocale(loaderData?.locale, matches));
    return {
      meta: [
        { title: t.meta.dashboardTitle },
        { name: "description", content: t.dashboard.lead },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  // A visible notice while the private page is fetched, and the site's own error
  // screen — never a blank page — if that fails.
  pendingComponent: LoadingNotice,
  errorComponent: RouteErrorScreen,
  // The page is private, so it must never be indexed.
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  component: DashboardPage,
});

function DashboardPage() {
  const t = useT();
  const { locale, user, areas, caseCount } = Route.useLoaderData();
  // The BCP-47 tag of the visitor's language, for dates. It comes from the
  // language registry, so a new language formats dates correctly for free.
  const lang = languageOf(locale).lang;

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.dashboard.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          {t.dashboard.lead}
        </p>
        {user ? (
          <p className="mt-3 text-sm text-muted">
            {t.auth.signedInAs} {user.name}
          </p>
        ) : null}

        {/*
          HONESTY, in one paragraph, before anything else: no AI is connected, so
          the app cannot do the things below yet — and the human route is how help
          happens today. This is not a disclaimer bolted on at the end.
        */}
        <div className="mt-8 rounded-2xl border border-brand/25 bg-brand-soft p-5">
          <h2 className="text-base font-semibold text-brand-dark">
            {t.dashboard.honestyTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            {t.dashboard.honesty}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- your cases */}
      <section
        aria-labelledby="ihre-anliegen"
        className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6"
      >
        <h2
          id="ihre-anliegen"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {t.dashboard.cases.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {t.dashboard.cases.intro}
        </p>

        {caseCount === 0 ? (
          <div className="card mt-6 p-6">
            <p className="text-base font-semibold">
              {t.dashboard.cases.emptyTitle}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {t.dashboard.cases.emptyLead}
            </p>
            <Link to="/anliegen" className="btn-primary mt-5">
              {t.dashboard.cases.emptyCta}
            </Link>
          </div>
        ) : (
          /*
            ONE SECTION PER AREA OF LIFE — never a mixed list. `areas` already
            comes separated from `listCasesByArea`, and the section heading is the
            area's own label in the visitor's language.
          */
          areas.map((group) => (
            <section key={group.area} className="mt-8">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                {t.areas[group.area]}
              </h3>
              <ul className="card mt-3 divide-y divide-line">
                {group.cases.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3.5"
                  >
                    <p className="min-w-0 font-semibold">
                      {/*
                        The database stores the stable subject key, not a label,
                        so it is translated here through the language file. An
                        unknown stored value is shown as it is rather than hidden:
                        a wrong-looking row is a bug we must see.
                      */}
                      {isSubjectKey(item.subject)
                        ? t.intake.subjects[item.subject]
                        : item.subject}
                    </p>
                    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted">
                      <span>
                        {t.dashboard.cases.receivedLabel}:{" "}
                        {formatDate(item.createdAt, lang)}
                      </span>
                      <span>
                        {t.dashboard.cases.documentsLabel}: {item.documentCount}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {/* ------------------------------------------------------ the seven cards */}
      <section
        aria-labelledby="aufgaben"
        className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6"
      >
        <h2 id="aufgaben" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.dashboard.capabilitiesTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {t.dashboard.capabilitiesIntro}
        </p>

        {/*
          Rendered from the closed list in `src/lib/capabilities.ts`, in its order.
          The list is the product order from the business plan, so nothing here has
          to be rearranged when a capability is added — and a capability without
          copy in a language is a build error, not an empty card.
        */}
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {CAPABILITY_CODES.map((code, index) => (
            <CapabilityCard key={code} code={code} position={index + 1} />
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * A date the way the visitor's language writes it.
 *
 * The time zone is fixed to Berlin so the server and the browser always produce
 * the same string — a date that shifts by a day between the server-rendered HTML
 * and the hydrated page would be a visible bug, not a detail. An unreadable value
 * shows a dash instead of "Invalid Date".
 */
function formatDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(date);
  } catch {
    return "—";
  }
}
