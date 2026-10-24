/**
 * Server functions — the only way the browser talks to the database.
 *
 * Everything that touches node:crypto, the database or cookies lives in
 * `./data.server` and is pulled in with a dynamic `import()` inside the handler,
 * so none of it can end up in the browser bundle.
 *
 * Every message that reaches a visitor is translated: the language comes from the
 * visitor's cookie inside the handler, never from a value the browser sends.
 */
import { createServerFn } from "@tanstack/react-start";

import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  MAX_FILES,
  MIN_MESSAGE_LENGTH,
  MIN_PASSWORD_LENGTH,
  READING_AID_VERSION,
  STATES,
  isSubjectKey,
} from "~/lib/constants";
import { getDictionary, type Locale } from "~/i18n";
import type { AreaCode } from "~/lib/areas";

export type Bootstrap = {
  locale: Locale;
  user: { name: string; email: string } | null;
  bookingUrl: string | null;
  contactEmail: string | null;
};

export type FieldErrors = Record<string, string>;

export type FormResult =
  | { ok: true }
  | { ok: false; error?: string; fields: FieldErrors };

/**
 * A stored case answers with the area of life it was filed under — the stable
 * code, not a translated label. The page looks the label up in its own language.
 */
export type IntakeResult =
  | { ok: true; area: AreaCode }
  | { ok: false; error?: string; fields: FieldErrors };

export type DocumentPayload = {
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
};

export const getBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Bootstrap> => {
    const data = await import("./data.server");
    return data.bootstrap();
  },
);

/**
 * The visitor's language, on its own. The page title in the server-rendered
 * HTML has to be right before anything is rendered, and that decision cannot
 * wait for the rest of the page — so `head()` asks for the language through
 * this one small call. It reads the language cookie only: no database, no
 * personal data, and it never throws.
 */
export const getPageLocale = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale }> => {
    const server = await import("./data.server");
    return { locale: server.currentLocale() };
  },
);

/* ------------------------------------------------------------------ dashboard */

/** One case as the dashboard lists it: enough to recognise it, nothing more. */
export type DashboardCase = {
  id: string;
  subject: string;
  /** The area of life it belongs to. Always the area whose section it is in. */
  area: AreaCode;
  createdAt: string;
  documentCount: number;
};

/** One area of life with the viewer's cases in it. Never mixed with another area. */
export type DashboardArea = {
  area: AreaCode;
  cases: DashboardCase[];
};

export type DashboardData = {
  locale: Locale;
  user: { name: string; email: string } | null;
  /** One entry per area of life that actually has cases, in product order. */
  areas: DashboardArea[];
  /** How many cases in total — the honest "do I have anything here" number. */
  caseCount: number;
};

/**
 * Everything the dashboard shows, in the visitor's language.
 *
 * The cases come from `src/server/access.server.ts` and from nowhere else: that
 * module requires an area of life for every read and hands the cases back
 * already separated, so this page cannot end up showing a mixed list. No route
 * or component queries `requests` or `documents` itself — the smoke test fails
 * the build if one starts to.
 *
 * A database failure is not caught here on purpose: the page's own error screen
 * then says plainly that it could not be shown, instead of an empty dashboard
 * pretending the person has no cases.
 */
export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const server = await import("./data.server");
    const locale = server.currentLocale();
    const user = await server.currentUser();
    if (!user) return { locale, user: null, areas: [], caseCount: 0 };

    const access = await import("./access.server");
    const byArea = await access.listCasesByArea(access.viewerForUser(user));

    // A Map keeps one bucket per area, in the order `AREA_CODES` declares, so the
    // sections on the page are in a stable product order and never interleaved.
    const areas: DashboardArea[] = [...byArea].map(([area, cases]) => ({
      area,
      cases: cases.map((item) => ({
        id: item.id,
        subject: item.subject,
        area: item.area,
        createdAt: item.createdAt,
        documentCount: item.documentCount,
      })),
    }));

    return {
      locale,
      user: { name: user.name, email: user.email },
      areas,
      caseCount: areas.reduce((sum, group) => sum + group.cases.length, 0),
    };
  },
);

export const signUp = createServerFn({ method: "POST" })
  .validator(
    (input: { name: string; email: string; password: string; confirm: string }) =>
      input,
  )
  .handler(async ({ data: input }): Promise<FormResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());
    const fields: FieldErrors = {};

    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim();
    const password = input.password ?? "";
    const confirm = input.confirm ?? "";

    if (!name) fields.name = t.errors.nameRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fields.email = t.errors.emailInvalid;
    if (password.length < MIN_PASSWORD_LENGTH)
      fields.password = t.errors.passwordShort;
    if (password !== confirm) fields.confirm = t.errors.passwordMismatch;

    if (Object.keys(fields).length > 0) return { ok: false, fields };

    if (!server.dbConfigured()) {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }

    try {
      const created = await server.createUser({ name, email, password });
      if (!created.ok) return { ok: false, fields: { email: t.errors.emailTaken } };
      const token = await server.createSession(created.user.id);
      server.setSessionCookie(token);
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => input)
  .handler(async ({ data: input }): Promise<FormResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());
    const fields: FieldErrors = {};

    const email = (input.email ?? "").trim();
    const password = input.password ?? "";
    if (!email) fields.email = t.errors.required;
    if (!password) fields.password = t.errors.required;
    if (Object.keys(fields).length > 0) return { ok: false, fields };

    if (!server.dbConfigured()) {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }

    try {
      const result = await server.authenticate({ email, password });
      if (!result.ok) {
        const message =
          result.code === "locked"
            ? t.errors.locked
            : t.errors.invalidCredentials;
        return { ok: false, error: message, fields: {} };
      }
      const token = await server.createSession(result.user.id);
      server.setSessionCookie(token);
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const server = await import("./data.server");
    try {
      if (server.dbConfigured()) await server.signOutCurrent();
    } catch {
      // Clearing the cookie below is enough to end the session in the browser.
    }
    server.clearSessionCookie();
    return { ok: true };
  },
);

export const setLanguage = createServerFn({ method: "POST" })
  .validator((input: { locale: string; next: string }) => input)
  .handler(async ({ data: input }): Promise<{ ok: true; next: string }> => {
    const server = await import("./data.server");
    const { resolveLocale } = await import("~/i18n");
    server.setLanguageCookie(resolveLocale(input.locale));
    return { ok: true, next: safeNextPath(input.next) };
  });

/**
 * THE PILOT SAFEGUARDS, as the intake page sees them.
 *
 * Two numbers and a version, nothing else:
 *   - `cap` — how many documents one person may send per calendar month, read from
 *     the one constant in `src/lib/constants.ts` (env-overridable on the server),
 *   - `usedThisMonth` / `remaining` — counted in our own database, per person, for
 *     this purpose only (`countDocumentsThisMonth` in `./access.server`),
 *   - `readingAidVersion` — which wording of the acknowledgement this page is
 *     showing, so the stored confirmation points at the text the person read.
 *
 * This is not analytics: no third party is involved, nothing is sent anywhere, and
 * the count is never used for anything but the cap.
 */
export type PilotStatus = {
  cap: number;
  /** How many of this person's documents the AI took on this month (not uploads). */
  usedThisMonth: number;
  /** `cap - usedThisMonth`, floored at 0. Only AI work is ever refused. */
  remaining: number;
  /**
   * Is the AI route connected at all? `false` today: no model is connected, so
   * the meter cannot bite and the page says so instead of showing a limit that
   * does not apply. Storing documents is unlimited either way.
   */
  aiMetering: boolean;
  readingAidVersion: string;
  /** The human route's address, when the site has one configured. */
  contactEmail: string | null;
};

export const getPilotStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<PilotStatus> => {
    const server = await import("./data.server");
    const cap = server.monthlyDocumentCap();
    const contactEmail = server.contactEmail();
    const aiMetering = server.aiMeteringEnabled();
    const empty: PilotStatus = {
      cap,
      usedThisMonth: 0,
      remaining: cap,
      aiMetering,
      readingAidVersion: READING_AID_VERSION,
      contactEmail,
    };

    // Not signed in, or no database connected: show the limit as if unused. The
    // page is behind a sign-in wall, so this is only the honest fallback for a
    // session that has just ended — never a number that blocks anyone.
    const user = await server.currentUser();
    if (!user || !server.dbConfigured()) return empty;

    try {
      const access = await import("./access.server");
      const used = await access.countDocumentsThisMonth(access.viewerForUser(user));
      return {
        ...empty,
        usedThisMonth: used,
        remaining: Math.max(0, cap - used),
      };
    } catch {
      return empty;
    }
  },
);

export const submitIntake = createServerFn({ method: "POST" })
  .validator(
    (input: {
      city: string;
      state: string;
      subject: string;
      phone: string;
      message: string;
      consent: boolean;
      /** The reading-aid acknowledgement. Required as soon as a document is sent. */
      readingAidAck: boolean;
      documents: DocumentPayload[];
    }) => input,
  )
  .handler(async ({ data: input }): Promise<IntakeResult> => {
    const server = await import("./data.server");
    const locale = server.currentLocale();
    const t = getDictionary(locale);
    const fields: FieldErrors = {};

    const city = (input.city ?? "").trim();
    const state = (input.state ?? "").trim();
    const subject = (input.subject ?? "").trim();
    const message = (input.message ?? "").trim();
    const phone = (input.phone ?? "").trim();

    if (!city) fields.city = t.errors.cityRequired;
    if (!STATES.includes(state)) fields.state = t.errors.stateRequired;
    if (!isSubjectKey(subject)) fields.subject = t.errors.subjectInvalid;
    if (message.length < MIN_MESSAGE_LENGTH)
      fields.message = t.errors.messageShort;
    if (input.consent !== true) fields.consent = t.errors.consentRequired;

    const documents = Array.isArray(input.documents) ? input.documents : [];
    if (documents.length > MAX_FILES) {
      fields.documents = t.errors.filesTooMany;
    }
    for (const doc of documents) {
      if (!ALLOWED_FILE_TYPES.includes(doc.mimeType)) {
        fields.documents = t.errors.fileType;
        break;
      }
      if (!Number.isFinite(doc.size) || doc.size <= 0 || doc.size > MAX_FILE_BYTES) {
        fields.documents = t.errors.fileTooLarge;
        break;
      }
    }

    /*
     * THE READING-AID ACKNOWLEDGEMENT, checked before anything else happens so the
     * person gets the answer without a database round-trip. The gate that decides
     * is the one in `./pilot.server`, reached further down: this check and that one
     * say the same thing, and a submission that skipped this one would still be
     * refused there.
     */
    const readingAidAck = input.readingAidAck === true;
    if (documents.length > 0 && !readingAidAck) {
      fields.readingAid = t.errors.readingAidRequired;
    }

    if (Object.keys(fields).length > 0) return { ok: false, fields };

    if (!server.dbConfigured()) {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };

    // Checked above; repeated so the compiler knows `subject` is a subject key and
    // the area of life can be derived from it without a cast.
    if (!isSubjectKey(subject)) {
      return { ok: false, fields: { subject: t.errors.subjectInvalid } };
    }

    try {
      /*
       * BOTH PILOT GATES ARE ENFORCED HERE, ON THE SERVER — the reading-aid
       * acknowledgement and the monthly document cap. The rules themselves live in
       * `./pilot.server`, which counts in our own database and writes through the
       * one write path; this function only turns a refusal into words in the
       * visitor's language. A disabled button in the form is not the gate.
       */
      const pilot = await import("./pilot.server");
      const stored = await pilot.saveRequestUnderPilotRules({
        userId: user.id,
        city,
        state,
        subject,
        message,
        phone: phone || null,
        readingAidAck,
        locale,
        documents: documents.map((doc) => ({
          filename: safeFilename(doc.filename),
          mimeType: doc.mimeType,
          size: doc.size,
          contentBase64: doc.contentBase64,
          /*
           * Does this document go to an AI provider? One switch decides, on the
           * server: `AI_ROUTE_CONNECTED` (today `false` — no model is connected).
           * While it is `false` every document is stored and none is AI work, so
           * the pilot meter stays at 0 and nothing is refused.
           */
          aiMetered: server.aiMeteringEnabled(),
        })),
      });

      if (!stored.ok) {
        // Plain language, and the human route stays open in both cases: a request
        // without documents is always accepted.
        if (stored.code === "reading_aid_missing") {
          return {
            ok: false,
            fields: { readingAid: t.errors.readingAidRequired },
          };
        }
        return { ok: false, error: t.errors.capReached, fields: {} };
      }

      return { ok: true, area: stored.area };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/** Keep only the last path segment and a safe character set — never a path, never control characters. */
export function safeFilename(raw: string): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return cleaned.slice(0, 120) || "dokument";
}

/** Only ever redirect to a path on our own site. */
export function safeNextPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
