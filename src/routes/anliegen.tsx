import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useT } from "~/components/app";
import { ErrorAlert, Field, SuccessAlert } from "~/components/form";
import { LoadingNotice, RouteErrorScreen } from "~/components/status";
import { getDictionary } from "~/i18n";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MIN_MESSAGE_LENGTH,
  STATES,
  SUBJECT_KEYS,
  isSubjectKey,
} from "~/lib/constants";
import { readAsBase64 } from "~/lib/file-input";
import { pageLocale } from "~/lib/page-locale";
import { fillNumbers } from "~/lib/text";
import type { AreaCode } from "~/lib/areas";
import {
  getBootstrap,
  getPilotStatus,
  submitIntake,
  type DocumentPayload,
  type FieldErrors,
} from "~/server/fns";

export const Route = createFileRoute("/anliegen")({
  // Signed-in users only. Anyone else is sent to the sign-in page.
  loader: async () => {
    const bootstrap = await getBootstrap();
    if (!bootstrap.user) throw redirect({ to: "/anmelden" });
    /*
     * The pilot safeguards: how many documents this person has already sent this
     * calendar month, and which wording of the reading-aid acknowledgement this
     * page is showing. Both come from the server — the browser never supplies
     * either number, and neither is stored anywhere but our own database.
     */
    const pilot = await getPilotStatus();
    return { bootstrap, pilot };
  },
  head: async ({ loaderData, matches }) => {
    // The title in the visitor's language, in the server-rendered HTML. The
    // loader's own result carries the language when it is available and the
    // request does otherwise — see `src/lib/page-locale.ts`.
    const t = getDictionary(
      await pageLocale(loaderData?.bootstrap.locale, matches),
    );
    return {
      meta: [
        { title: t.meta.intakeTitle },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  // A visible notice while the private page is being fetched, and a calm error
  // screen instead of a stack trace if the fetch fails.
  pendingComponent: LoadingNotice,
  errorComponent: RouteErrorScreen,
  // Belt and braces: the page is private, so it must never be indexed.
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  component: IntakePage,
});

function IntakePage() {
  const t = useT();
  const { bootstrap, pilot } = Route.useLoaderData();
  const { user, bookingUrl } = bootstrap;

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [subject, setSubject] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [readingAidAck, setReadingAidAck] = useState(false);
  const [documents, setDocuments] = useState<DocumentPayload[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [storedArea, setStoredArea] = useState<AreaCode | null>(null);
  const [storedDocs, setStoredDocs] = useState<
    { id: string; filename: string; originalName: string }[]
  >([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  /*
   * THE PILOT METER, as this page sees it. The numbers come from the server; the
   * page only displays them.
   *
   * `pilot.remaining` is what is left of the meter on AI work — NOT a limit on
   * storing documents, which is unlimited. So the meter can only refuse anything
   * while the AI route is connected (`pilot.aiMetering`), and today it is not: no
   * model is connected, every document is stored and nothing is refused. The page
   * therefore never blocks the file field and never refuses an upload.
   */
  const capReached = pilot.aiMetering && pilot.remaining <= 0;

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = ""; // let the visitor re-pick the same file after an error
    if (chosen.length === 0) return;

    if (chosen.length > MAX_FILES) {
      setErrors((p) => ({ ...p, documents: t.errors.filesTooMany }));
      return;
    }
    // The pilot meter on AI work, checked before the files are read — but only
    // when the AI route is connected. Storing paperwork is unlimited. The server
    // checks the same rule again.
    if (pilot.aiMetering && chosen.length > pilot.remaining) {
      setErrors((p) => ({ ...p, documents: t.errors.capReached }));
      return;
    }
    for (const file of chosen) {
      /*
       * A HINT, NOT THE GATE. `file.type` is a string the browser chooses, so this
       * check only spares the person a round trip: the decision is made on the
       * server, from the file's first bytes (`src/server/uploads.server.ts`), and a
       * renamed SVG that declares `image/png` passes this check and is still
       * refused there.
       */
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setErrors((p) => ({ ...p, documents: t.errors.fileType }));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrors((p) => ({ ...p, documents: t.errors.fileTooLarge }));
        return;
      }
    }
    const totalBytes = chosen.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setErrors((p) => ({ ...p, documents: t.errors.filesTooBigAll }));
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
      setErrors((p) => ({ ...p, documents: undefined as unknown as string }));
    } catch {
      setErrors((p) => ({ ...p, documents: t.errors.generic }));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);

    const local: FieldErrors = {};
    if (!city.trim()) local.city = t.errors.cityRequired;
    if (!STATES.includes(state)) local.state = t.errors.stateRequired;
    if (!isSubjectKey(subject)) local.subject = t.errors.subjectInvalid;
    if (message.trim().length < MIN_MESSAGE_LENGTH)
      local.message = t.errors.messageShort;
    if (!consent) local.consent = t.errors.consentRequired;
    /*
     * Both pilot gates, checked here so the person gets the answer immediately —
     * and checked again in the server function, which is the one that decides.
     * A disabled button alone would not be a gate: this form can be submitted
     * without JavaScript, and a button is not a rule.
     *
     * The meter applies to AI work only, so it is only checked when the AI route
     * is connected. Storing documents is never refused.
     */
    if (pilot.aiMetering && documents.length > pilot.remaining)
      local.documents = t.errors.capReached;
    if (documents.length > 0 && !readingAidAck)
      local.readingAid = t.errors.readingAidRequired;
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    try {
      const result = await submitIntake({
        data: {
          city,
          state,
          subject,
          phone,
          message,
          consent,
          readingAidAck,
          documents,
        },
      });
      if (result.ok) {
        setStoredArea(result.area);
        setStoredDocs(result.documents ?? []);
        setDone(true);
        return;
      }
      setErrors(result.fields);
      setFailure(result.error ?? null);
    } catch {
      setFailure(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <SuccessAlert message={t.intake.success} />
        {/*
          WHICH AREA OF LIFE the case was filed under. The area is derived from the
          subject the person already picked, so this line only tells them where
          their case landed — they never had to answer a second question. The code
          is stable and internal; the label comes from the language files.
        */}
        {storedArea ? (
          <p className="mt-4 text-sm leading-relaxed text-muted" data-area={storedArea}>
            {t.intake.filedUnder}{" "}
            <span className="font-semibold text-ink-soft">{t.areas[storedArea]}</span>
          </p>
        ) : null}
        {storedDocs.length > 0 ? (
          /*
            The person's own files, handed back to them. The link carries the
            document's internal id and nothing else; the route serves it as a
            download of the type we decided at upload time. The label is the name
            they gave the file, shown as text — never as a path or a URL.
          */
          <div className="mt-6">
            <p className="text-sm font-semibold text-ink-soft">
              {t.intake.filesChosen}
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {storedDocs.map((doc) => (
                <li key={doc.id}>
                  <a
                    className="prose-link"
                    href={`/dokument/${doc.id}`}
                    download={doc.filename}
                  >
                    {doc.originalName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {/* Straight to the overview, where the new case is now listed. */}
          <Link to="/dashboard" className="btn-primary">
            {t.nav.dashboard}
          </Link>
          <Link to="/" className="btn-secondary">
            {t.nav.home}
          </Link>
          <Link to="/anliegen" className="btn-ghost">
            {t.nav.intake}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.intake.title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{t.intake.intro}</p>
      {/*
        Only shown when an appointment link actually exists. Without one this line
        promised something the app cannot do — and once the app has its own
        calendar, the honest version of this sentence will come from there.
      */}
      {bookingUrl ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{t.booking.note}</p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
        <ErrorAlert message={failure} />

        <div className="card grid gap-5 p-5 sm:grid-cols-2">
          <Field id="account-name" label={t.intake.name}>
            <input
              id="account-name"
              className="field-input bg-paper"
              value={user?.name ?? ""}
              readOnly
            />
          </Field>
          <Field id="account-email" label={t.intake.email}>
            <input
              id="account-email"
              className="field-input bg-paper"
              value={user?.email ?? ""}
              readOnly
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="city" label={t.intake.city} error={errors.city}>
            <input
              id="city"
              className="field-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-invalid={Boolean(errors.city)}
            />
          </Field>

          <Field
            id="state"
            label={t.intake.state}
            hint={t.intake.stateHint}
            error={errors.state}
          >
            <select
              id="state"
              className="field-input"
              value={state}
              onChange={(e) => setState(e.target.value)}
              aria-invalid={Boolean(errors.state)}
            >
              <option value="">{t.intake.statePick}</option>
              {STATES.map((name) => (
                <option key={name} value={name}>
                  {t.intake.states[name] ?? name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="subject" label={t.intake.subject} error={errors.subject}>
            <select
              id="subject"
              className="field-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={Boolean(errors.subject)}
            >
              <option value="">{t.intake.statePick}</option>
              {SUBJECT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t.intake.subjects[key as keyof typeof t.intake.subjects]}
                </option>
              ))}
            </select>
          </Field>

          <Field id="phone" label={t.intake.phone}>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </div>

        <Field
          id="message"
          label={t.intake.message}
          hint={t.intake.messageHint}
          error={errors.message}
        >
          <textarea
            id="message"
            rows={6}
            className="field-input resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={Boolean(errors.message)}
          />
        </Field>

        {/*
          THE PILOT METER — shown before the file field.

          Owner's rule: storing and organising documents is unlimited, and the
          limit of `cap` per calendar month applies only to what the AI does with
          a letter — it protects the owner's bill, never a wall around the person.
          So the number is never shown as a limit on uploads: while no provider is
          connected the card says plainly that nothing is refused today
          (`t.pilot.notConnected`), and the file field is never disabled. Only when
          the AI route is connected AND the month's AI work is used up does the
          card say so in its own words — and even then the human route stays open
          with a way to take it: our contact address and the overview where both
          routes are described. A request without documents is always accepted,
          whatever the count says.
        */}
        <div
          className={`card p-5 ${capReached ? "bg-brand-soft/60" : "bg-paper"}`}
          data-pilot-cap={pilot.cap}
          data-pilot-used={pilot.usedThisMonth}
          data-pilot-ai-metering={pilot.aiMetering ? "on" : "off"}
        >
          <p className="text-sm font-semibold text-ink-soft">
            {capReached ? t.pilot.reachedTitle : t.pilot.capTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {fillNumbers(capReached ? t.pilot.reachedBody : t.pilot.capBody, {
              cap: pilot.cap,
              used: pilot.usedThisMonth,
            })}
          </p>
          <p className="mt-3 text-sm font-semibold text-brand-dark">
            {pilot.aiMetering
              ? fillNumbers(t.pilot.usage, {
                  used: pilot.usedThisMonth,
                  cap: pilot.cap,
                })
              : t.pilot.notConnected}
          </p>
          {capReached ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {pilot.contactEmail ? (
                <a className="btn-primary" href={`mailto:${pilot.contactEmail}`}>
                  {t.pilot.contactCta}
                </a>
              ) : null}
              <Link to="/dashboard" className="btn-secondary">
                {t.nav.dashboard}
              </Link>
            </div>
          ) : null}
        </div>

        <Field
          id="files"
          label={t.intake.files}
          hint={t.intake.filesHint}
          error={errors.documents || undefined}
        >
          <input
            id="files"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => void onFiles(e)}
            disabled={capReached}
            className="block w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>

        {documents.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-muted">
            <li className="font-semibold text-ink-soft">{t.intake.filesChosen}</li>
            {documents.map((doc) => (
              <li key={doc.filename}>
                {doc.filename} · {(doc.size / 1024).toFixed(0)} KB
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          READING-AID ACKNOWLEDGEMENT — the wording lives in the language file
          (`intake.readingAid`), never here, because a native speaker has to check
          it in every language. Ticking it is what allows a document to be sent:
          the server function refuses a submission carrying documents without it,
          and records which version was confirmed and when. `data-reading-aid-version`
          is the version the browser is showing — the server writes its own copy of
          this value, so a manipulated page cannot claim another one.
        */}
        <div className="card bg-brand-soft/50 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-forest"
              checked={readingAidAck}
              onChange={(e) => setReadingAidAck(e.target.checked)}
              aria-invalid={Boolean(errors.readingAid)}
              data-reading-aid-version={pilot.readingAidVersion}
            />
            <span className="text-sm leading-relaxed text-ink-soft">
              <span className="mb-1 block font-semibold">
                {t.intake.readingAidLabel}
              </span>
              {t.intake.readingAid}
            </span>
          </label>
          <p className="field-hint mt-2">{t.intake.readingAidHint}</p>
          {errors.readingAid ? (
            <p className="field-error mt-2" role="alert">
              {errors.readingAid}
            </p>
          ) : null}
        </div>

        {/*
          CONSENT — comes from the language file. Before any new language goes
          live this wording must be checked by a native speaker: it is the basis
          on which we are allowed to process the visitor's documents. Never
          machine-translate it.
        */}
        <div className="card bg-brand-soft/50 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-forest"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={Boolean(errors.consent)}
            />
            <span className="text-sm leading-relaxed text-ink-soft">
              {t.intake.consent}
            </span>
          </label>
          {errors.consent ? (
            <p className="field-error mt-2" role="alert">
              {errors.consent}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? t.intake.sending : t.intake.submit}
        </button>
      </form>
    </section>
  );
}
