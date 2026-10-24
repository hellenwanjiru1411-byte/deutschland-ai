/**
 * THE PILOT METER'S ARITHMETIC — one rule, no database, no framework.
 *
 * Owner's rule (Oct 2026): archiving documents is unlimited; the pilot limit is a
 * meter on **AI work** — the documents that go to an AI provider — because that is
 * the only thing that costs the owner money per use. A person may therefore store
 * as many documents as they like, and only the AI work is counted.
 *
 * This file holds that rule in its purest form so it can be checked without
 * touching Postgres or a browser: the smoke test imports it directly, and
 * `src/server/pilot.server.ts` uses it for the real gate. The same rule in SQL
 * lives in one line of `countDocumentsThisMonth`
 * (`src/server/access.server.ts`) — `and d.ai_metered`.
 */

/** A document as far as the meter is concerned. */
export type MeterableDocument = {
  /** Will this document be sent to an AI provider? Stamped at write time. */
  aiMetered: boolean;
};

/** How many of these documents are AI work — the only ones the cap counts. */
export function meteredDocumentCount(
  documents: readonly MeterableDocument[],
): number {
  return documents.filter((doc) => doc.aiMetered).length;
}

/**
 * Is the incoming AI work over the monthly limit?
 *
 * `usedMetered` is `countDocumentsThisMonth` — AI work earlier this month, not
 * documents stored. `incomingMetered` is `meteredDocumentCount` of this
 * submission. Storing-only submissions always pass: `0 + cap` is never over.
 */
export function overCap(
  usedMetered: number,
  incomingMetered: number,
  cap: number,
): boolean {
  if (incomingMetered <= 0) return false;
  return usedMetered + incomingMetered > cap;
}
