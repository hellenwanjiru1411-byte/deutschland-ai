import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppProvider, Footer, Header, useT } from "~/components/app";
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
      links: [
        { rel: "stylesheet", href: appCss },
        // The browser tab icon. `favicon.ico` is the file browsers ask for
        // unprompted, so it has to exist as well as the sharper SVG.
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      ],
    };
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  const { locale, user, bookingUrl, contactEmail } = Route.useLoaderData();
  return (
    <RootDocument locale={locale}>
      <AppProvider value={{ locale, user, bookingUrl, contactEmail }}>
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

/**
 * 404 page. Every word comes from the language file, so translating it is a data
 * change — and the visitor gets it in the language they are reading the site in,
 * because the component sits inside the app provider like any other page.
 */
function NotFound() {
  const t = useT();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-3xl font-semibold">{t.notFound.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{t.notFound.lead}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-secondary">
          {t.nav.home}
        </Link>
        <Link to="/anliegen" className="btn-primary">
          {t.nav.intake}
        </Link>
      </div>
    </section>
  );
}
