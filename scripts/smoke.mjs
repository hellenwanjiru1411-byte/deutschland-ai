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
 *
 * The area-of-life rules are checked here too, because they are a promise the
 * product makes and they must break the build's gate rather than a code review:
 * every subject maps to a declared area, every language names every area, the
 * area guard really refuses to mix areas, and no file outside the access module
 * assembles its own query against `requests` or `documents`. See
 * `docs/areas-of-life.md`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { LANGUAGES } from "../src/i18n/index.ts";
import {
  AREA_CODES,
  SUBJECT_AREA,
  groupByArea,
  inAreaOnly,
} from "../src/lib/areas.ts";
import {
  AI_ROUTE_CONNECTED,
  MONTHLY_DOCUMENT_CAP,
  READING_AID_VERSION,
  SUBJECT_KEYS,
} from "../src/lib/constants.ts";
import { meteredDocumentCount, overCap } from "../src/lib/pilot-cap.ts";
import { CAPABILITY_CODES } from "../src/lib/capabilities.ts";

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

/* ------------------------------------------------------- areas of life */

await step("areas of life", async () => {
  const unmapped = SUBJECT_KEYS.filter(
    (key) => !AREA_CODES.includes(SUBJECT_AREA[key]),
  );
  expect(
    "every subject maps to a declared area of life",
    unmapped.length === 0,
    unmapped.length > 0 ? `no area for ${unmapped.join(", ")}` : `${SUBJECT_KEYS.length} subjects → ${AREA_CODES.length} areas`,
  );

  const invented = Object.keys(SUBJECT_AREA).filter(
    (key) => !SUBJECT_KEYS.includes(key),
  );
  expect(
    "the mapping invents no subject of its own",
    invented.length === 0,
    invented.length > 0 ? `unknown ${invented.join(", ")}` : "only declared subjects",
  );

  for (const language of LANGUAGES) {
    const missing = AREA_CODES.filter((area) => {
      const label = language.dictionary.areas?.[area];
      return typeof label !== "string" || label.trim().length === 0;
    });
    expect(
      `every area of life has a ${language.code} label`,
      missing.length === 0,
      missing.length > 0 ? `missing ${missing.join(", ")}` : `${AREA_CODES.length} labels`,
    );
  }

  // The guard itself: it keeps its own area, and it refuses a mixed set.
  const residence = { area: "residence", id: "r1" };
  const health = { area: "health_insurance", id: "h1" };
  const kept = inAreaOnly("residence", [residence]);
  expect(
    "the area guard keeps rows of the requested area",
    kept.length === 1 && kept[0].id === "r1",
    "one residence row in, one out",
  );

  let refused = false;
  try {
    inAreaOnly("residence", [residence, health]);
  } catch {
    refused = true;
  }
  expect(
    "the area guard refuses a result set that mixes areas",
    refused,
    "asking for residence with a health-insurance row throws",
  );

  const grouped = groupByArea([residence, health]);
  const crossed = [...grouped].filter(([area, bucket]) =>
    bucket.some((row) => row.area !== area),
  );
  expect(
    "cases grouped by area never cross between areas",
    crossed.length === 0 && grouped.size === 2,
    [...grouped.keys()].join(", "),
  );
});

/* ------------------------------------------------------------ capabilities */

await step("capabilities", async () => {
  // The product order from the business plan. Written out here on purpose: the
  // order is a decision, not an implementation detail, so moving or dropping a
  // card has to fail a check rather than quietly reorder the dashboard.
  const PRODUCT_ORDER = [
    "understand_letter", // 1. understand an official letter
    "track_deadlines", // 2. track deadlines
    "organise_paperwork", // 3. organise paperwork
    "find_authority", // 4. find the right authority
    "manage_appointments", // 5. manage appointments
    "translate_documents", // 6. translate documents
    "access_support", // 7. access support services
  ];
  expect(
    "the capabilities are in the business plan's order",
    CAPABILITY_CODES.join(",") === PRODUCT_ORDER.join(","),
    CAPABILITY_CODES.join(", "),
  );

  for (const language of LANGUAGES) {
    const { code, dictionary } = language;
    const COPY_FIELDS = ["title", "body", "aiNote", "humanNote"];

    // A capability with no copy in a language must fail the build, not render an
    // empty card — the same rule the areas of life follow.
    const missing = CAPABILITY_CODES.filter((capability) => {
      const copy = dictionary.capabilities?.[capability];
      return (
        !copy ||
        !COPY_FIELDS.every(
          (field) => typeof copy[field] === "string" && copy[field].trim().length > 0,
        )
      );
    });
    expect(
      `every capability has a ${code} label`,
      missing.length === 0,
      missing.length > 0
        ? `missing ${missing.join(", ")}`
        : `${CAPABILITY_CODES.length} labels`,
    );

    // The other direction: a language file may not invent a capability of its
    // own, or a card could exist in one language and not in another.
    const invented = Object.keys(dictionary.capabilities ?? {}).filter(
      (capability) => !CAPABILITY_CODES.includes(capability),
    );
    expect(
      `the ${code} language file invents no capability of its own`,
      invented.length === 0,
      invented.length > 0
        ? `unknown ${invented.join(", ")}`
        : "only declared capabilities",
    );

    // BOTH routes are labelled in every language, and the two labels are not the
    // same words: nobody should have to guess whether a machine or a person is
    // dealing with their paperwork.
    const routes = dictionary.dashboard?.routes ?? {};
    const ROUTE_KEYS = ["aiLabel", "aiStatus", "humanLabel", "humanStatus", "humanCta"];
    const unlabelled = ROUTE_KEYS.filter(
      (key) => typeof routes[key] !== "string" || routes[key].trim().length === 0,
    );
    expect(
      `both routes are labelled in ${code}`,
      unlabelled.length === 0,
      unlabelled.length > 0 ? `missing ${unlabelled.join(", ")}` : "AI route and human route",
    );
    expect(
      `the ${code} route labels cannot be mistaken for each other`,
      routes.aiLabel !== routes.humanLabel && routes.aiLabel !== routes.humanCta,
      `"${routes.aiLabel}" vs "${routes.humanLabel}"`,
    );
  }
});

/* ------------------------------------------------------- pilot safeguards */

await step("pilot safeguards", async () => {
  const root = new URL("../", import.meta.url).pathname;

  // The cap is one number, written in one place. A change to the owner's figure
  // has to be a deliberate edit to that constant, not a stray value elsewhere.
  expect(
    "the pilot document cap is a whole number of at least one",
    Number.isInteger(MONTHLY_DOCUMENT_CAP) && MONTHLY_DOCUMENT_CAP >= 1,
    `${MONTHLY_DOCUMENT_CAP} documents per person per calendar month`,
  );
  expect(
    "the reading-aid acknowledgement carries a version",
    typeof READING_AID_VERSION === "string" &&
      READING_AID_VERSION.trim().length > 0,
    READING_AID_VERSION,
  );

  // Wording that would claim a conclusion about German law. The acknowledgement
  // may only say what is true while the legal question is open — see the business
  // plan — so no language may promise that the help is lawful, unlawful, or legal
  // advice. Checked in every language so a translation cannot smuggle a claim in.
  const FORBIDDEN = [
    "Rechtsberatung",
    "legal advice",
    "rechtmäßig",
    "rechtswidrig",
    "unlawful",
    "lawful",
    "gesetzlich zulässig",
  ];

  for (const language of LANGUAGES) {
    const { code, dictionary: t } = language;
    const ack = typeof t.intake?.readingAid === "string" ? t.intake.readingAid : "";
    const pilot = t.pilot ?? {};

    expect(
      `the reading-aid acknowledgement exists in ${code}`,
      ack.trim().length > 0,
      ack.trim().length > 0 ? `${ack.trim().split(/\s+/).length} words` : "missing",
    );
    expect(
      `the ${code} acknowledgement is labelled and has a hint`,
      [t.intake?.readingAidLabel, t.intake?.readingAidHint].every(
        (value) => typeof value === "string" && value.trim().length > 0,
      ),
      "label and hint",
    );
    expect(
      `the ${code} acknowledgement has a refusal message`,
      typeof t.errors?.readingAidRequired === "string" &&
        t.errors.readingAidRequired.trim().length > 0,
      "errors.readingAidRequired",
    );

    const claimed = FORBIDDEN.filter((word) =>
      ack.toLowerCase().includes(word.toLowerCase()),
    );
    expect(
      `the ${code} acknowledgement claims no conclusion about the law`,
      claimed.length === 0,
      claimed.length > 0 ? `contains "${claimed.join('", "')}"` : "no legal claim",
    );

    const CAP_KEYS = [
      "capTitle",
      "capBody",
      "usage",
      "reachedTitle",
      "reachedBody",
      "contactCta",
    ];
    const missingCap = CAP_KEYS.filter(
      (key) =>
        typeof pilot[key] !== "string" || pilot[key].trim().length === 0,
    );
    expect(
      `the ${code} cap message is complete`,
      missingCap.length === 0,
      missingCap.length > 0 ? `missing ${missingCap.join(", ")}` : CAP_KEYS.length + " strings",
    );
    // The numbers are put into the sentence by the page, so every language has to
    // keep the placeholders — otherwise the person never sees how many are left.
    expect(
      `the ${code} cap text keeps its number placeholders`,
      typeof pilot.usage === "string" &&
        pilot.usage.includes("{used}") &&
        pilot.usage.includes("{cap}") &&
        typeof pilot.capBody === "string" &&
        pilot.capBody.includes("{cap}"),
      "{used}, {cap}",
    );
    expect(
      `the ${code} cap has a plain refusal message`,
      typeof t.errors?.capReached === "string" &&
        t.errors.capReached.trim().length > 0,
      "errors.capReached",
    );
  }

  // German governs, so the facts it has to state are checked in German: we pay
  // per letter ourselves, nothing is charged, and the acknowledgement says what we
  // are and what we are not.
  const de = DEFAULT.dictionary;
  expect(
    "the German cap text says we pay ourselves and that nothing is charged",
    /selbst/.test(de.pilot.capBody) && /nichts berechnet/.test(de.pilot.capBody),
    "Pilotbetrieb, nichts berechnet",
  );
  expect(
    "the German acknowledgement names the aid, not-lawyers, not-an-authority and the deadline",
    /Lese- und Verständnishilfe/.test(de.intake.readingAid) &&
      /keine Anwältinnen und Anwälte/.test(de.intake.readingAid) &&
      /keine Behörde/.test(de.intake.readingAid) &&
      /Frist selbst/.test(de.intake.readingAid),
    "four facts",
  );

  // The wording lives in the language files and never in the page: a native
  // speaker has to be able to fix it in one place, in one language.
  const page = readFileSync(join(root, "src/routes/anliegen.tsx"), "utf8");
  const inline = LANGUAGES.filter((language) => {
    const text = language.dictionary.intake.readingAid;
    return typeof text === "string" && text.length > 20 && page.includes(text.slice(0, 40));
  }).map((language) => language.code);
  expect(
    "the acknowledgement is not written into the page itself",
    inline.length === 0,
    inline.length > 0 ? `inline in ${inline.join(", ")}` : "comes from the language files",
  );

  // And the gates are on the server, not only in the form: a disabled button is
  // not a rule. The rules live in `src/server/pilot.server.ts` and the page's
  // server function turns their refusal into words — both are checked here.
  const fns = readFileSync(join(root, "src/server/fns.ts"), "utf8");
  expect(
    "the server function sends every submission through the pilot rules",
    /saveRequestUnderPilotRules/.test(fns) &&
      /errors\.readingAidRequired/.test(fns) &&
      /errors\.capReached/.test(fns),
    "refusals translated in submitIntake",
  );
  const rules = readFileSync(join(root, "src/server/pilot.server.ts"), "utf8");
  expect(
    "a document without the acknowledgement is refused before anything is saved",
    /reading_aid_missing/.test(rules) &&
      rules.indexOf("reading_aid_missing") < rules.indexOf("saveRequest("),
    "gate before the write",
  );
  expect(
    "the monthly count is a read of our own database, through the access module",
    /countDocumentsThisMonth/.test(rules) && /cap_reached/.test(rules),
    "countDocumentsThisMonth + cap_reached",
  );
  const access = readFileSync(join(root, "src/server/access.server.ts"), "utf8");
  expect(
    "the monthly count lives in the access module",
    /export async function countDocumentsThisMonth/.test(access),
    "countDocumentsThisMonth",
  );
});

/* ------------------------------------------------- pilot meter on AI work */

await step("pilot meter counts AI work, never stored paperwork", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const CAP = MONTHLY_DOCUMENT_CAP;
  const docs = (count, aiMetered) =>
    Array.from({ length: count }, () => ({ aiMetered }));

  // (a) STORING IS UNLIMITED. Forty documents that are not AI work are not over
  // any limit, because the meter does not count them at all.
  expect(
    "storing far more than the cap is never refused",
    meteredDocumentCount(docs(40, false)) === 0 &&
      overCap(0, meteredDocumentCount(docs(40, false)), CAP) === false,
    "40 stored documents, 0 counted",
  );

  // (b) WITH THE METER ON, AI WORK STOPS AT THE CAP.
  expect(
    "with the meter on, the document past the cap is refused",
    overCap(CAP, 1, CAP) === true && overCap(CAP - 1, 1, CAP) === false,
    `${String(CAP)} accepted, the next one refused`,
  );

  // (c) WITH THE METER OFF, NOTHING IS REFUSED — even with the meter already full
  // of AI work from earlier in the month.
  expect(
    "with the meter off, nothing is refused even past the cap",
    overCap(CAP, 0, CAP) === false && overCap(CAP, meteredDocumentCount(docs(5, false)), CAP) === false,
    "5 more stored documents after the cap, none refused",
  );

  // The switch and the copy have to agree with each other. While no provider is
  // connected, every language must say plainly that nothing is refused today.
  expect(
    "the AI route is off, and every language says so",
    AI_ROUTE_CONNECTED === false &&
      LANGUAGES.every(
        (language) =>
          typeof language.dictionary.pilot?.notConnected === "string" &&
          language.dictionary.pilot.notConnected.trim().length > 0,
      ),
    AI_ROUTE_CONNECTED === false ? "no provider connected, said in every language" : "AI route is ON",
  );

  // The owner's rule in words: storing is unlimited and the number is about the
  // AI. Checked in German (which governs) and in English.
  const de = DEFAULT.dictionary;
  expect(
    "the German copy says storing is unlimited and the limit is the AI's",
    /unbegrenzt|keine Grenze/i.test(de.pilot.capBody) &&
      /KI/.test(de.pilot.capBody) &&
      /keine Schranke/i.test(de.pilot.capBody),
    "unbegrenzt, KI, keine Schranke",
  );
  const english = LANGUAGES.find((language) => language.code === "en");
  expect(
    "the English copy says storing is unlimited and the limit is the AI's",
    english !== undefined &&
      /unlimited/i.test(english.dictionary.pilot.capTitle) &&
      /AI/i.test(english.dictionary.pilot.capBody),
    "unlimited, AI",
  );

  // The rule is also proved against the real database, not only in arithmetic.
  // That script imports the app's own gate and count and cleans up after itself.
  expect(
    "a database-backed check of the meter exists and is documented",
    readFileSync(join(root, "scripts/pilot-cap-check.mjs"), "utf8").includes(
      "saveRequestUnderPilotRules",
    ),
    "scripts/pilot-cap-check.mjs",
  );
});

/* ------------------------------------------- the dashboard mirrors for RTL */

await step("dashboard, right to left", async () => {
  const root = new URL("../", import.meta.url).pathname;
  // Arabic mirrors the whole layout, so the dashboard and its cards may only use
  // logical utilities (`ms-`, `pe-`, `text-start`, …). A physical one would stay
  // on the left when the page turns around — see `src/routes/dashboard.tsx`.
  const FILES = [
    "src/routes/dashboard.tsx",
    "src/components/capabilities.tsx",
    "src/routes/meine-anliegen.tsx",
    "src/routes/postfach.tsx",
  ];
  const PHYSICAL = [
    "ml-",
    "mr-",
    "pl-",
    "pr-",
    "text-left",
    "text-right",
    "border-l-",
    "border-r-",
    "rounded-l-",
    "rounded-r-",
    "float-left",
    "float-right",
  ];
  const offenders = [];
  for (const name of FILES) {
    const text = readFileSync(join(root, name), "utf8");
    for (const token of PHYSICAL) {
      if (text.includes(token)) offenders.push(`${name} uses "${token}"`);
    }
  }
  expect(
    "the dashboard, the request list and the inbox use logical direction utilities only",
    offenders.length === 0,
    offenders.length > 0 ? offenders.join(", ") : FILES.length + " files, no left/right",
  );
});

/* ------------------------------------------------- one read path, enforced */

await step("one read path", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) files.push(full);
    }
  };
  walk(join(root, "src"));
  walk(join(root, "scripts"));

  // A read of a case or a document may only live in the access module. The
  // schema module is allowed as well, because its migration has to read the
  // rows it is filling in — and it is the file that creates the tables.
  const READ = /\bfrom\s+(requests|documents)\b/;
  const READ_ALLOWED = [
    "src/server/access.server.ts",
    "src/server/schema.server.ts",
  ];
  // A verification harness under scripts/ is not app code: it reads the rows it
  // created itself so it can prove a rule against the real database and then
  // delete them, and it never runs in the app. This rule is what keeps the
  // allowance from growing one file at a time — everything under src/ still has
  // to go through the access module, harness or not.
  const isHarness = (name) =>
    name.startsWith("scripts/") && name.endsWith("-check.mjs");
  // A write may only live in the one write path (data.server.ts) and in the
  // migration. No route and no component ever writes a case itself.
  const WRITE = /\b(into|update)\s+(requests|documents)\b/i;
  const WRITE_ALLOWED = ["src/server/data.server.ts", "src/server/schema.server.ts"];

  const readOffenders = [];
  const writeOffenders = [];
  for (const file of files) {
    const name = relative(root, file).split("\\").join("/");
    const text = readFileSync(file, "utf8");
    if (READ.test(text) && !READ_ALLOWED.includes(name) && !isHarness(name))
      readOffenders.push(name);
    if (WRITE.test(text) && !WRITE_ALLOWED.includes(name)) writeOffenders.push(name);
  }

  expect(
    "only the access module reads cases or documents",
    readOffenders.length === 0,
    readOffenders.length > 0
      ? `also in ${readOffenders.join(", ")}`
      : READ_ALLOWED.join(", "),
  );
  expect(
    "only the write path writes cases or documents",
    writeOffenders.length === 0,
    writeOffenders.length > 0
      ? `also in ${writeOffenders.join(", ")}`
      : WRITE_ALLOWED.join(", "),
  );
});

/* --------------------------------------- the request list and the inbox */

/*
 * STAGE 10 — the person's own list and the owner's private inbox.
 *
 * What is checked here, and why each one would fail a real promise if it broke:
 *   - a signed-out visitor gets the sign-in redirect from both private pages, in
 *     the server response (not from a client-side guard);
 *   - every language can label the three case statuses and carries the whole of
 *     both new sections, so a half-translated page cannot ship;
 *   - the notice a person receives says it is from US, in every language;
 *   - no authority's name appears in either section, and the German inbox says in
 *     so many words that it is not an authority;
 *   - the owner-only rule is on the server (a role check in the server functions
 *     and an owner viewer in the access module), and the page answers "not found"
 *     rather than drawing an empty inbox;
 *   - deleting really deletes (a DELETE statement, and no `deleted_at` column that
 *     would turn it into a hide).
 */
await step("the request list and the owner's inbox", async () => {
  const root = new URL("../", import.meta.url).pathname;

  for (const [label, path] of [
    ["/meine-anliegen", "/meine-anliegen"],
    ["/postfach", "/postfach"],
  ]) {
    const response = await get(path, { redirect: "manual" });
    expect(
      `GET ${label} redirects a signed-out visitor to /anmelden`,
      response.status === 307 && (response.location ?? "").includes("/anmelden"),
      `status ${response.status}, location ${response.location ?? "-"}`,
    );
  }

  // German authority names must not appear in either section: this is our own
  // casework, not a console for an office.
  const AUTHORITY_NAMES = [
    "Bürgeramt",
    "Einwohnermeldeamt",
    "Ausländerbehörde",
    "Finanzamt",
    "Jobcenter",
    "Sozialamt",
    "Standesamt",
    "Bundesamt",
    "Krankenkasse",
    "Amtsgericht",
  ];

  for (const language of LANGUAGES) {
    const { code, dictionary: t } = language;

    const missingStatuses = ["received", "in_progress", "completed"].filter(
      (status) =>
        typeof t.caseStatus?.[status] !== "string" ||
        t.caseStatus[status].trim().length === 0,
    );
    expect(
      `every case status has a ${code} label`,
      missingStatuses.length === 0 && typeof t.caseStatus?.label === "string",
      missingStatuses.length > 0 ? `missing ${missingStatuses.join(", ")}` : "3 labels",
    );

    const MY_KEYS = [
      "title",
      "lead",
      "receivedLabel",
      "areaLabel",
      "documentsTitle",
      "noDocuments",
      "download",
      "emptyTitle",
      "emptyLead",
      "emptyCta",
      "deleteCta",
      "deleteConfirmTitle",
      "deleteConfirmNote",
      "deleteConfirmYes",
      "deleteCancel",
      "deleted",
      "noticeTitle",
      "noticeFrom",
      "noticeCaseLabel",
      "noticeFileLabel",
      "noticeAttachSubmit",
      "noticeAttached",
      "noticeDismiss",
      "noticeDismissHint",
    ];
    const missingMy = MY_KEYS.filter(
      (key) =>
        typeof t.myRequests?.[key] !== "string" ||
        t.myRequests[key].trim().length === 0,
    );
    expect(
      `the ${code} request list has all of its copy`,
      missingMy.length === 0,
      missingMy.length > 0 ? `missing ${missingMy.join(", ")}` : `${MY_KEYS.length} strings`,
    );

    const INBOX_KEYS = [
      "title",
      "lead",
      "honestyTitle",
      "honesty",
      "emptyTitle",
      "emptyLead",
      "personLabel",
      "emailLabel",
      "cityLabel",
      "stateLabel",
      "subjectLabel",
      "areaLabel",
      "receivedLabel",
      "statusLabel",
      "messageLabel",
      "documentsLabel",
      "noDocuments",
      "download",
      "markInProgress",
      "markCompleted",
      "markReceived",
      "noticeTitle",
      "noticeIntro",
      "noticeField",
      "noticeHint",
      "noticeSubmit",
      "noticeSent",
      "noticesTitle",
      "noticeStateOpen",
      "noticeStateDismissed",
      "noticeStateFulfilled",
      "noNotices",
    ];
    const missingInbox = INBOX_KEYS.filter(
      (key) =>
        typeof t.inbox?.[key] !== "string" || t.inbox[key].trim().length === 0,
    );
    expect(
      `the ${code} inbox has all of its copy`,
      missingInbox.length === 0,
      missingInbox.length > 0 ? `missing ${missingInbox.join(", ")}` : `${INBOX_KEYS.length} strings`,
    );

    // THE NOTICE IS FROM US. Wherever it is shown, it names the business — so it
    // can never read as if an authority had asked for the document.
    expect(
      `the ${code} notice says it comes from ${t.brand.name}`,
      typeof t.myRequests?.noticeFrom === "string" &&
        t.myRequests.noticeFrom.includes(t.brand.name),
      `"${t.myRequests?.noticeFrom ?? "-"}"`,
    );

    const sectionText = JSON.stringify({ ...t.myRequests, ...t.inbox });
    const named = AUTHORITY_NAMES.filter((name) => sectionText.includes(name));
    expect(
      `the ${code} request list and inbox name no authority`,
      named.length === 0,
      named.length > 0 ? `contains ${named.join(", ")}` : "none of " + AUTHORITY_NAMES.length,
    );
  }

  // German governs, so the fact that matters most is checked in German: the inbox
  // says in so many words that it is not an authority.
  const de = DEFAULT.dictionary;
  expect(
    "the German inbox says plainly that it is not an authority",
    /kein Amt/i.test(de.inbox.honesty) && /keine Behörde/i.test(de.inbox.honesty),
    "kein Amt, keine Behörde",
  );

  // THE OWNER-ONLY RULE LIVES ON THE SERVER. A hidden link is not a rule.
  const fns = readFileSync(join(root, "src/server/fns.ts"), "utf8");
  expect(
    "the owner's server functions check the stored role",
    (fns.match(/isOwnerRole\(user\.role\)/g) ?? []).length >= 3,
    "owner inbox, status and notice",
  );
  const access = readFileSync(join(root, "src/server/access.server.ts"), "utf8");
  expect(
    "only an owner viewer can read every person's cases",
    /export function viewerForOwner/.test(access) &&
      /an owner view needs an owner account/.test(access) &&
      /export async function listAllCasesForOwner/.test(access),
    "viewerForOwner refuses every other account",
  );
  const inboxPage = readFileSync(join(root, "src/routes/postfach.tsx"), "utf8");
  expect(
    "the inbox answers not-found to a signed-in account that is not the owner",
    /throw notFound\(\)/.test(inboxPage) && /state === "forbidden"/.test(inboxPage),
    "notFound() before anything renders",
  );

  // DELETING MEANS DELETING. A DELETE statement and no `deleted_at` column: if a
  // hide column ever appears, this check fails and someone has to say why.
  const writes = readFileSync(join(root, "src/server/data.server.ts"), "utf8");
  const schema = readFileSync(join(root, "src/server/schema.server.ts"), "utf8");
  expect(
    "deleting a request deletes the rows, and nothing is soft-deleted",
    /delete from requests/.test(writes) &&
      !/deleted_at/.test(schema) &&
      !/hidden_at/.test(schema),
    "delete from requests, no deleted_at",
  );
  expect(
    "the delete is keyed on the person's own id",
    /delete from requests[\s\S]{0,200}user_id = \$\{input\.userId\}/.test(writes),
    "user_id in the WHERE clause",
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

  // The dashboard is private too: a signed-out visitor is sent to sign in, never
  // shown an empty page that looks like an account with no cases.
  const dashboard = await get("/dashboard", { redirect: "manual" });
  const dashboardToSignIn =
    dashboard.status === 307 && (dashboard.location ?? "").includes("/anmelden");
  expect(
    "GET /dashboard redirects a signed-out visitor to /anmelden",
    dashboardToSignIn,
    `status ${dashboard.status}, location ${dashboard.location ?? "-"}`,
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
