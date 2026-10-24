/**
 * A CASE'S STATUS — the small closed set of words that says where a request has
 * got to, and the rules for the notice we send when a document is missing.
 *
 * WHY A STABLE CODE, NOT A SENTENCE: the database stores `received`,
 * `in_progress` or `completed`. The words a person reads come from the language
 * files (`caseStatus.*` in `src/i18n/*.ts`), so a new language never changes what
 * is stored, and a stored value can never be a half-translated sentence.
 *
 * WHO MAY SET IT: only the owner, from the private inbox (`/postfach`), and the
 * rule is enforced in the server function — not by hiding a button. A person
 * never moves their own case: what we say about their paperwork is ours to say,
 * and a status the person can set themselves would be meaningless.
 *
 * There is deliberately no "rejected", "closed" or "archived" state: the pilot
 * has no way to act on them, and a status nobody can honour is a promise in a
 * dropdown. Three states, all of them true today.
 */

export const CASE_STATUSES = ["received", "in_progress", "completed"] as const;

/** Where a case has got to. Stored in the database; never translated, never shown. */
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** The status of a case we have just stored: we have it, we have not started. */
export const DEFAULT_CASE_STATUS: CaseStatus = "received";

/** Is this value one of our statuses? Narrows, so no cast is needed later. */
export function isCaseStatus(value: unknown): value is CaseStatus {
  return (
    typeof value === "string" &&
    (CASE_STATUSES as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------ the notice */

/*
 * THE NOTICE WE SEND WHEN A DOCUMENT IS MISSING.
 *
 * Owner's direction (business plan, current focus 10): the owner asks for a
 * specific missing document from inside the app. No e-mail is involved — we have
 * no inbox and no e-mail integration — so the notice is a row in our own
 * database that the person sees on their own list, in their own language.
 *
 * TWO RULES THE COPY HAS TO KEEP, and the smoke test checks them:
 *   - it is from US. The notice says "Nachricht von AIE Deutschland" and never
 *     reads as if an authority had asked. No authority's name or logo appears.
 *   - it is ONE short line, and the person can put it away. It is a request, not
 *     a demand: it never blocks anything, it never repeats, and dismissing it
 *     removes it from their list for good.
 *
 * The bounds are here so the field cannot become a free-text channel of arbitrary
 * length: short enough that the person reads it in one go.
 */
export const NOTICE_MIN_LENGTH = 10;
export const NOTICE_MAX_LENGTH = 600;
