import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useT } from "~/components/app";
import { ErrorAlert, Field } from "~/components/form";
import { RouteErrorScreen } from "~/components/status";
import { getDictionary } from "~/i18n";
import { pageLocale } from "~/lib/page-locale";
import { signIn, type FieldErrors } from "~/server/fns";

export const Route = createFileRoute("/anmelden")({
  head: async () => {
    // The title in the visitor's language, in the server-rendered HTML: the
    // language comes from the request, not from match data. See
    // `src/lib/page-locale.ts`.
    const t = getDictionary(await pageLocale());
    return {
      meta: [
        { title: t.meta.signInTitle },
        { name: "description", content: t.auth.signInIntro },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  errorComponent: RouteErrorScreen,
  component: SignInPage,
});

function SignInPage() {
  const t = useT();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);

    const local: FieldErrors = {};
    if (!values.email.trim()) local.email = t.errors.required;
    if (!values.password) local.password = t.errors.required;
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    try {
      const result = await signIn({ data: values });
      if (result.ok) {
        window.location.href = "/anliegen";
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

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.auth.signInTitle}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {t.auth.signInIntro}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <ErrorAlert message={failure} />

        <Field id="email" label={t.auth.email} error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="field-input"
            value={values.email}
            onChange={(e) => setValues((p) => ({ ...p, email: e.target.value }))}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field id="password" label={t.auth.password} error={errors.password}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="field-input"
            value={values.password}
            onChange={(e) =>
              setValues((p) => ({ ...p, password: e.target.value }))
            }
            aria-invalid={Boolean(errors.password)}
          />
        </Field>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? t.auth.sendingSignIn : t.auth.submitSignIn}
        </button>
      </form>

      {/*
        There is no email integration yet, so we cannot send a password reset
        link. Being plain about it is better than a link that never arrives.
      */}
      <p className="mt-6 text-sm leading-relaxed text-muted">{t.auth.forgot}</p>

      <p className="mt-4 text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link to="/registrieren" className="prose-link">
          {t.nav.signUp}
        </Link>
      </p>
    </section>
  );
}
