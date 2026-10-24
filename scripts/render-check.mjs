#!/usr/bin/env bun
/**
 * DOES THE PAGE ACTUALLY RENDER? — the check that would have caught 2026-10-24.
 *
 * Every other test we have reads the HTML the server sends. On 2026-10-24 the
 * server was sending correct HTML while a person saw a blank page: the
 * content-security policy refused the framework's own inline scripts, so nothing
 * hydrated and nothing painted. HTML-level tests cannot see that. This one loads
 * the pages in a real browser and asserts there is text on the screen.
 *
 * It also reports any console message that mentions a refused script, so the next
 * time a policy change breaks rendering, the reason is in the log.
 *
 * Usage:  bun scripts/render-check.mjs [base-url]      (default http://localhost:3000)
 * Requires agent-browser on PATH. Run it as part of the gate before publishing:
 *   bun run build && bun run publish && bun scripts/render-check.mjs && bun scripts/smoke.mjs
 */
import { execFileSync } from "node:child_process";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SESSION = "render-check";
const PAGES = [
  ["the home page", "/"],
  ["the sign-up page", "/registrieren"],
  ["the sign-in page", "/anmelden"],
  ["the not-found page", "/diese-seite-gibt-es-nicht"],
];
/** Below this, the page is a shell rather than a rendered page. */
const MIN_TEXT = 80;

const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed += 1;
}

function ab(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("agent-browser", ["--session", SESSION, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (allowFailure) return "";
    throw err;
  }
}

console.log(`Render check against ${BASE}`);
console.log("");

for (const [label, path] of PAGES) {
  ab(["open", `${BASE}${path}`], { allowFailure: true });
  // Give the page time to hydrate and paint.
  Bun.sleepSync(5000);
  const length = Number(
    ab(["eval", "document.body.innerText.trim().length"], { allowFailure: true }) || "0",
  );
  const consoleText = ab(["console"], { allowFailure: true });
  const refusals = consoleText
    .split("\n")
    .filter((line) => /refused|content security policy|blocked/i.test(line));

  check(`${label} renders text on screen`, length >= MIN_TEXT, `${length} characters`);
  check(`${label} has no refused script or blocked content`, refusals.length === 0,
    refusals.length === 0 ? "none" : refusals[0].slice(0, 160));
}

console.log(results.join("\n"));
console.log("");
if (failed > 0) {
  console.log(`${failed} of ${results.length} render checks failed against ${BASE}`);
  console.log("A page that sends the right HTML but renders nothing is not a passing site.");
  process.exit(1);
}
console.log(`All ${results.length} render checks passed (${BASE}).`);