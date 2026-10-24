/**
 * `/meine-anliegen` — THE PERSON'S OWN REQUEST LIST.
 *
 * What it is for: until this page existed, a person described a request and then
 * had no way of seeing it again. The pilot cannot run on that — a request that
 * arrives in a database nobody reads is a request that was never sent.
 *
 * WHAT IT SHOWS, and nothing more:
 *   - every case the signed-in person has submitted, newest first, each with its
 *     area of life, its date, its status in plain words and its documents;
 *   - each document as a download (the route serves it as an attachment of the type
 *     we decided at upload time — see `src/routes/dokument.$id.ts`);
 *   - a way to delete a case for good, with a confirmation that names what goes;
 *   - the notices we sent asking for a missing document, each with a way to attach
 *     the document and a way to put the notice away.
 *
 * WHERE THE DATA COMES FROM: `getMyRequests`, which reads through
 * `src/server/access.server.ts` only. This page assembles no query of its own, so
 * it cannot show a row of another person — the person's id is in the SQL of every
 * read behind it.
 *
 * RIGHT-TO-LEFT: every class here is logical (`ms-`, `me-`, `ps-`, `text-start`),
 * so the page mirrors itself for Arabic like the rest of the site. The smoke test
 * checks that no physical left/right utility creeps in.
 */
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useT } from "~/components/app";
import { ErrorAlert, Field, SuccessAlert } from "~/components/form";
import { LoadingNotice, RouteErrorScreen } from "~/components/status";
import { getDictionary, languageOf } from "~/i18n";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  isSubjectKey,
} from "~/lib/constants";
import { readAsBase64 } from "~/lib/file-input";
import { pageLocale } from "~/lib/page-locale";
import {
  attachDocumentToMyRequest,
  deleteMyRequest,
  dismissMyNotice,
  getMyRequests,
  type DocumentPayload,
  type MyCase,
  type MyNotice,
} from "~/server/fns";

export const Route = createFileRoute("/meine-anliegen")({
  // Signed-in people only — a signed-out visitor is sent to the sign-in page, in
  // the server response, with JavaScript off.
  loader: async () => {
    const data = await getMyRequests();
    if (!data.user) throw redirect({ to: "/anmelden" });
    return data;
  },
  head: async ({ loaderData, matches }) => {
    const t = getDictionary(await pageLocale(loaderData?.locale, matches));
    return {
      meta: [
        { title: t.meta.myRequestsTitle },
        { name: "description", content: t.myRequests.lead },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  pendingComponent: LoadingNotice,
  errorComponent: RouteErrorScreen,
  // The page is private, so it must never be indexed.
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  component: MyRequestsPage,
});

function MyRequestsPage() {
  const t = useT();
  const router = useRouter();
  const { locale, cases } = Route.useLoaderData();
  // The BCP-47 tag of the visitor's language, so dates are written the way their
  // language writes them. It comes from the language registry.
  const lang = languageOf(locale).lang;

  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Every open notice, with the case it belongs to — the newest notice first,
  // because it is the one the person has not seen yet.
  const openNotices = cases
    .flatMap((item) => item.notices.map((notice) => ({ notice, item })))
    .sort((a, b) => (a.notice.createdAt < b.notice.createdAt ? 1 : -1));

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.myRequests.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        {t.myRequests.lead}
      </p>

      <ErrorAlert message={failure} />
      {done ? <SuccessAlert message={done} /> : null}

      {/*
        THE NOTICES COME FIRST. They are the only thing on this page that asks the
        person to do something, so they sit above the list rather than inside it.
        Each one says it is from us, names the case it belongs to, offers the file
        field and a way to close it — one line, once, never a nag.
      */}
      {openNotices.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {openNotices.map(({ notice, item }) => (
            <NoticeBlock
              key={notice.id}
              notice={notice}
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
        </div>
      ) : null}

      {cases.length === 0 ? (
        <div className="card mt-8 p-6">
          <p className="text-base font-semibold">{t.myRequests.emptyTitle}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {t.myRequests.emptyLead}
          </p>
          <Link to="/anliegen" className="btn-primary mt-5">
            {t.myRequests.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {cases.map((item) => (
            <CaseCard
              key={item.id}
              item={item}
              lang={lang}
              onError={setFailure}
              onDeleted={async () => {
                setFailure(null);
                setDone(t.myRequests.deleted);
                await router.invalidate();
              }}
            />
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/dashboard" className="btn-secondary">
          {t.myRequests.backToDashboard}
        </Link>
        <Link to="/anliegen" className="btn-ghost">
          {t.nav.intake}
        </Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- one case */

function CaseCard({
  item,
  lang,
  onError,
  onDeleted,
}: {
  item: MyCase;
  lang: string;
  onError: (message: string | null) => void;
  onDeleted: () => Promise<void>;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const subject = isSubjectKey(item.subject)
    ? t.intake.subjects[item.subject]
    : item.subject;

  async function remove() {
    setBusy(true);
    onError(null);
    try {
      const result = await deleteMyRequest({ data: { requestId: item.id } });
      if (!result.ok) {
        onError(result.error ?? t.errors.generic);
        return;
      }
      await onDeleted();
    } catch {
      onError(t.errors.generic);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">{subject}</h2>
        <p className="text-sm font-semibold text-brand-dark">
          {/* The status, in plain words from the language file. */}
          {t.caseStatus[item.status]}
        </p>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.myRequests.areaLabel}:</dt>
          <dd>{t.areas[item.area]}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">
            {t.myRequests.receivedLabel}:
          </dt>
          <dd>{formatDate(item.createdAt, lang)}</dd>
        </div>
        <div className="flex gap-x-1.5">
          <dt className="font-semibold text-ink-soft">{t.caseStatus.label}:</dt>
          <dd>{t.caseStatus[item.status]}</dd>
        </div>
      </dl>

      {item.message ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink-soft">
            {t.myRequests.messageLabel}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
            {item.message}
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink-soft">
          {t.myRequests.documentsTitle}
        </p>
        {item.documents.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t.myRequests.noDocuments}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {item.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-baseline gap-x-3">
                {/*
                  The download link carries the document's internal id and nothing
                  else. The route serves it as an attachment with the type we
                  decided at upload time; the label is the person's own filename,
                  shown as text and never as a path or a URL.
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

      {/*
        DELETING: the button only opens the confirmation. The confirmation names
        what is about to go — the subject, the date, the area of life and how many
        documents — because deleting without saying what is a decision made in the
        dark. Nothing is hidden or marked deleted: the rows are gone afterwards.
      */}
      <div className="mt-5 border-t border-line pt-4">
        {confirming ? (
          <div className="rounded-xl border border-brand/30 bg-brand-soft/60 p-4">
            <p className="text-sm font-semibold text-brand-dark">
              {t.myRequests.deleteConfirmTitle}
            </p>
            <dl className="mt-2 flex flex-col gap-1 text-sm text-ink-soft">
              <div className="flex gap-x-1.5">
                <dt className="font-semibold">{t.myRequests.deleteSubject}:</dt>
                <dd>{subject}</dd>
              </div>
              <div className="flex gap-x-1.5">
                <dt className="font-semibold">{t.myRequests.deleteDate}:</dt>
                <dd>{formatDate(item.createdAt, lang)}</dd>
              </div>
              <div className="flex gap-x-1.5">
                <dt className="font-semibold">{t.myRequests.deleteArea}:</dt>
                <dd>{t.areas[item.area]}</dd>
              </div>
              <div className="flex gap-x-1.5">
                <dt className="font-semibold">{t.myRequests.deleteDocuments}:</dt>
                <dd>{item.documents.length}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t.myRequests.deleteConfirmNote}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void remove()}
                disabled={busy}
                aria-busy={busy}
                data-delete-confirm={item.id}
              >
                {busy ? t.myRequests.deleting : t.myRequests.deleteConfirmYes}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {t.myRequests.deleteCancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-ghost px-0 text-sm"
            onClick={() => setConfirming(true)}
            data-delete-request={item.id}
          >
            {t.myRequests.deleteCta}
          </button>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------- one notice */

/**
 * ONE NOTICE FROM US, and everything the person can do about it.
 *
 * It says who is asking (`noticeFrom` — AIE Deutschland, never an authority),
 * which case it is about, and offers exactly two things: attach the document, or
 * put the notice away. Attaching is a real upload with the same gate as the intake
 * form, and it needs the same reading-aid acknowledgement — the wording comes from
 * the language files, never from this file.
 */
function NoticeBlock({
  notice,
  item,
  lang,
  onError,
  onDone,
}: {
  notice: MyNotice;
  item: MyCase;
  lang: string;
  onError: (message: string | null) => void;
  onDone: (message: string) => Promise<void>;
}) {
  const t = useT();
  const { readingAidVersion } = Route.useLoaderData();
  const [documents, setDocuments] = useState<DocumentPayload[]>([]);
  const [readingAidAck, setReadingAidAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const subject = isSubjectKey(item.subject)
    ? t.intake.subjects[item.subject]
    : item.subject;

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = ""; // let the person re-pick the same file after an error
    setFileError(null);
    if (chosen.length === 0) return;
    if (chosen.length > MAX_FILES) {
      setFileError(t.errors.filesTooMany);
      return;
    }
    for (const file of chosen) {
      // A hint, not the gate: the server decides what the file is from its bytes.
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError(t.errors.fileType);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError(t.errors.fileTooLarge);
        return;
      }
    }
    const totalBytes = chosen.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setFileError(t.errors.filesTooBigAll);
      return;
    }
    try {
      const payload: DocumentPayload[] = [];
      for (const file of chosen) {
        payload.push({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          contentBase64: await readAsBase64(file),
        });
      }
      setDocuments(payload);
    } catch {
      setFileError(t.errors.generic);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    if (documents.length === 0) {
      setFileError(t.errors.fileRequired);
      return;
    }
    setBusy(true);
    try {
      const result = await attachDocumentToMyRequest({
        data: { requestId: item.id, readingAidAck, documents },
      });
      if (!result.ok) {
        onError(
          result.fields?.readingAid ??
            result.fields?.documents ??
            result.error ??
            t.errors.generic,
        );
        return;
      }
      setDocuments([]);
      setReadingAidAck(false);
      await onDone(t.myRequests.noticeAttached);
    } catch {
      onError(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setDismissing(true);
    onError(null);
    try {
      const result = await dismissMyNotice({ data: { noticeId: notice.id } });
      if (!result.ok) {
        onError(result.error ?? t.errors.generic);
        return;
      }
      await onDone(t.myRequests.noticeDismissed);
    } catch {
      onError(t.errors.generic);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="card border-brand/30 bg-brand-soft/50 p-5" data-notice={notice.id}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
        {t.myRequests.noticeFrom}
      </p>
      <h2 className="mt-2 text-base font-semibold">{t.myRequests.noticeTitle}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
        {notice.message}
      </p>
      <p className="mt-2 text-sm text-muted">
        {t.myRequests.noticeCaseLabel}: {subject} · {formatDate(item.createdAt, lang)}
      </p>

      <form onSubmit={send} noValidate className="mt-4 flex flex-col gap-3">
        <Field
          id={`notice-file-${notice.id}`}
          label={t.myRequests.noticeFileLabel}
          hint={t.intake.filesHint}
          error={fileError ?? undefined}
        >
          <input
            id={`notice-file-${notice.id}`}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => void onFiles(e)}
            className="block w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark"
          />
        </Field>

        {documents.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-muted">
            <li className="font-semibold text-ink-soft">{t.intake.filesChosen}</li>
            {documents.map((document) => (
              <li key={document.filename}>
                {document.filename} · {(document.size / 1024).toFixed(0)} KB
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          The same acknowledgement the intake form asks for: an upload always
          carries it, and the server refuses a document without it. The wording
          lives in the language files, never here.
        */}
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-forest"
            checked={readingAidAck}
            onChange={(e) => setReadingAidAck(e.target.checked)}
            data-reading-aid-version={readingAidVersion}
          />
          <span>
            <span className="mb-1 block font-semibold">
              {t.intake.readingAidLabel}
            </span>
            {t.intake.readingAid}
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? t.myRequests.noticeAttaching : t.myRequests.noticeAttachSubmit}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void dismiss()}
            disabled={dismissing}
            data-dismiss-notice={notice.id}
          >
            {t.myRequests.noticeDismiss}
          </button>
        </div>
        <p className="text-xs text-muted">{t.myRequests.noticeDismissHint}</p>
      </form>
    </div>
  );
}

/**
 * A date the way the visitor's language writes it, in Berlin time so the
 * server-rendered HTML and the hydrated page agree. An unreadable value shows a
 * dash instead of "Invalid Date".
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
