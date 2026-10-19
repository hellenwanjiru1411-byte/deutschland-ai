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
 * from the language registry (`src/i18n/index.ts`) — the test therefore checks
 * what the site is *supposed* to say, not a copy of it.
 *
 * Every language the registry declares is checked, and nothing here names a
 * language itself: adding a language to the registry adds its checks (title,
 * `<html lang>`, `<html dir>` and 404 copy) automatically, so a new language
 * cannot go live untested.
 *
 * Nothing here is authenticated and nothing writes to the database: the public
 * surface only. `/anliegen` is checked for the redirect a signed-out visitor
 * gets, which is all a public check can see.
 */
import { LANGUAGES } from "../src/i18n/index.ts";

const BASE = (
  process.env.SMOKE_BASE_URL ||
  process.argv[2] ||
  "https://6889bc9424ee46b51bca1d9c09de8ab2.ctonew.app"
).replace(/\/+$/, "");

/** A path that is not a route, used for the 404 check. */
const MISSING = "/diese-seite-gibt-es-nicht";

/** The default language: the first entry of the registry. */
const DEFAULT = LANGUAGES[0];

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

/**
 * Is `name="value"` on the `<html>` element? The whole opening tag is searched,
 * so the order of the attributes does not matter.
 */
function htmlAttribute(html, name, value) {
  const tag = /<html\b[^>]*>/i.exec(html);
  if (!tag) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${name}\\s*=\\s*["']${escaped}["']`, "i").test(tag[0]);
}

/** Run one check so that a network error is a failed check, not a crash. */
async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, `threw ${error instanceof Error ? error.name : typeof error}`);
  }
}

console.log(`Smoke test against ${BASE}`);
console.log(
  `Languages in the registry: ${LANGUAGES.map((l) => `${l.code} (${l.dir})`).join(", ")}\n`,
);

/* ------------------------------------------------------- the registry itself */

await step("language registry", async () => {
  const codes = LANGUAGES.map((language) => language.code);
  expect(
    "every language has a unique code",
    new Set(codes).size === codes.length,
    codes.join(", "),
  );

  const noDirection = LANGUAGES.filter(
    (language) => language.dir !== "ltr" && language.dir !== "rtl",
  ).map((language) => language.code);
  expect(
    "every language declares a direction",
    noDirection.length === 0,
    noDirection.length > 0 ? `missing for ${noDirection.join(", ")}` : "ltr or rtl",
  );

  const incomplete = LANGUAGES.filter(
    (language) => !language.lang || !language.label || !language.name,
  ).map((language) => language.code);
  expect(
    "every language carries a lang tag, a switcher label and a name",
    incomplete.length === 0,
    incomplete.length > 0 ? `missing for ${incomplete.join(", ")}` : "all complete",
  );

  const halfTranslated = LANGUAGES.filter(
    (language) => typeof language.dictionary?.brand?.name !== "string",
  ).map((language) => language.code);
  expect(
    "every language brings its own dictionary",
    halfTranslated.length === 0,
    halfTranslated.length > 0 ? `broken for ${halfTranslated.join(", ")}` : "all present",
  );
});

/* ------------------------------------------------ the site itself is there */

await step("GET /", async () => {
  const home = await get("/");
  expect("GET / returns 200", home.status === 200, `status ${home.status}`);
  expect(
    `GET / shows the brand "${DEFAULT.dictionary.brand.name}"`,
    home.body.includes(DEFAULT.dictionary.brand.name),
    "brand name in the HTML",
  );
  const oldBrand = /deutschland[\s-]ai/i.exec(home.body);
  expect(
    "GET / shows no trace of the old brand",
    !oldBrand,
    oldBrand ? `found "${oldBrand[0]}"` : "no match for deutschland-ai",
  );
});

await step("default language", async () => {
  const home = await get("/");
  expect(
    `GET / without a language cookie is the default language (${DEFAULT.code})`,
    titleOf(home.body) === DEFAULT.dictionary.meta.homeTitle &&
      htmlAttribute(home.body, "lang", DEFAULT.lang) &&
      htmlAttribute(home.body, "dir", DEFAULT.dir),
    `lang "${DEFAULT.lang}", dir "${DEFAULT.dir}"`,
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
  for (const language of LANGUAGES) {
    const response = await get(MISSING, { lang: language.code });
    expect(
      `GET ${MISSING} returns 404 in ${language.code}`,
      response.status === 404,
      `status ${response.status}`,
    );
    expect(
      `the 404 page shows the ${language.code} copy`,
      response.body.includes(language.dictionary.notFound.title),
      `expected "${language.dictionary.notFound.title}"`,
    );
  }
});

await step("titles, lang and direction", async () => {
  for (const language of LANGUAGES) {
    const { code, lang, dir, dictionary: t } = language;

    const home = await get("/", { lang: code });
    expect(
      `the ${code} title of / is ${JSON.stringify(t.meta.homeTitle)}`,
      titleOf(home.body) === t.meta.homeTitle,
      `got ${JSON.stringify(titleOf(home.body))}`,
    );
    expect(
      `the ${code} page renders <html lang="${lang}">`,
      htmlAttribute(home.body, "lang", lang),
      "html lang attribute",
    );
    expect(
      `the ${code} page renders <html dir="${dir}">`,
      htmlAttribute(home.body, "dir", dir),
      "html dir attribute",
    );

    const signUp = await get("/registrieren", { lang: code });
    expect(
      `the ${code} title of /registrieren is ${JSON.stringify(t.meta.signUpTitle)}`,
      titleOf(signUp.body) === t.meta.signUpTitle,
      `got ${JSON.stringify(titleOf(signUp.body))}`,
    );

    const signIn = await get("/anmelden", { lang: code });
    expect(
      `the ${code} title of /anmelden is ${JSON.stringify(t.meta.signInTitle)}`,
      titleOf(signIn.body) === t.meta.signInTitle,
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
