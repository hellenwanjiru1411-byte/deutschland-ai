/**
 * CAPABILITIES — the closed set of things this product offers, in the order the
 * business plan presents them.
 *
 * The dashboard shows one card per capability, and every card shows **both
 * routes**: the app doing it with AI, and a human doing it with the person. That
 * is an owner requirement, so the list of capabilities is not a loose array of
 * strings somewhere in a page — it is a closed set here, exactly like
 * `AREA_CODES` in `src/lib/areas.ts`, with three guarantees:
 *
 *   1. A capability is a **stable internal code** (`understand_letter`, …). It is
 *      never shown and never stored. The words a person reads live in the
 *      language files under `capabilities.*` and are looked up by code, so adding
 *      a language never changes an identifier.
 *   2. Every language file must carry a title, a description and a line for each
 *      route for **every** code in this list. `de.ts` types its `capabilities`
 *      object as `Record<CapabilityCode, CapabilityCopy>` and every other
 *      language has to match the German shape, so a missing label is a **build
 *      error** — never a silent fallback to German or to an empty card.
 *   3. The **order** is the product order from the business plan. The dashboard
 *      renders this array as it is; the smoke test checks the order, so a card
 *      cannot be quietly moved or dropped.
 *
 * Pure data, no React and no database: imported by the dashboard, by the smoke
 * test and (later) by whatever else has to speak about a capability.
 */

/**
 * Every capability, in the order the product presents them.
 *
 * Adding one is a deliberate change here plus copy in every language file — both
 * are build errors if forgotten.
 */
export const CAPABILITY_CODES = [
  // 1. Understand an official letter.
  "understand_letter",
  // 2. Track deadlines.
  "track_deadlines",
  // 3. Organise paperwork.
  "organise_paperwork",
  // 4. Find the right authority.
  "find_authority",
  // 5. Manage appointments — the app's own calendar goes here (next stage).
  "manage_appointments",
  // 6. Translate documents.
  "translate_documents",
  // 7. Access support services.
  "access_support",
] as const;

/** One capability of the product. Internal code; the words live in the language files. */
export type CapabilityCode = (typeof CAPABILITY_CODES)[number];

/** Is this value one of our capability codes? */
export function isCapabilityCode(value: unknown): value is CapabilityCode {
  return (
    typeof value === "string" &&
    (CAPABILITY_CODES as readonly string[]).includes(value)
  );
}

/**
 * The copy one language must provide for one capability.
 *
 * - `title` and `body` say what the capability is — describing the capability,
 *   not claiming it works. Whether it works today is said separately, by the
 *   route labels, which are the same for every card.
 * - `aiNote` says plainly what the app cannot do yet on this capability. It is
 *   per capability on purpose: "no AI model is connected" is one thing, "the app
 *   cannot explain a letter yet" is the thing a person actually needs to know.
 * - `humanNote` says what the human route does for this capability today. During
 *   the pilot the human is the team itself, so this line may promise help — but
 *   only help we really give (see the business plan: no legal advice, and
 *   explaining a document is not a certified translation).
 */
export type CapabilityCopy = {
  title: string;
  body: string;
  aiNote: string;
  humanNote: string;
};
