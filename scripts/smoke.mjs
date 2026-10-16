#!/usr/bin/env bun
/**
 * Smoke test for the public surface of the site.
 *
 *   bun run smoke                                  # against the live site
 *   bun run smoke http://localhost:3000            # against a local server
 *   SMOKE_BASE_URL=http://localhost:3000 bun run smoke
 *
 * It exits 0 only when every check passes and exits 1 as soon as anything is
 * wrong, so it can run unattended. The expected copy and page titles are read
 * from the language files (`src/i18n/de.ts`, `src/i18n/en.ts`) — the test
 * therefore checks what the site is *supposed* to say, not a copy of it.
 *
 * Nothing here is authenticated and nothing writes to the database: the public
 * surface only. `/anliegen` is checked for the redirect a signed-out visitor
 * gets, which is all a public check can see.
 */
import { de } from "../src/i18n/de.ts";
import { en } from "../src/i18n/en.ts";

const BASE = (
  process.env.SMOKE_BASE_URL ||
  process.argv[2] ||
  "https://6889bc9424ee46b51bca1d9c09de8ab2.ctonew.app"
).replace(/\/+$/, "");

/** A path that is not a route, used for the 404 check. */
const MISSING = "/diese-seite-gibt-es-nicht";

let passed = 0;
const failed = [];

function ok(name, detail = "") {
  passed++;
  console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
}

function fail(name, detail) {
  failed.push(`${name} — ${detail}`);
  console.log(`FAIL  ${name}  (${detail})`);
}

function expect(name, condition, detail) {
  if (condition) ok(name, detail);
  else fail(name, detail);
}

async function get(path, { lang, redirect = "follow" } = {}) {
  const headers = lang ? { cookie: `lang=${lang}` } : {};
  const res = await fetch(BASE + path, { headers, redirect });
  const body = await res.text().catch(() => "");
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") ?? "", body };
}

/** Decode the few entities a title could carry, so the comparison is on text. */
function decode(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function titleOf(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decode(match[1].trim()) : null;
}

/** Run one check so that a network error is a failed check, not a crash. */
async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, `threw ${error instanceof Error ? error.name : typeof error}`);
  }
}

console.log(`Smoke test against ${BASE}\n`);

/* ------------------------------------------------ the site itself is there */

await step("GET /", async () => {
  const home = await get("/");
  expect("GET / returns 200", home.status === 200, `status ${home.status}`);
  expect(
    `GET / shows the brand "${de.brand.name}"`,
    home.body.includes(de.brand.name),
    "brand name in the HTML",
  );
  const oldBrand = /deutschland[\s-]ai/i.exec(home.body);
  expect(
    "GET / shows no trace of the old brand",
    !oldBrand,
    oldBrand ? `found "${oldBrand[0]}"` : "no match for deutschland-ai",
  );
});

await step("public pages", async () => {
  const signUp = await get("/registrieren");
  expect("GET /registrieren returns 200", signUp.status === 200, `status ${signUp.status}`);

  const signIn = await get("/anmelden");
  expect("GET /anmelden returns 200", signIn.status === 200, `status ${signIn.status}`);

  // Signed out, the private intake page must send visitors to the sign-in page.
  const intake = await get("/anliegen", { redirect: "manual" });
  const toSignIn = intake.status === 307 && (intake.location ?? "").includes("/anmelden");
  expect(
    "GET /anliegen redirects a signed-out visitor to /anmelden",
    toSignIn,
    `status ${intake.status}, location ${intake.location ?? "-"}`,
  );
});

await step("static files", async () => {
  const robots = await get("/robots.txt");
  expect("GET /robots.txt returns 200", robots.status === 200, `status ${robots.status}`);
  expect(
    "GET /robots.txt contains a robots directive",
    /user-agent:/i.test(robots.body),
    "user-agent line",
  );

  const icon = await get("/favicon.ico");
  expect("GET /favicon.ico returns 200", icon.status === 200, `status ${icon.status}`);
  expect(
    "GET /favicon.ico is an image",
    icon.type.startsWith("image/"),
    `content-type ${icon.type || "-"}`,
  );
});

await step("404 page", async () => {
  const german = await get(MISSING, { lang: "de" });
  expect(
    `GET ${MISSING} returns 404`,
    german.status === 404,
    `status ${german.status}`,
  );
  expect(
    "the 404 page shows its German copy",
    german.body.includes(de.notFound.title),
    `expected "${de.notFound.title}"`,
  );

  const english = await get(MISSING, { lang: "en" });
  expect(
    "the 404 page follows the selected language",
    english.body.includes(en.notFound.title),
    `expected "${en.notFound.title}"`,
  );
});

await step("page titles", async () => {
  for (const [lang, dictionary] of [
    ["de", de],
    ["en", en],
  ]) {
    const home = await get("/", { lang });
    expect(
      `the ${lang} title of / is ${JSON.stringify(dictionary.meta.homeTitle)}`,
      titleOf(home.body) === dictionary.meta.homeTitle,
      `got ${JSON.stringify(titleOf(home.body))}`,
    );
    expect(
      `the ${lang} request renders <html lang="${lang}">`,
      home.body.includes(`<html lang="${lang}"`),
      "html lang attribute",
    );

    const signUp = await get("/registrieren", { lang });
    expect(
      `the ${lang} title of /registrieren is ${JSON.stringify(dictionary.meta.signUpTitle)}`,
      titleOf(signUp.body) === dictionary.meta.signUpTitle,
      `got ${JSON.stringify(titleOf(signUp.body))}`,
    );

    const signIn = await get("/anmelden", { lang });
    expect(
      `the ${lang} title of /anmelden is ${JSON.stringify(dictionary.meta.signInTitle)}`,
      titleOf(signIn.body) === dictionary.meta.signInTitle,
      `got ${JSON.stringify(titleOf(signIn.body))}`,
    );
  }
});

/* ------------------------------------------------------------- the verdict */

console.log(`\n${passed} passed, ${failed.length} failed (${BASE})`);
if (failed.length > 0) {
  console.log("\nWhat failed:");
  for (const line of failed) console.log(`  - ${line}`);
  process.exit(1);
}
console.log("All checks passed.");
