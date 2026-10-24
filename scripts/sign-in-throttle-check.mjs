/**
 * SIGN-IN THROTTLE CHECK — exercises the login_attempts rule against the real
 * database and prints what actually happens at each step.
 *
 * The rule under test (`authenticate` / `recordFailure` in `src/server/data.server.ts`):
 *   - 5 failed attempts for one email address lock that address for 15 minutes,
 *   - the lock refuses the CORRECT password too,
 *   - a successful sign-in clears the count,
 *   - a failure older than the window no longer counts.
 *
 * It also shows the limit nobody can design away here: the counter is per email
 * address, so anyone who knows an address can lock its owner out for 15 minutes.
 *
 * SAFETY: one throwaway user (prefix `dai-test-throttle-`), deleted before the
 * final counts. Never prints the connection string or the password.
 *
 * Run from the site directory:  bun scripts/sign-in-throttle-check.mjs
 */
const BASE = new URL("../", import.meta.url).pathname;
if (!process.env.DATABASE_URL) {
  console.error("sign-in-throttle-check: DATABASE_URL is not set — nothing to check against.");
  process.exit(1);
}

const { sql } = await import(`${BASE}src/db.ts`);
const data = await import(`${BASE}src/server/data.server.ts`);

const q = sql();
let total = 0;
let failures = 0;
function check(name, passed, detail) {
  total += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

const stamp = Date.now();
const email = `dai-test-throttle-${stamp}@example.com`;
const emailNorm = email.toLowerCase();
const password = "correct-horse-1";

const attempt = (candidate) => data.authenticate({ email, password: candidate });
const wrong = "definitely-not-it";

async function cleanup() {
  try {
    await q`delete from documents where request_id in (select id from requests where user_id in (select id from users where email_norm like 'dai-test-throttle-%'))`;
    await q`delete from requests where user_id in (select id from users where email_norm like 'dai-test-throttle-%')`;
    await q`delete from sessions where user_id in (select id from users where email_norm like 'dai-test-throttle-%')`;
    await q`delete from users where email_norm like 'dai-test-throttle-%'`;
    await q`delete from login_attempts where email_norm like 'dai-test-throttle-%'`;
  } catch (error) {
    console.error("cleanup failed:", error instanceof Error ? error.message : "unknown");
  }
}

try {
  const created = await data.createUser({ name: "Throttle Check", email, password });
  if (!created.ok) throw new Error("could not create the throwaway user");

  /* --- 1. four wrong attempts: no lock yet, the count is visible ---------- */
  for (let i = 1; i <= 4; i += 1) {
    const result = await attempt(wrong);
    if (i === 4) {
      const row = await q`select failed_count, locked_until from login_attempts where email_norm = ${emailNorm}`;
      check(
        "after 4 wrong passwords the account is NOT locked",
        result.ok === false && result.code === "invalid" &&
          row.length === 1 && Number(row[0].failed_count) === 4 && row[0].locked_until === null,
        `failed_count=${String(row[0]?.failed_count)}, locked_until=${String(row[0]?.locked_until)}`,
      );
    }
  }

  /* --- 2. the correct password still works before the threshold ---------- */
  const beforeLock = await attempt(password);
  check(
    "the correct password still works at 4 failures, and clears the counter",
    beforeLock.ok === true,
    beforeLock.ok ? "signed in" : `code=${beforeLock.code}`,
  );
  const cleared = await q`select count(*)::int as n from login_attempts where email_norm = ${emailNorm}`;
  check("a successful sign-in deletes the failure row", Number(cleared[0].n) === 0, `rows=${cleared[0].n}`);

  /* --- 3. five wrong attempts lock the address --------------------------- */
  for (let i = 1; i <= 5; i += 1) {
    const result = await attempt(wrong);
    check(`wrong password ${i} of 5 is refused as invalid`, result.ok === false && result.code === "invalid", `code=${result.code}`);
  }
  /*
   * The lock is written by the 5th failure, so it is the NEXT attempt that is told
   * about it. That is deliberate and it is the behaviour a person sees: five wrong
   * passwords each say "wrong", and the sixth says "too many attempts".
   */
  const sixth = await attempt(wrong);
  check(
    "the 6th attempt is refused as locked (the lock is written by the 5th failure)",
    sixth.ok === false && sixth.code === "locked",
    `code=${sixth.code}`,
  );
  const locked = await q`select failed_count, locked_until from login_attempts where email_norm = ${emailNorm}`;
  const minutes = locked.length
    ? Math.round((new Date(String(locked[0].locked_until)).getTime() - Date.now()) / 60000)
    : -1;
  check(
    "the lock is 15 minutes and the counter is reset to 0 while locked",
    locked.length === 1 && Number(locked[0].failed_count) === 0 && minutes >= 14 && minutes <= 15,
    `failed_count=${String(locked[0]?.failed_count)}, minutes left=${minutes}`,
  );

  /* --- 4. the lock refuses the CORRECT password ------------------------- */
  const duringLock = await attempt(password);
  check(
    "the correct password is refused while the address is locked",
    duringLock.ok === false && duringLock.code === "locked",
    duringLock.ok ? "SIGNED IN — the lock does not hold" : `code=${duringLock.code}`,
  );

  /* --- 5. the lock expires ---------------------------------------------- */
  await q`update login_attempts set locked_until = now() - interval '1 minute' where email_norm = ${emailNorm}`;
  const afterExpiry = await attempt(password);
  check(
    "after the 15 minutes the correct password works again",
    afterExpiry.ok === true,
    afterExpiry.ok ? "signed in" : `code=${afterExpiry.code}`,
  );

  /* --- 6. old failures do not count ------------------------------------- */
  await q`delete from login_attempts where email_norm = ${emailNorm}`;
  await q`insert into login_attempts (email_norm, failed_count, locked_until, updated_at)
          values (${emailNorm}, 4, null, now() - interval '1 hour')`;
  const stale = await attempt(wrong);
  const staleRow = await q`select failed_count, locked_until from login_attempts where email_norm = ${emailNorm}`;
  check(
    "4 failures from an hour ago do not lock anyone out; the count starts again",
    stale.ok === false && stale.code === "invalid" &&
      Number(staleRow[0]?.failed_count) === 1 && staleRow[0]?.locked_until === null,
    `code=${stale.code}, failed_count=${String(staleRow[0]?.failed_count)}`,
  );

  /* --- 7. anyone can lock a known address (the limit, shown) ------------ */
  await q`delete from login_attempts where email_norm = ${emailNorm}`;
  for (let i = 1; i <= 5; i += 1) await attempt("someone-elses-guess");
  const lockedByStranger = await attempt(password);
  check(
    "a stranger who knows the address can lock its owner out for 15 minutes",
    lockedByStranger.ok === false && lockedByStranger.code === "locked",
    "this is the deliberate trade, not a bug — reported to the lead",
  );

  /* --- 8. an unknown address is throttled the same way ------------------ */
  const ghost = `dai-test-throttle-ghost-${stamp}@example.com`;
  const ghostCodes = [];
  for (let i = 1; i <= 6; i += 1) {
    const result = await data.authenticate({ email: ghost, password: wrong });
    ghostCodes.push(result.ok ? "ok" : result.code);
  }
  check(
    "an address with no account is refused identically, and also locks (no account enumeration)",
    ghostCodes.slice(0, 5).every((code) => code === "invalid") && ghostCodes[5] === "locked",
    ghostCodes.join(","),
  );
} finally {
  await cleanup();
}

/* ------------------------------------------------------------------- counts */

const counts = {
  users: Number((await q`select count(*)::int as n from users`)[0].n),
  sessions: Number((await q`select count(*)::int as n from sessions`)[0].n),
  requests: Number((await q`select count(*)::int as n from requests`)[0].n),
  documents: Number((await q`select count(*)::int as n from documents`)[0].n),
  login_attempts: Number((await q`select count(*)::int as n from login_attempts`)[0].n),
};
console.log(
  `\nrows left — users=${counts.users} sessions=${counts.sessions} requests=${counts.requests} documents=${counts.documents} login_attempts=${counts.login_attempts}`,
);
check("every table is back at 0 after the run", Object.values(counts).every((n) => n === 0), JSON.stringify(counts));

console.log(failures === 0 ? `\nall ${total} checks passed` : `\n${failures} of ${total} checks FAILED`);
process.exit(failures === 0 ? 0 : 1);
