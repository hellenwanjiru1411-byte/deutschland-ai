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
  MIN_MESSAGE_LENGTH,
  STATES,
  SUBJECT_KEYS,
} from "~/lib/constants";
import { pageLocale } from "~/lib/page-locale";
import {
  getBootstrap,
  submitIntake,
  type DocumentPayload,
  type FieldErrors,
} from "~/server/fns";

export const Route = createFileRoute("/anliegen")({
  // Signed-in users only. Anyone else is sent to the sign-in page.
  loader: async () => {
    const bootstrap = await getBootstrap();
    if (!bootstrap.user) throw redirect({ to: "/anmelden" });
    return bootstrap;
  },
  head: async ({ loaderData }) => {
    // The title in the visitor's language, in the server-rendered HTML. The
    // loader's own result carries the language when it is available and the
    // request does otherwise — see `src/lib/page-locale.ts`.
    const t = getDictionary(await pageLocale(loaderData?.locale));
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

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function IntakePage() {
  const t = useT();
  const { user } = Route.useLoaderData();

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [subject, setSubject] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [documents, setDocuments] = useState<DocumentPayload[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = ""; // let the visitor re-pick the same file after an error
    if (chosen.length === 0) return;

    if (chosen.length > MAX_FILES) {
      setErrors((p) => ({ ...p, documents: t.errors.filesTooMany }));
      return;
    }
    for (const file of chosen) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setErrors((p) => ({ ...p, documents: t.errors.fileType }));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrors((p) => ({ ...p, documents: t.errors.fileTooLarge }));
        return;
      }
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
    if (!SUBJECT_KEYS.includes(subject)) local.subject = t.errors.subjectInvalid;
    if (message.trim().length < MIN_MESSAGE_LENGTH)
      local.message = t.errors.messageShort;
    if (!consent) local.consent = t.errors.consentRequired;
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
          documents,
        },
      });
      if (result.ok) {
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
        <div className="mt-8 flex flex-wrap gap-3">
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
      <p className="mt-3 text-sm leading-relaxed text-muted">{t.booking.note}</p>

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
            className="block w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark"
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
          CONSENT — comes from the language file. Before any new language goes
          live this wording must be checked by a native speaker: it is the basis
          on which we are allowed to process the visitor's documents. Never
          machine-translate it.
        */}
        <div className="card bg-brand-soft/50 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[#1e654d]"
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
