/**
 * WHO IS WHO — the one place that knows the difference between a person using
 * this service and the person running it.
 *
 * THE TWO ROLES THAT EXIST TODAY:
 *   - `person` — someone using the service. Sees their own cases and nothing
 *     else. Every account is created as this, and no page can change it.
 *   - `owner`  — the owner of the business, who handles every case personally
 *     during the pilot (business plan, owner's direction Oct 2026). The owner's
 *     private inbox (`/postfach`) is reachable by this role only.
 *
 * HOW AN ACCOUNT BECOMES THE OWNER: it is not a checkbox and not something the
 * browser can send. `currentUser()` in `src/server/data.server.ts` compares the
 * account's normalised e-mail address with `OWNER_EMAIL` (an environment
 * variable, set in the business's own secrets store) and, on a match, sets the
 * stored role to `owner`. With `OWNER_EMAIL` unset nobody is the owner and the
 * inbox answers "not found" to everyone — the safe direction to fail in.
 *
 * WHAT A SECOND HELPER ACCOUNT WOULD NEED (not built, and nothing here blocks
 * it): a `helper` role, a table saying which case ids that helper is assigned
 * to, and one extra scope in the access module — `viewerForHelper(user, caseIds)`
 * — so every read already carries "which cases may this viewer see". The access
 * module is shaped for exactly that: the viewer is a value the module builds,
 * never something the browser supplies, and every query already filters on it.
 * Until that exists there is one owner and one scope, and the inbox checks for
 * `owner` and nothing else.
 */

export const USER_ROLES = ["person", "owner"] as const;

/** What an account is allowed to do at the coarsest level. */
export type UserRole = (typeof USER_ROLES)[number];

/** Every account starts here. */
export const DEFAULT_USER_ROLE: UserRole = "person";

/** Is this value one of our roles? A stored value we do not know is treated as `person`. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * May this account see every case? One condition, in one place, used by the
 * server functions and by the access module's owner viewer.
 */
export function isOwnerRole(role: unknown): boolean {
  return role === "owner";
}
