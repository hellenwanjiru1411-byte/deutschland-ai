import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppProvider, Footer, Header } from "~/components/app";
import {
  AppErrorBoundary,
  ErrorShell,
  ErrorView,
  NotFoundView,
  RootErrorScreen,
  reportFailure,
} from "~/components/status";
import { getDictionary, languageOf, type Language } from "~/i18n";
import { pageLocale } from "~/lib/page-locale";
import { getBootstrap } from "~/server/fns";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  // Language and the signed-in user for the whole page. `getBootstrap` is a
  // server function: it reads the language cookie and the session cookie and
  // returns only the name and email of the signed-in user — never a token.
  loader: async () => getBootstrap(),
  head: async ({ loaderData, matches }) => {
    // The title and description of the server-rendered document are built from
    // the language files. `pageLocale` resolves the visitor's language without
    // depending on match data that may not be there yet — see
    // `src/lib/page-locale.ts` — so the HTML is right with JavaScript off.
    const t = getDictionary(await pageLocale(loaderData?.locale, matches));
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: t.meta.homeTitle },
        { name: "description", content: t.meta.homeDescription },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // The browser tab icon. `favicon.ico` is the file browsers ask for
        // unprompted, so it has to exist as well as the sharper SVG.
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      ],
    };
  },
  // A crash in the root route takes the whole layout with it, so this screen
  // brings its own document. Crashes below the root are caught by the router's
  // `defaultErrorComponent` (see `src/router.tsx`) or by the boundaries in
  // `RootComponent` just below.
  errorComponent: RootError,
  notFoundComponent: () => <NotFoundView />,
  component: RootComponent,
});

function RootError({ error }: ErrorComponentProps) {
  reportFailure("root-route", error);
  return <RootErrorScreen />;
}

function RootComponent() {
  const { locale, user, bookingUrl, contactEmail } = Route.useLoaderData();
  // The language's own description — `lang` and `dir` come from the registry, so
  // a right-to-left language mirrors the document without any change here.
  const language = languageOf(locale);
  return (
    <RootDocument language={language}>
      <AppProvider value={{ locale, user, bookingUrl, contactEmail }}>
        {/*
          SAFETY NETS. Three layers, each for a different failure:
            - a route's own error boundary (see the routes) shows the error page
              inside this layout, so the header and footer stay;
            - `AppErrorBoundary scope="page"` catches a crash in the layout area
              itself, for instance in a route's error screen;
            - `AppErrorBoundary scope="app-shell"` catches a crash in the header,
            the footer or the provider. Its fallback deliberately does NOT
            render the header and footer again — they are what may have broken,
            and re-rendering them could crash the fallback too.
        */}
        <AppErrorBoundary
          scope="app-shell"
          fallback={() => (
            <ErrorShell locale={locale} contactEmail={contactEmail} />
          )}
        >
          <Header />
          <main className="flex-1">
            <AppErrorBoundary scope="page" fallback={() => <ErrorView />}>
              <Outlet />
            </AppErrorBoundary>
          </main>
          <Footer />
        </AppErrorBoundary>
      </AppProvider>
    </RootDocument>
  );
}

function RootDocument({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    /*
      `lang` and `dir` are both read from the language registry. `dir="rtl"`
      mirrors the whole document; `dir="ltr"` is written out as well, so the
      attribute is always the registry's answer rather than a browser default.
    */
    <html lang={language.lang} dir={language.dir}>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
