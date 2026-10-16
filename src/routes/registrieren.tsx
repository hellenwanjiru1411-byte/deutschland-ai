import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useT } from "~/components/app";
import { ErrorAlert, Field } from "~/components/form";
import { RouteErrorScreen } from "~/components/status";
import { getDictionary } from "~/i18n";
import { MIN_PASSWORD_LENGTH } from "~/lib/constants";
import { pageLocale } from "~/lib/page-locale";
import { signUp, type FieldErrors } from "~/server/fns";

export const Route = createFileRoute("/registrieren")({
  head: async () => {
    // The title in the visitor's language, in the server-rendered HTML: the
    // language comes from the request, not from match data. See
    // `src/lib/page-locale.ts`.
    const t = getDictionary(await pageLocale());
    return {
      meta: [
        { title: t.meta.signUpTitle },
        { name: "description", content: t.auth.signUpIntro },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  errorComponent: RouteErrorScreen,
  component: SignUpPage,
});

function SignUpPage() {
  const t = useT();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);

    // Client-side first, so the visitor gets an answer without a round trip.
    const local: FieldErrors = {};
    if (!values.name.trim()) local.name = t.errors.nameRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      local.email = t.errors.emailInvalid;
    if (values.password.length < MIN_PASSWORD_LENGTH)
      local.password = t.errors.passwordShort;
    if (values.password !== values.confirm)
      local.confirm = t.errors.passwordMismatch;
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    try {
      // The server validates the same rules again — client checks are a courtesy.
      const result = await signUp({ data: values });
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
        {t.auth.signUpTitle}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {t.auth.signUpIntro}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <ErrorAlert message={failure} />

        <Field id="name" label={t.auth.name} error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="field-input"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field id="email" label={t.auth.email} error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="field-input"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          id="password"
          label={t.auth.password}
          hint={t.auth.passwordHint}
          error={errors.password}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>

        <Field
          id="confirm"
          label={t.auth.passwordRepeat}
          error={errors.confirm}
        >
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={values.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
          />
        </Field>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? t.auth.sendingSignUp : t.auth.submitSignUp}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link to="/anmelden" className="prose-link">
          {t.nav.signIn}
        </Link>
      </p>
    </section>
  );
}
