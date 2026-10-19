# Your site

This is the team's website. It's a [TanStack Start](https://tanstack.com/start)
app (React + Vite + Tailwind), served on **port 3000**. It starts life as a simple
"coming soon" placeholder (the headline reads the business name from `site.json` at
request time), but it's a real full-stack framework — build it out into the real
site and grow it into a dynamic app without changing hosting or starting a second
server.

## Layout

```
src/
  routes/
    __root.tsx     # the HTML shell: <head>, fonts, global layout
    index.tsx      # the landing page ("/")
  styles/app.css   # Tailwind entrypoint + base styles
vite.config.ts     # serves on 0.0.0.0:3000
```

Add a page by creating a new file under `src/routes/` — e.g. `about.tsx` becomes
`/about`. Files are routes; the router is generated automatically.

## Languages

The site serves **German and English**. Which languages exist is defined in one
place — the registry `LANGUAGES` in `src/i18n/index.ts` — and the visible language
switcher, the `lang` cookie, `<html lang>`, `<html dir>`, the server-side language
resolution and the smoke test all read from it. Adding a language is a data change:
one dictionary file in `src/i18n/` plus one registry entry. Nothing else.

Two rules hold for every new language:

- The **consent sentence** (`intake.consent`) and the **legal disclaimer**
  (`footer.disclaimer`) must be written or approved by a native speaker before the
  language goes live. Machine translation is not acceptable for those two lines.
  They carry legal weight, and the person has to genuinely understand what they
  are agreeing to.
- The smoke test covers **every language in the registry** (its titles, its
  `<html lang>`, its `<html dir>`, its 404 copy), so a language added later cannot
  go live unchecked.

Right-to-left languages (Arabic is planned) are supported: a registry entry with
`dir: "rtl"` mirrors the document, and the layout uses logical spacing and
alignment utilities. `docs/adding-a-language.md` is the full checklist — the two
steps, what a native speaker has to check, how to switch a language on, how to run
the smoke test against it, and the sign-off record to fill in.

## Serving and shipping

How this site is served and how changes go live **depends on the team's setup**:
your system prompt's **Website** section is the authority — follow it, not this
file. The `package.json` scripts (`publish`, `go-live`) exist for setups whose
Website section tells you to run them; don't run them otherwise. Server logs live
in `.run/`.

## Smoke test

One command checks the public surface of the site and **exits non-zero when
anything is wrong** — run it after every publish, and against the live URL:

```bash
bun run smoke                                   # the live site
bun run smoke http://localhost:3000             # a local server
SMOKE_BASE_URL=http://localhost:3000 bun run smoke
```

`scripts/smoke.mjs` checks that `/` is up and carries the brand "AIE Deutschland"
and nothing of the old brand, that `/registrieren`, `/anmelden`, `/robots.txt`
and `/favicon.ico` answer, that `/anliegen` sends a signed-out visitor to the
sign-in page, and that an unknown path is a real 404 page with the right copy. It
then loops over **every language in the registry** (`src/i18n/index.ts`): the page
titles from that language's `meta.*` strings, `<html lang>`, `<html dir>`, and the
404 copy — plus the registry's own consistency (unique code, declared direction,
present `lang`/`label`/`name`/dictionary) and that `/` with no cookie serves the
default language. A language added later is covered automatically. It prints
`PASS`/`FAIL` per check and a final summary, and it is read-only: no accounts,
nothing written to the database.

## Making it dynamic

The site is static today, but adding backend behavior is one file away — no second
process, no extra port, all served on the same port 3000:

- **Server function** — call server-only code (DB, secrets, fetch) directly from a
  component:

  ```tsx
  import { createServerFn } from "@tanstack/react-start";

  const getMessage = createServerFn().handler(async () => {
    return { message: "Hello from the server" };
  });
  ```

- **API route** — add `src/routes/api/<name>.ts` for a REST endpoint.
- **Slow handlers** — `serve.ts` sets Bun's `idleTimeout` to 255s; keep that line.
  With Bun's default (10s) a handler that waits on an AI provider is cut at ~12s and
  the visitor sees an empty 502. Use `createServerFn({ method: "POST" })` for work
  that costs money, so the gateway never re-sends it, and prefer streaming or a
  start-then-poll pair for anything that regularly runs past ~20s.

## Secrets

Read the owner's secrets from `process.env` in server-only code. Never put them in a
`.env` file: `.env` files are not published, so a value that only lives there is
missing on the live site.

## Adding a database

When the site needs to store data (form submissions, content, accounts), connect a
database rather than writing to files:

1. Call `discover_tools` for a database (e.g. "serverless Postgres with a free
   tier"). The owner connects it (Neon) from the card, which provides `DATABASE_URL`.
2. Query it from server-only code with the built-in helper — never from the client:

   ```tsx
   import { createServerFn } from "@tanstack/react-start";
   import { sql } from "~/db";

   const getPosts = createServerFn().handler(async () => {
     const rows = await sql()`select id, title, created_at from posts`;
     // Coerce non-primitive columns before returning — timestamps come back as JS
     // Dates, which React will not render:
     return rows.map((r) => ({ ...r, created_at: String(r.created_at) }));
   });
   ```

`DATABASE_URL` is in your environment automatically once connected, and it reaches the
published site too — saving or changing it restarts the live site with the new value
within seconds, no republish needed. The same code works in the preview and in
production. (On external hosting via `bun run go-live`, re-run it after connecting so
that host picks up `DATABASE_URL`.) One database serves both the preview and the live
site.
