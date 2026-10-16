// TEMPORARY verification script — deleted at the end of this test run.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const mode = process.argv[2] ?? "inspect";

const counts = async () => {
  const q = async (t: string) =>
    Number((await sql.query(`select count(*)::int as n from ${t}`))[0].n);
  return {
    users: await q("users"),
    sessions: await q("sessions"),
    requests: await q("requests"),
    documents: await q("documents"),
    login_attempts: await q("login_attempts"),
  };
};

if (mode === "counts") {
  console.log(JSON.stringify(await counts(), null, 2));
} else if (mode === "inspect") {
  const out: Record<string, unknown> = {};
  const users = await sql`select id, name, email, created_at from users order by created_at`;
  out.users = users.map((r) => ({ id: r.id, name: r.name, email: r.email }));
  const reqs = await sql`select r.id, r.user_id, u.email as owner_email, u.id as joined_user_id,
                                r.city, r.state, r.subject, r.message, r.phone, r.created_at
                         from requests r join users u on u.id = r.user_id order by r.created_at`;
  out.requests = reqs.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    owner_email: r.owner_email,
    user_link_is_exact: r.user_id === r.joined_user_id,
    city: r.city,
    state: r.state,
    subject: r.subject,
    message: r.message,
    phone: r.phone,
  }));
  out.request_count = reqs.length;
  const docs = await sql`select d.id, d.request_id, r.user_id, d.filename, d.mime_type, d.size,
                                length(d.content_base64) as b64_len, d.created_at
                         from documents d join requests r on r.id = d.request_id order by d.created_at`;
  out.documents = docs.map((d) => ({
    id: d.id,
    request_id: d.request_id,
    linked_to_same_user: d.user_id === reqs[0]?.user_id,
    filename: d.filename,
    mime_type: d.mime_type,
    size: d.size,
    size_is_number: typeof d.size === "number",
    b64_len: d.b64_len,
    b64_decodes_to_size:
      Buffer.from(String((d as Record<string, unknown>).content_base64 ?? ""), "base64").length,
  }));
  out.document_count = docs.length;
  const s = await sql`select token_hash, user_id, expires_at from sessions`;
  out.sessions = s.map((r) => ({
    user_id: r.user_id,
    token_hash_is_sha256_hex: /^[0-9a-f]{64}$/.test(String(r.token_hash)),
  }));
  out.counts = await counts();
  out.filenames_in_db = docs.map((d) => d.filename);
  console.log(JSON.stringify(out, null, 2));
} else if (mode === "cleanup") {
  const before = await counts();
  const du = await sql`delete from users where email like 'dai-test-%' returning id`;
  const da = await sql`delete from login_attempts where email_norm like 'dai-test-%' returning email_norm`;
  // Anything left over from earlier test runs must also go, so the tables end at 0.
  const du2 = await sql`delete from users returning id`;
  const da2 = await sql`delete from login_attempts returning email_norm`;
  console.log(
    JSON.stringify(
      { before, deleted_users: du.length + du2.length, deleted_login_attempts: da.length + da2.length, after: await counts() },
      null,
      2,
    ),
  );
} else {
  throw new Error("unknown mode " + mode);
}
