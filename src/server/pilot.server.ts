/**
 * THE PILOT SAFEGUARDS — the two rules that limit what this app does with someone's
 * documents during the pilot, enforced in one place.
 *
 * WHY THIS IS ITS OWN MODULE: these rules decide whether a person's documents are
 * stored at all, so they must be enforceable and testable on their own — a gate
 * that only exists inside a request handler can only be checked by driving a
 * browser. Everything below runs against the real database through the same two
 * modules the rest of the app uses: the count through `./access.server` (the only
 * place that reads documents) and the write through `./data.server` (the only
 * place that writes them). This module assembles nothing itself.
 *
 * THE TWO RULES (business plan rev. 12, owner's direction Oct 2026):
 *   1. READING-AID ACKNOWLEDGEMENT — a submission carrying a document must carry
 *      the acknowledgement. Without it, nothing is saved.
 *   2. PILOT DOCUMENT CAP — per person, per calendar month, counted in our own
 *      database. Past the cap, nothing is saved; a request with no documents is
 *      always accepted, because the cap is on our bill and not on asking for help.
 *
 * CONFIDENTIALITY: nothing here logs, and neither refusal carries any personal
 * data. The caller turns a refusal code into words in the visitor's language.
 */
import type { AreaCode } from "~/lib/areas";
import { READING_AID_VERSION, type SubjectKey } from "~/lib/constants";
import { countDocumentsThisMonth, viewerForUser } from "./access.server";
import {
  monthlyDocumentCap,
  saveRequest,
  type IncomingDocument,
} from "./data.server";

/** Why a submission was refused. A code, never a message: the caller translates. */
export type PilotRefusal = "reading_aid_missing" | "cap_reached";

export type PilotSubmission = {
  userId: string;
  city: string;
  state: string;
  subject: SubjectKey;
  message: string;
  phone: string | null;
  documents: IncomingDocument[];
  /** The reading-aid acknowledgement the person gave, if any. */
  readingAidAck: boolean;
  /** The language the acknowledgement was shown in (the visitor's language). */
  locale: string;
};

export type PilotSaveResult =
  | { ok: true; id: string; area: AreaCode }
  | { ok: false; code: PilotRefusal };

/**
 * Apply both pilot rules, then save. The only way a request with documents is
 * stored while the pilot safeguards are in force.
 */
export async function saveRequestUnderPilotRules(
  input: PilotSubmission,
): Promise<PilotSaveResult> {
  /*
   * GATE 1 — the reading-aid acknowledgement. It gates an upload, so a request
   * with no documents needs no acknowledgement; a request with one document and
   * no acknowledgement is refused before anything is written.
   */
  if (input.documents.length > 0 && !input.readingAidAck) {
    return { ok: false, code: "reading_aid_missing" };
  }

  /*
   * GATE 2 — the monthly document cap. Counted from our own database, for this
   * purpose only. The check and the write are two statements, so two submissions
   * fired at the same instant could each pass and leave the person one request
   * over: that is accepted deliberately. A lock held across the write would be a
   * heavier promise than this limit makes — it protects the owner's spending, and
   * nothing is charged to the person either way.
   */
  if (input.documents.length > 0) {
    const used = await countDocumentsThisMonth(viewerForUser({ id: input.userId }));
    if (used + input.documents.length > monthlyDocumentCap()) {
      return { ok: false, code: "cap_reached" };
    }
  }

  const stored = await saveRequest({
    userId: input.userId,
    city: input.city,
    state: input.state,
    subject: input.subject,
    message: input.message,
    phone: input.phone,
    readingAid: input.readingAidAck
      ? { version: READING_AID_VERSION, locale: input.locale }
      : null,
    documents: input.documents,
  });
  return { ok: true, id: stored.id, area: stored.area };
}
