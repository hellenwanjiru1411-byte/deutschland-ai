/**
 * GET /dokument/<id> — hand a person back one of their own documents.
 *
 * WHY A ROUTE AND NOT A SERVER FUNCTION: the headers are the point. A document
 * must leave this site as a DOWNLOAD of a known type, never as something a browser
 * renders in our origin. A server function answers JSON; only a real response can
 * carry `Content-Disposition: attachment`, a pinned `Content-Type` and
 * `X-Content-Type-Options: nosniff`. Those three come from
 * `documentResponseHeaders` in `src/server/uploads.server.ts` — written next to the
 * decision about what the file is, so the two cannot drift apart.
 *
 * WHO MAY READ IT: the person who owns the case, and the owner handling it during
 * the pilot — nobody else. The check is not in this file: it is
 * `getDocumentForDownload` (a person's own document) or `getDocumentForOwner` (any
 * document, for the owner) in `src/server/access.server.ts`, the only place that
 * reads document bytes. The person's read joins the document to its case and
 * requires the case to belong to the signed-in person; the owner's read is
 * reachable only with an `OwnerViewer`, which only `viewerForOwner` builds, and
 * that throws for any account whose stored role is not `owner`. Anyone else gets
 * 404 — not 403, because a stranger should not learn whether an id exists.
 *
 * NO PERSONAL DATA IN URLS OR LOGS: the id is random and internal, the generated
 * filename is what the browser is offered, and nothing here logs a filename, a
 * document or an email address.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dokument/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const data = await import("~/server/data.server");
        const access = await import("~/server/access.server");
        /*
         * Loaded here, not at the top of the file: this module is reached from the
         * route tree, and a top-level import of a server module would drag
         * `node:crypto` (and the image library) into the browser bundle.
         */
        const uploads = await import("~/server/uploads.server");

        const user = await data.currentUser();
        if (!user) {
          // Same answer as every other private page: sign in first. Relative
          // `Location` keeps the host out of anything we write.
          return new Response(null, {
            status: 307,
            headers: { Location: "/anmelden" },
          });
        }

        /*
         * TWO READS, ONE PER SCOPE, chosen from the SESSION — never from the URL.
         * There is no `?as=owner` parameter to tamper with: the owner's read is
         * taken only when the stored role on the account row says `owner`.
         */
        const roles = await import("~/lib/roles");
        let stored: Awaited<ReturnType<typeof access.getDocumentForDownload>>;
        try {
          stored = roles.isOwnerRole(user.role)
            ? await access.getDocumentForOwner(access.viewerForOwner(user), params.id)
            : await access.getDocumentForDownload(
                access.viewerForUser(user),
                params.id,
              );
        } catch {
          // A database failure must not leak internals — and must not pretend the
          // document does not exist either.
          return new Response("Vorübergehend nicht verfügbar.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }

        if (!stored) {
          return new Response("Nicht gefunden.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }

        const body = Buffer.from(stored.contentBase64, "base64");
        return new Response(body, {
          status: 200,
          headers: {
            ...uploads.documentResponseHeaders(stored),
            "Content-Length": String(body.length),
          },
        });
      },
    },
  },
});
