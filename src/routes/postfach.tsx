/**
 * `/postfach` — THE OWNER'S PRIVATE INBOX.
 *
 * WHY THIS PAGE EXISTS: during the pilot requests arrive in our own database and
 * the owner handles every case personally (business plan, owner's direction Oct
 * 2026). Without this page nobody reads them, and a request that lands in a
 * database nobody reads was never really received.
 *
 * WHAT IT IS, AND WHAT IT IS NOT:
 *   - It IS the owner's own casework view: every request across all people, who
 *     sent it, when, which area of life, what they wrote, their documents with a
 *     download link each, a way to mark a case as being handled or completed, and
 *     a way to ask for a missing document.
 *   - It is NOT an officer console. There is no authority account, no authority's
 *     name or logo anywhere on it, no check against official records, and no
 *     organisation tenancy. The person's details are the ones they typed into our
 *     own form; the case is what they wrote to us.
 *
 * WHO MAY SEE IT — and this is the part that must hold in the SERVER RESPONSE, not
 * only in what the page draws:
 *   - signed out  → 307 to `/anmelden` (thrown in the loader, before anything renders);
 *   - signed in, not the owner → `notFound()`, which TanStack Start answers with a
 *     real HTTP 404 (the router sets the status when a match is `notFound`);
 *   - the owner → the page.
 * The check itself is `getOwnerInbox`, which compares the STORED role on the
 * account row with `owner` — the browser never sends a role, and `isOwner` in the
 * header only decides whether a link is shown.
 *
 * RIGHT-TO-LEFT: logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `text-start`),
 * so the page mirrors itself for Arabic like the rest of the site.
 */
import { Link, createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useT } from "~/components/app";
import { ErrorAlert, Field, SuccessAlert } from "~/components/form";
import { LoadingNotice, RouteErrorScreen } from "~/components/status";
import { getDictionary, languageOf } from "~/i18n";
import { CASE_STATUSES, type CaseStatus } from "~/lib/cases";
import { isSubjectKey } from "~/lib/constants";
import { pageLocale } from "~/lib/page-locale";
import {
  getOwnerInbox,
  ownerRequestDocument,
  ownerSetCaseStatus,
  type InboxCase,
} from "~/server/fns";

export const Route = createFileRoute("/postfach")({
  loader: async () => {
    const data = await getOwnerInbox();
    if (data.state === "signed_out") throw redirect({ to: "/anmelden" });
    /*
     * NOT FOUND, not "forbidden": a person who is signed in must not learn that
     * this page exists, or that there is an inbox at all. `notFound()` is thrown
     * before the component renders and the server answers 404.
     */
    if (data.state === "forbidden") throw notFound();
    return data;
  },
  head: async ({ loaderData, matches }) => {
    const t = getDictionary(
      await pageLocale(
        loaderData?.state === "ok" ? loaderData.locale : undefined,
        matches,
      ),
    );
    return {
      meta: [
        { title: t.meta.inboxTitle },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  pendingComponent: LoadingNotice,
  errorComponent: RouteErrorScreen,
  // Belt and braces: even if it were reachable, it must never be indexed.
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  component: InboxPage,
});

function InboxPage() {
  const t = useT();
  const router = useRouter();
  const data = Route.useLoaderData();
  const cases = data.state === "ok" ? data.cases : [];
  const lang = languageOf(data.state === "ok" ? data.locale : "de").lang;

  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.inbox.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        {t.inbox.lead}
      </p>

      {/*
        HONESTY, BEFORE THE CASES. This is our own inbox, and the page says so in
        one paragraph: no authority account, no check against official records, no
        insurer or hospital in the loop. It is not a disclaimer bolted on — it is
        the description of what the page is.
      */}
      <div className="mt-6 rounded-2xl border border-brand/25 bg-brand-soft p-5">
        <h2 className="text-base font-semibold text-brand-dark">
          {t.inbox.honestyTitle}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
          {t.inbox.honesty}
        </p>
      </div>

      <ErrorAlert message={failure} />
      {done ? <SuccessAlert message={done} /> : null}

      {cases.length === 0 ? (
        <div className="card mt-8 p-6">
          <p className="text-base font-semibold">{t.inbox.emptyTitle}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {t.inbox.emptyLead}
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {cases.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              lang={lang}
              onError={setFailure}
              onDone={async (message) => {
                setFailure(null);
                setDone(message);
                await router.invalidate();
              }}
            />
          ))}
        </ul>
      )}

      <div className="mt-10">
        <Link to="/dashboard" className="btn-secondary">
          {t.nav.dashboard}
        </Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- one case */

function InboxCard({
  item,
  lang,
  onError,
  onDone,
}: {
  item: InboxCase;
  lang: string;
  onError: (message: string | null) => void;
  onDone: (message: string) => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState<CaseStatus | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const subject = isSubjectKey(item.subject)
    ? t.intake.subjects[item.subject]
    : item.subject;

  async function setStatus(status: CaseStatus) {
    setSaving(status);
    onError(null);
    try {
      const result = await ownerSetCaseStatus({
        data: { requestId: item.id, status },
      });
      if (!result.ok) {
        onError(result.error ?? t.errors.generic);
        return;
      }
      await onDone("");
    } catch {
      onError(t.errors.generic);
    } finally {
      setSaving(null);
    }
  }

  async function askForDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoticeError(null);
    onError(null);
    setSending(true);
    try {
      const result = await ownerRequestDocument({
        data: { requestId: item.id, message },
      });
      if (!result.ok) {
        setNoticeError(result.fields?.message ?? result.error ?? t.errors.generic);
        return;
      }
      setMessage("");
      await onDone(t.inbox.noticeSent);
    } catch {
      setNoticeError(t.errors.generic);
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="card p-5" data-case={item.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">{subject}</h2>
        <p className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">
          {t.caseStatus[item.status]}
        </p>
      </div>

      {/* WHO, WHEN, WHERE — the person's own details and the case's own facts. */}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.personLabel}:</dt>
          <dd>{item.person.name}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.emailLabel}:</dt>
          <dd className="break-all">{item.person.email}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.receivedLabel}:</dt>
          <dd>{formatDate(item.createdAt, lang)}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.areaLabel}:</dt>
          <dd>{t.areas[item.area]}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.cityLabel}:</dt>
          <dd>{item.city}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.inbox.stateLabel}:</dt>
          <dd>{item.state}</dd>
        </div>
        {item.phone ? (
          <div className="flex gap-x-1.5">
            <dt className="font-semibold text-ink-soft">{t.inbox.phoneLabel}:</dt>
            <dd>{item.phone}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink-soft">{t.inbox.messageLabel}</p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
          {item.message}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink-soft">
          {t.inbox.documentsLabel}
        </p>
        {item.documents.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t.inbox.noDocuments}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {item.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-baseline gap-x-3">
                {/*
                  The same download route the person uses. It asks the session who
                  is asking: the owner gets any document, everybody else only their
                  own (`src/routes/dokument.$id.ts`).
                */}
                <a
                  className="prose-link"
                  href={`/dokument/${document.id}`}
                  download={document.originalName}
                >
                  {document.originalName}
                </a>
                <span className="text-muted">
                  {(document.size / 1024).toFixed(0)} KB ·{" "}
                  {formatDate(document.createdAt, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* THE STATUS — the owner's own bookkeeping, and only the owner can set it. */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {CASE_STATUSES.filter((status) => status !== item.status).map((status) => (
          <button
            key={status}
            type="button"
            className="btn-secondary text-sm"
            onClick={() => void setStatus(status)}
            disabled={saving !== null}
            aria-busy={saving === status}
            data-set-status={status}
          >
            {saving === status
              ? t.inbox.statusSaving
              : status === "in_progress"
                ? t.inbox.markInProgress
                : status === "completed"
                  ? t.inbox.markCompleted
                  : t.inbox.markReceived}
          </button>
        ))}
      </div>

      {/* WHAT WE HAVE ALREADY ASKED FOR — including the notices the person closed. */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink-soft">{t.inbox.noticesTitle}</p>
        {item.notices.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t.inbox.noNotices}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {item.notices.map((notice) => (
              <li key={notice.id} className="rounded-lg bg-paper px-3 py-2">
                <p className="whitespace-pre-line text-ink-soft">{notice.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatDate(notice.createdAt, lang)} ·{" "}
                  {notice.fulfilledAt
                    ? t.inbox.noticeStateFulfilled
                    : notice.dismissedAt
                      ? t.inbox.noticeStateDismissed
                      : t.inbox.noticeStateOpen}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        ASK FOR A MISSING DOCUMENT. The words say plainly where the person sees it
        and that no e-mail is sent; the person's side says it comes from us
        (`myRequests.noticeFrom`), never from an authority.
      */}
      <form onSubmit={askForDocument} noValidate className="mt-4 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink-soft">{t.inbox.noticeTitle}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t.inbox.noticeIntro}</p>
        <div className="mt-3">
          <Field
            id={`notice-message-${item.id}`}
            label={t.inbox.noticeField}
            hint={t.inbox.noticeHint}
            error={noticeError ?? undefined}
          >
            <textarea
              id={`notice-message-${item.id}`}
              rows={3}
              className="field-input resize-y"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-invalid={Boolean(noticeError)}
            />
          </Field>
        </div>
        <button
          type="submit"
          className="btn-primary mt-3 text-sm"
          disabled={sending}
          aria-busy={sending}
          data-request-document={item.id}
        >
          {sending ? t.inbox.noticeSending : t.inbox.noticeSubmit}
        </button>
      </form>
    </li>
  );
}

/**
 * A date the way the visitor's language writes it, in Berlin time so the
 * server-rendered HTML and the hydrated page agree.
 */
function formatDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(date);
  } catch {
    return "—";
  }
}
