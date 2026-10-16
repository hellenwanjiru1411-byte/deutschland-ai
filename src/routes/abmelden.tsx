import { createFileRoute, redirect } from "@tanstack/react-router";

import { signOut } from "~/server/fns";

/**
 * Sign out. Reached with a plain link, so the server ends the session (deletes
 * the row in `sessions` and clears the cookie) and sends the visitor home.
 */
export const Route = createFileRoute("/abmelden")({
  loader: async () => {
    try {
      await signOut();
    } catch {
      // Even if the database is unreachable, the cookie is cleared.
    }
    throw redirect({ to: "/" });
  },
});
