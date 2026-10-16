import { createRouter } from "@tanstack/react-router";

import { ErrorView, LoadingNotice, NotFoundView } from "~/components/status";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    // One 404 experience for the whole site: the default not-found component is
    // the same, language-file driven screen the root route uses, so a wrong
    // address never shows a bare "Not found" in English on a German site.
    defaultNotFoundComponent: () => <NotFoundView />,
    // One error screen for the whole site: any route that does not bring its own
    // error boundary still fails calmly, in the visitor's language, with no
    // stack trace.
    defaultErrorComponent: () => <ErrorView />,
    // A visible loading notice while a page that needs the server is fetched.
    // `defaultPendingMs` (1 second) keeps it from flashing on fast navigations —
    // a wait that short does not need to be announced.
    defaultPendingComponent: () => <LoadingNotice />,
  });
}
