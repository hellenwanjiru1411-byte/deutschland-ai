// Temporary verification script (deleted at the end of the test run).
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const mode = process.argv[2] ?? "inspect";
const out: Record<string, unknown> = {};

const tables = await sql`select table_name from information_schema.tables
                         where table_schema = 'public' order by table_name`;
out.schema_tables = tables.map((r) => r.table_name);

const users = await sql`select id, name, email, created_at from users order by created_at`;
out.users = users.map((r) => ({ id: r.id, name: r.name, email: r.email }));

const sessions = await sql`select token_hash, user_id, expires_at from sessions`;
out.sessions = sessions.map((r) => ({
  token_hash_len: String(r.token_hash).length,
  token_hash_is_sha256_hex: /^[0-9a-f]{64}$/.test(String(r.token_hash)),
  user_id: r.user_id,
}));

const reqs = await sql`select r.id, r.user_id, u.email, r.city, r.state, r.subject,
                               r.message, r.phone, r.created_at
                        from requests r join users u on u.id = r.user_id
                        order by r.created_at`;
out.requests = reqs.map((r) => ({
  id: r.id,
  user_id: r.user_id,
  owner_email: r.email,
  linked_to_user: Boolean(r.user_id),
  city: r.city,
  state: r.state,
  subject: r.subject,
  message_len: String(r.message).length,
  phone: r.phone,
}));
out.request_count = reqs.length;

const docs = await sql`select d.id, d.request_id, r.user_id, d.filename, d.mime_type,
                              d.size, length(d.content_base64) as b64_len,
                              left(d.content_base64, 8) as b64_head
                       from documents d join requests r on r.id = d.request_id
                       order by d.created_at`;
out.documents = docs.map((r) => ({
  id: r.id,
  request_id: r.request_id,
  request_user_id: r.user_id,
  filename: r.filename,
  mime_type: r.mime_type,
  size: r.size,
  b64_len: r.b64_len,
  b64_head: r.b64_head,
}));
out.document_count = docs.length;

const stray = await sql`select filename, size from documents
                        where filename like 'test-over%' or filename like 'test-notallowed%'`;
out.refused_files_present_in_db = stray;

out.login_attempts = await sql`select email_norm, failed_count, locked_until from login_attempts`;

if (mode === "cleanup") {
  const del = await sql`delete from users where email_norm like 'dai-test-%@example.com' returning id`;
  const del2 = await sql`delete from login_attempts where email_norm like 'dai-test-%@example.com' returning email_norm`;
  out.deleted_users = del.length;
  out.deleted_login_attempts = del2.length;
  out.after = {
    users: (await sql`select count(*)::int as c from users`)[0].c,
    sessions: (await sql`select count(*)::int as c from sessions`)[0].c,
    requests: (await sql`select count(*)::int as c from requests`)[0].c,
    documents: (await sql`select count(*)::int as c from documents`)[0].c,
    login_attempts: (await sql`select count(*)::int as c from login_attempts`)[0].c,
  };
  out.after_orphans = await sql`select
      (select count(*)::int from sessions s left join users u on u.id = s.user_id where u.id is null) as orphan_sessions,
      (select count(*)::int from requests r left join users u on u.id = r.user_id where u.id is null) as orphan_requests,
      (select count(*)::int from documents d left join requests r on r.id = d.request_id where r.id is null) as orphan_docs`;
}

console.log(JSON.stringify(out, null, 1));
