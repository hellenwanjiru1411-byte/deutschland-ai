/**
 * THE PILOT METER, AGAINST THE REAL DATABASE — the owner's rule proved, not
 * assumed:
 *
 *   (a) MORE THAN THREE DOCUMENTS CAN BE STORED. Storing and organising paperwork
 *       is unlimited; five submissions of two documents each all go through while
 *       the AI route is off, and the meter stays at 0.
 *   (b) WITH THE METER ON, AI WORK STOPS AT THREE. The fourth AI-counted document
 *       in the calendar month is refused, with the code `cap_reached` — and the
 *       three before it were accepted.
 *   (c) WITH THE METER OFF, NOTHING IS REFUSED. The same person, over the same
 *       month, keeps filing documents after the three AI documents already stored.
 *
 * HOW IT RUNS: it imports the app's own modules — `saveRequestUnderPilotRules`
 * (`src/server/pilot.server.ts`) and `countDocumentsThisMonth`
 * (`src/server/access.server.ts`) — so the gate, the write path and the count are
 * the ones the live site uses, not a copy of them. The meter is turned for this
 * process only, through the same environment switch the server reads
 * (`PILOT_AI_METER=1` / `=0`, see `aiMeteringEnabled` in `src/server/data.server.ts`).
 *
 * SAFETY: it creates one throwaway user with a `pilot-cap-check-` prefix, deletes
 * everything it wrote (documents → requests → user) before printing the final
 * counts, and never prints the connection string or any document content.
 *
 * Run from the site directory:  bun scripts/pilot-cap-check.mjs
 * Requires `DATABASE_URL` in the environment; without it the script stops.
 */
import { randomUUID } from "node:crypto";

const BASE = new URL("../", import.meta.url).pathname;

if (!process.env.DATABASE_URL) {
  console.error("pilot-cap-check: DATABASE_URL is not set — nothing to check against.");
  process.exit(1);
}

const { sql } = await import(`${BASE}src/db.ts`);
const { ensureSchema } = await import(`${BASE}src/server/schema.server.ts`);
const { saveRequestUnderPilotRules } = await import(
  `${BASE}src/server/pilot.server.ts`
);
const { countDocumentsThisMonth, viewerForUser } = await import(
  `${BASE}src/server/access.server.ts`
);
const { meteredDocumentCount, overCap } = await import(
  `${BASE}src/lib/pilot-cap.ts`
);
const { aiMeteringEnabled, monthlyDocumentCap } = await import(
  `${BASE}src/server/data.server.ts`
);

const CAP = monthlyDocumentCap();
const q = sql();
let failures = 0;
let total = 0;

function check(name, passed, detail) {
  total += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

/** A tiny but real PDF, base64 — the write path stores bytes, it does not read them. */
const PDF_BASE64 = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
).toString("base64");

function document() {
  return {
    filename: "pilot-cap-check.pdf",
    mimeType: "application/pdf",
    size: Buffer.from(PDF_BASE64, "base64").length,
    contentBase64: PDF_BASE64,
    // Stamped by the caller exactly as `submitIntake` stamps it: from the one
    // switch, on the server.
    aiMetered: aiMeteringEnabled(),
  };
}

function submission(userId, count) {
  return {
    userId,
    city: "Berlin",
    state: "Berlin",
    subject: "anmeldung",
    message:
      "Prüfung der Pilotgrenze: Dieses Anliegen wird vom Prüfskript angelegt und sofort wieder gelöscht.",
    phone: null,
    documents: Array.from({ length: count }, document),
    readingAidAck: true,
    locale: "de",
  };
}

await ensureSchema();

/*
 * Start from a clean slate: a previous run that was killed before its cleanup
 * would otherwise leave rows behind and make the final counts lie. Only rows this
 * script itself creates are touched — the `pilot-cap-check-` prefix is the marker,
 * and it is a domain that cannot receive mail (`example.invalid`).
 */
async function purgeStaleCheckRows() {
  const stale = await q`select id from users where email_norm like ${"pilot-cap-check-%"}`;
  for (const row of stale) {
    const id = String(row.id);
    await q`delete from documents where request_id in (select id from requests where user_id = ${id})`;
    await q`delete from requests where user_id = ${id}`;
    await q`delete from sessions where user_id = ${id}`;
    await q`delete from users where id = ${id}`;
  }
  await q`delete from login_attempts where email_norm like ${"pilot-cap-check-%"}`;
  return stale.length;
}
const purged = await purgeStaleCheckRows();
if (purged > 0) console.log(`cleaned up ${purged} leftover check account(s) first`);

const userId = randomUUID();
const email = `pilot-cap-check-${userId}@example.invalid`;
await q`insert into users (id, name, email, email_norm, password_hash)
        values (${userId}, ${"Pilot Cap Check"}, ${email}, ${email},
                ${"not-a-real-password-hash"})`;

const viewer = viewerForUser({ id: userId });

try {
  /* ------------------------------------------------------------------ (a) */
  // Meter OFF: storing is unlimited. Two documents per submission, five times —
  // ten documents, far past the number three, and not one refusal.
  process.env.PILOT_AI_METER = "0";
  let stored = 0;
  let refused = 0;
  for (let i = 0; i < 5; i += 1) {
    const result = await saveRequestUnderPilotRules(submission(userId, 2));
    if (result.ok) stored += 2;
    else refused += 1;
  }
  const afterStore = await q`select count(*)::int as n, count(*) filter (where ai_metered)::int as metered
                             from documents d join requests r on r.id = d.request_id
                             where r.user_id = ${userId}`;
  const storedRows = Number(afterStore[0].n);
  const meteredRows = Number(afterStore[0].metered);
  const meterOff = await countDocumentsThisMonth(viewer);

  check(
    "(a) more than three documents are stored while the meter is off",
    stored === 10 && refused === 0 && storedRows === 10,
    `${storedRows} documents in the database, ${refused} refused`,
  );
  check(
    "(a) stored documents are not AI work, so the meter reads 0",
    meteredRows === 0 && meterOff === 0,
    `${meteredRows} marked ai_metered, meter says ${meterOff}`,
  );

  /* ------------------------------------------------------------------ (b) */
  // Meter ON: the next AI-counted documents are limited. Two are accepted, then
  // one more fills the meter (3), and the fourth is refused.
  process.env.PILOT_AI_METER = "1";
  const first = await saveRequestUnderPilotRules(submission(userId, 2));
  const second = await saveRequestUnderPilotRules(submission(userId, 1));
  const overTheLine = await saveRequestUnderPilotRules(submission(userId, 1));
  const meterOn = await countDocumentsThisMonth(viewer);

  check(
    "(b) AI work is accepted up to the limit",
    first.ok === true && second.ok === true,
    `two accepted, then one more = ${CAP}`,
  );
  check(
    "(b) the next AI document is refused at the limit",
    overTheLine.ok === false && overTheLine.code === "cap_reached",
    overTheLine.ok === false ? `code ${overTheLine.code}` : "NOT refused",
  );
  check(
    `(b) the meter counts exactly the AI documents (${meterOn} = ${CAP})`,
    meterOn === CAP,
    `countDocumentsThisMonth = ${meterOn}`,
  );

  /* ------------------------------------------------------------------ (c) */
  // Meter OFF again: nothing is refused, even though three AI documents are
  // already on record this month. The count is unchanged, because these are not
  // AI work.
  process.env.PILOT_AI_METER = "0";
  const afterLimit = await saveRequestUnderPilotRules(submission(userId, 2));
  const meterAfter = await countDocumentsThisMonth(viewer);

  check(
    "(c) with the meter off nothing is refused, even past three",
    afterLimit.ok === true,
    afterLimit.ok === true ? "accepted" : `refused with ${afterLimit.code}`,
  );
  check(
    "(c) documents stored after the limit do not count as AI work",
    meterAfter === CAP,
    `countDocumentsThisMonth still ${meterAfter}`,
  );

  /* ----------------------------------------------------- the pure rule too */
  // The arithmetic itself, without the database: the same rule the gate uses.
  const unmetered = Array.from({ length: 40 }, () => ({ aiMetered: false }));
  const metered = Array.from({ length: 4 }, () => ({ aiMetered: true }));
  check(
    "the pure rule: forty stored documents are never over the limit",
    meteredDocumentCount(unmetered) === 0 &&
      overCap(0, meteredDocumentCount(unmetered), CAP) === false,
    "0 metered of 40",
  );
  check(
    "the pure rule: the fourth AI document in a month is over the limit",
    meteredDocumentCount(metered) === 4 &&
      overCap(CAP, 1, CAP) === true &&
      overCap(CAP - 1, 1, CAP) === false,
    "3 + 1 is over, 2 + 1 is not",
  );
} finally {
  /* --------------------------------------------------------------- cleanup */
  await q`delete from documents where request_id in
            (select id from requests where user_id = ${userId})`;
  await q`delete from requests where user_id = ${userId}`;
  await q`delete from sessions where user_id = ${userId}`;
  await q`delete from users where id = ${userId}`;
  await q`delete from login_attempts where email_norm = ${email}`;
}

const counts = {};
counts.users = Number((await q`select count(*)::int as n from users`)[0].n);
counts.sessions = Number((await q`select count(*)::int as n from sessions`)[0].n);
counts.requests = Number((await q`select count(*)::int as n from requests`)[0].n);
counts.documents = Number((await q`select count(*)::int as n from documents`)[0].n);
counts.login_attempts = Number(
  (await q`select count(*)::int as n from login_attempts`)[0].n,
);
console.log(
  `\nleft behind — users ${counts.users}, sessions ${counts.sessions}, ` +
    `requests ${counts.requests}, documents ${counts.documents}, ` +
    `login_attempts ${counts.login_attempts}`,
);
const leftover =
  counts.users + counts.sessions + counts.requests + counts.documents > 0;
check("no test data left behind", !leftover, "all tables at zero");

console.log(
  failures === 0
    ? `\nall ${total} checks passed (cap = ${CAP} AI documents per person per calendar month)`
    : `\n${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
