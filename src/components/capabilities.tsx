import { Link } from "@tanstack/react-router";

import { useT } from "~/components/app";
import type { CapabilityCode } from "~/lib/capabilities";

/**
 * ONE CAPABILITY CARD — and, on purpose, the place where a capability grows.
 *
 * Every card shows **both routes side by side and clearly labelled**: the app
 * doing it with AI, and a human doing it with the person. That is an owner
 * requirement — nobody should have to guess whether a machine or a person is
 * dealing with their paperwork — so the two panels are structurally identical on
 * every card and differ only in colour, status and what they say.
 *
 * HONESTY: no AI model is connected yet, so the AI panel says it is not
 * available, and `aiNote` says what the app cannot do on *this* capability. The
 * human route is real today: it is the intake form (`/anliegen`), and during the
 * pilot the human is the team itself.
 *
 * ROOM FOR THE NEXT STAGE (the app's own calendar): the card is a self-contained
 * component keyed by capability code, and the slot marked below is where a
 * capability's own widget mounts — the calendar and its reminders go there, in
 * the `manage_appointments` card, and nothing on this page has to be reworked for
 * it. The page renders the cards from `CAPABILITY_CODES`, so a card is never
 * written out by hand.
 */
export function CapabilityCard({
  code,
  position,
}: {
  code: CapabilityCode;
  /** 1-based place in the product order — language-neutral, so it works in every language. */
  position: number;
}) {
  const t = useT();
  const copy = t.capabilities[code];

  return (
    <li className="card flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand"
        >
          {position}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">{copy.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/*
          The two routes. They are rendered for every capability, built or not:
          a card that shows only one route would be exactly the guessing game the
          owner does not want.
        */}
        <div className="rounded-xl border border-line bg-paper p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
            {t.dashboard.routes.aiLabel}
          </p>
          <p className="mt-2 inline-flex rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
            {t.dashboard.routes.aiStatus}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.aiNote}</p>
        </div>

        <div className="rounded-xl border border-brand/30 bg-brand-soft p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-dark">
            {t.dashboard.routes.humanLabel}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
            {t.dashboard.routes.humanStatus}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{copy.humanNote}</p>
          <Link to="/anliegen" className="prose-link mt-2 inline-block text-sm">
            {t.dashboard.routes.humanCta}
          </Link>
        </div>
      </div>

      {/*
        ↑ THE SLOT for a capability's own widget (the calendar for
        `manage_appointments`). It belongs here, inside this card and inside this
        list item, so adding it changes this component and nothing else.
      */}
    </li>
  );
}
