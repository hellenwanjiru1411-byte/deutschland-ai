/**
 * THE SECURITY HEADERS — one list, in one file, applied to every response this
 * site serves.
 *
 * WHY A MODULE AND NOT A CONFIG FILE: this stack is TanStack Start on Bun, served
 * three ways — the Vite dev server (the working site), `serve.ts` (the sandbox and
 * the live preview, both behind the platform proxy), and `vercel-entry.ts` if the
 * site is ever deployed to a Vercel function. There is no Next.js here, no
 * `next.config`, no `middleware.ts` and no Supabase: a header written in one of
 * those shapes would be dead code that never runs. So the headers are plain data
 * plus one function, and every server entry point calls it.
 *
 * WHAT EACH HEADER IS FOR (and what it does not do):
 *   - `Content-Security-Policy` — the browser refuses to load scripts, frames or
 *     objects from anywhere but us. This is the control that limits the damage if
 *     a stored document ever managed to inject markup: `object-src 'none'` kills
 *     plugin/PDF-embedding paths, `script-src 'self'` means no injected inline
 *     script runs.
 *   - `X-Frame-Options: DENY` + `frame-ancestors 'none'` — nobody can put our
 *     sign-in page in a frame and clickjack a person into an action. Both are sent
 *     because `frame-ancestors` is the modern one and `X-Frame-Options` is what
 *     older browsers honour.
 *   - `X-Content-Type-Options: nosniff` — a file we serve as text cannot be
 *     sniffed into being run as a script.
 *   - `Referrer-Policy: no-referrer` — our URLs carry no case ids today, and this
 *     keeps it that way if one ever does: nothing of our address goes to another
 *     site in a Referer header.
 *   - `Permissions-Policy` — geolocation, camera, microphone, payment and USB are
 *     switched off for us and for anything embedded in us. The app never asks for
 *     any of them; a person's phone camera reaches us only through the file
 *     picker, which this header does not touch.
 *   - `Strict-Transport-Security` — once a browser has seen the HTTPS site it
 *     refuses to talk to it over plain HTTP for a year.
 *   - `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` — another site
 *     cannot embed our pages or resources and keep a handle on them.
 *
 * WHAT IT DOES NOT DO: headers are defence in depth, not a sandbox. They do not
 * stop a server-side bug from storing a hostile file (that is the upload
 * validation in `src/server/uploads.server.ts`), and they do not make the app
 * "un-hackable" — nothing does, and the codebase claims no such thing.
 */

/** How the site is being served. Development relaxes exactly two directives. */
export type HeaderMode = "production" | "development";

/**
 * The Content-Security-Policy.
 *
 * `script-src 'self'` in production, with no `'unsafe-inline'` and no
 * `'unsafe-eval'`: the built site loads its JavaScript from files we serve, and
 * the smoke test fails if the served HTML ever carries an inline script again.
 *
 * DEVELOPMENT RELAXES TWO THINGS, AND ONLY DEVELOPMENT:
 *   1. `script-src` gains `'unsafe-inline'`, because Vite's dev server injects an
 *      inline module script for the client entry and HMR — without it the working
 *      site renders an empty page. This is the dev server only; it is not built
 *      into `dist/` and it is never sent by `serve.ts` or the live site.
 *   2. `connect-src` gains `ws:`/`wss:`, because HMR dials back over a websocket.
 * `style-src` keeps `'unsafe-inline'` in BOTH modes: React writes `style`
 * attributes and Tailwind's dev pipeline injects a style element; a stylesheet
 * cannot run script, so the relaxation costs nothing that matters.
 */
function contentSecurityPolicy(mode: HeaderMode): string {
  const dev = mode === "development";
  return [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "img-src 'self' data:",
    dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    dev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "manifest-src 'self'",
    // Only meaningful over HTTPS, and only sent there (see the HSTS note below).
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Every header this site sends, for one mode. A fresh object each call, so a
 * caller cannot mutate a shared list.
 */
export function securityHeaders(mode: HeaderMode = "production"): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(mode),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
    // The live site and the working site are both HTTPS-only through the platform
    // proxy, so HSTS is always safe to send. A local `http://localhost` dev run
    // ignores it (browsers apply HSTS to HTTPS responses only).
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/** Put the headers onto an existing `Headers` object, without overwriting anything a route set itself. */
export function applySecurityHeaders(
  headers: Headers,
  mode: HeaderMode = "production",
): void {
  for (const [name, value] of Object.entries(securityHeaders(mode))) {
    if (!headers.has(name)) headers.set(name, value);
  }
}

/**
 * The same headers on a whole `Response`. The body is streamed through untouched,
 * so this works for a server-rendered document and for a static file alike.
 *
 * A `Set-Cookie` or `Location` a handler set stays exactly as it was: only the
 * headers above are added, and only when they are missing.
 */
export function withSecurityHeaders(
  response: Response,
  mode: HeaderMode = "production",
): Response {
  applySecurityHeaders(response.headers, mode);
  return response;
}
