import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

import { securityHeaders } from "./src/server/security-headers.ts";

/**
 * The security headers on the WORKING site.
 *
 * `serve.ts` puts them on every response the built site serves, but the working
 * site is this Vite dev server, which never runs `serve.ts`. Without this plugin
 * the headers would exist in production only — and a header nobody can see on the
 * site we develop against is a header nobody checks. One list, in
 * `src/server/security-headers.ts`; the two development relaxations are
 * documented there and never reach the built site.
 */
function securityHeadersPlugin(): Plugin {
  const apply = (mode: "development" | "production") => {
    const headers = securityHeaders(mode);
    return (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
      next();
    };
  };
  return {
    name: "aie-security-headers",
    configureServer(server) {
      server.middlewares.use(apply("development"));
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply("production"));
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
    // The dev server is reachable through the TLS proxy, so the HMR websocket
    // must dial back on 443, not the dev port. If the socket can't connect,
    // pages still serve — hot reload degrades, never breaks.
    hmr: { clientPort: 443 },
    // The dev server can serve source files; never let it serve local secrets,
    // and never let it serve anything outside the site dir. Gotchas this list
    // encodes: a custom `deny` REPLACES Vite's defaults (so .git must be
    // restated), patterns containing "/" match the ABSOLUTE path (so dir
    // patterns need a leading **/), and `allow` left to its default widens to
    // the nearest workspace root — a stray .git or workspaces package.json in
    // /home/team/shared would expose the whole shared dir.
    fs: {
      strict: true,
      allow: [import.meta.dirname],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.run/**", "**/.git/**"],
    },
  },
  plugins: [
    securityHeadersPlugin(),
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
