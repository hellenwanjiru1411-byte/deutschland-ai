import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppProvider, Footer, Header } from "~/components/app";
import { getDictionary, resolveLocale } from "~/i18n";
import { getBootstrap } from "~/server/fns";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  // Language and the signed-in user for the whole page. `getBootstrap` is a
  // server function: it reads the language cookie and the session cookie and
  // returns only the name and email of the signed-in user — never a token.
  loader: async () => getBootstrap(),
  head: ({ loaderData }) => {
    const t = getDictionary(resolveLocale(loaderData?.locale));
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: t.meta.homeTitle },
        { name: "description", content: t.meta.homeDescription },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    };
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  const { locale, user, bookingUrl } = Route.useLoaderData();
  return (
    <RootDocument locale={locale}>
      <AppProvider value={{ locale, user, bookingUrl }}>
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </AppProvider>
    </RootDocument>
  );
}

function RootDocument({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  return (
    <html lang={locale}>
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

function NotFound() {
  const t = getDictionary(resolveLocale(undefined));
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-3xl font-semibold">
        {t.nav.home === "Startseite"
          ? "Diese Seite gibt es nicht."
          : "This page does not exist."}
      </h1>
    </section>
  );
}
