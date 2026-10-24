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
  MAX_FILES,
  MIN_MESSAGE_LENGTH,
  MIN_PASSWORD_LENGTH,
  READING_AID_VERSION,
  STATES,
  isSubjectKey,
} from "~/lib/constants";
import {
  NOTICE_MAX_LENGTH,
  NOTICE_MIN_LENGTH,
  isCaseStatus,
  type CaseStatus,
} from "~/lib/cases";
import { isOwnerRole } from "~/lib/roles";
import { getDictionary, type Locale } from "~/i18n";
import type { AreaCode } from "~/lib/areas";

export type Bootstrap = {
  locale: Locale;
  user: { name: string; email: string } | null;
  /**
   * Is the signed-in account the owner? It decides whether the header offers the
   * link to the private inbox — nothing else. The inbox checks the role on the
   * server for every request, so a browser that flipped this flag would get a 404.
   */
  isOwner: boolean;
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
  | {
      ok: true;
      area: AreaCode;
      /**
       * The stored documents, as the person may see them back: our generated
       * filename (the only one that becomes a URL) and their own name, which is
       * shown as text so they recognise what they sent.
       */
      documents: { id: string; filename: string; originalName: string }[];
    }
  | { ok: false; error?: string; fields: FieldErrors };

/**
 * What the browser sends for one file.
 *
 * `mimeType` and `size` are carried because the browser fills them in, but the
 * server does not believe either: `src/server/uploads.server.ts` decides what the
 * file is from its first bytes and measures its real length after decoding.
 */
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

    /*
     * UPLOAD HARDENING — the files are judged HERE, before anything is written,
     * and the browser's declared type is not part of the judgement. The gate lives
     * in `./uploads.server`: magic bytes decide PDF / JPEG / PNG, the real decoded
     * length is measured against the caps, images are rebuilt from their pixels
     * (EXIF, GPS and appended payload gone) and the stored name is generated by
     * us. A refusal is a code; the words come from the language file.
     */
    const uploads = await import("./uploads.server");
    const prepared = await uploads.prepareDocuments(documents);
    if (!prepared.ok) {
      fields.documents = uploadRefusalMessage(prepared.code, t);
    }
    // Narrowed here, not by the `if` above: a refusal is reported in `fields` and
    // the submission stops at the `Object.keys(fields).length` check below.
    const preparedDocuments = prepared.ok ? prepared.documents : [];

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
        documents: preparedDocuments.map((doc) => ({
          filename: doc.filename,
          originalName: doc.originalName,
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

      return { ok: true, area: stored.area, documents: stored.documents };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/* ------------------------------------------- the person's own request list */

/** One document, as the person's own list shows it. */
export type MyDocument = {
  id: string;
  /** The person's own filename, shown as text. The download uses the id. */
  originalName: string;
  size: number;
  createdAt: string;
};

/** One notice about a missing document, as the person's own list shows it. */
export type MyNotice = {
  id: string;
  requestId: string;
  message: string;
  createdAt: string;
};

/** One of the person's own cases, with everything their list shows about it. */
export type MyCase = {
  id: string;
  /** The area of life it is filed under — the code; the page looks up the label. */
  area: AreaCode;
  subject: string;
  status: CaseStatus;
  createdAt: string;
  message: string;
  documents: MyDocument[];
  /** Only the notices that are still open: dismissed and answered ones are gone. */
  notices: MyNotice[];
};

export type MyRequestsData = {
  locale: Locale;
  user: { name: string; email: string } | null;
  cases: MyCase[];
  /** Which wording of the reading-aid acknowledgement an upload here is confirmed against. */
  readingAidVersion: string;
  contactEmail: string | null;
};

/**
 * THE PERSON'S OWN LIST — every case they have submitted, newest first.
 *
 * The cases, the documents and the notices all come from `./access.server`, and
 * from nowhere else: that module requires the viewer, and its SQL carries the
 * person's id, so a list built from this function can only ever contain rows of
 * the person asking. There is no parameter a browser could send to widen it.
 */
export const getMyRequests = createServerFn({ method: "GET" }).handler(
  async (): Promise<MyRequestsData> => {
    const server = await import("./data.server");
    const locale = server.currentLocale();
    const empty: MyRequestsData = {
      locale,
      user: null,
      cases: [],
      readingAidVersion: READING_AID_VERSION,
      contactEmail: server.contactEmail(),
    };

    const user = await server.currentUser();
    if (!user || !server.dbConfigured()) return empty;

    const access = await import("./access.server");
    const viewer = access.viewerForUser(user);
    const [cases, documents, notices] = await Promise.all([
      access.listOwnCases(viewer),
      access.listDocumentsForOwnCases(viewer),
      access.listOpenNoticesForOwnCases(viewer),
    ]);

    const documentsByCase = new Map<string, MyDocument[]>();
    for (const document of documents) {
      const bucket = documentsByCase.get(document.requestId);
      const shown: MyDocument = {
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        createdAt: document.createdAt,
      };
      if (bucket) bucket.push(shown);
      else documentsByCase.set(document.requestId, [shown]);
    }

    const noticesByCase = new Map<string, MyNotice[]>();
    for (const notice of notices) {
      const shown: MyNotice = {
        id: notice.id,
        requestId: notice.requestId,
        message: notice.message,
        createdAt: notice.createdAt,
      };
      const bucket = noticesByCase.get(notice.requestId);
      if (bucket) bucket.push(shown);
      else noticesByCase.set(notice.requestId, [shown]);
    }

    return {
      ...empty,
      user: { name: user.name, email: user.email },
      cases: cases.map((item) => ({
        id: item.id,
        area: item.area,
        subject: item.subject,
        status: item.status,
        createdAt: item.createdAt,
        message: item.message,
        documents: documentsByCase.get(item.id) ?? [],
        notices: noticesByCase.get(item.id) ?? [],
      })),
    };
  },
);

/** The answer to an action the person takes on their own list. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error?: string; fields: FieldErrors };

/**
 * DELETE ONE OF MY CASES — the case, its documents and the notices about it.
 *
 * The rows are deleted, not hidden (`deleteCase` in `./data.server` is one DELETE
 * with the person's id in its WHERE clause). The page asks the person to confirm
 * first, and says what will go: the case's subject and date, and how many
 * documents are attached to it.
 */
export const deleteMyRequest = createServerFn({ method: "POST" })
  .validator((input: { requestId: string }) => input)
  .handler(async ({ data: input }): Promise<ActionResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };

    const requestId = typeof input.requestId === "string" ? input.requestId : "";
    if (!requestId) return { ok: false, error: t.errors.caseNotFound, fields: {} };

    try {
      const deleted = await server.deleteCase({ requestId, userId: user.id });
      if (!deleted) return { ok: false, error: t.errors.caseNotFound, fields: {} };
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/**
 * ATTACH A DOCUMENT TO ONE OF MY CASES — the way a person answers a notice.
 *
 * The same upload gate as the intake form (`./uploads.server`: magic bytes decide
 * the type, the real byte length is measured, images are rebuilt from their
 * pixels), the same reading-aid acknowledgement before anything is stored, and the
 * same pilot rule that storing is unlimited — no count is consulted here at all.
 *
 * The case is read first through the access module, which proves it belongs to the
 * signed-in person and hands back its area; a case id belonging to somebody else
 * is simply "not found".
 */
export const attachDocumentToMyRequest = createServerFn({ method: "POST" })
  .validator(
    (input: {
      requestId: string;
      readingAidAck: boolean;
      documents: DocumentPayload[];
    }) => input,
  )
  .handler(async ({ data: input }): Promise<IntakeResult> => {
    const server = await import("./data.server");
    const locale = server.currentLocale();
    const t = getDictionary(locale);
    const fields: FieldErrors = {};

    const requestId = typeof input.requestId === "string" ? input.requestId : "";
    const documents = Array.isArray(input.documents) ? input.documents : [];
    if (documents.length === 0) fields.documents = t.errors.fileRequired;
    if (documents.length > MAX_FILES) fields.documents = t.errors.filesTooMany;
    if (documents.length > 0 && input.readingAidAck !== true)
      fields.readingAid = t.errors.readingAidRequired;

    const uploads = await import("./uploads.server");
    const prepared = await uploads.prepareDocuments(documents);
    if (!prepared.ok) fields.documents = uploadRefusalMessage(prepared.code, t);

    if (Object.keys(fields).length > 0) return { ok: false, fields };
    if (!server.dbConfigured())
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };

    try {
      const access = await import("./access.server");
      const own = await access.getOwnCase(access.viewerForUser(user), requestId);
      if (!own) return { ok: false, error: t.errors.caseNotFound, fields: {} };

      const stored = await server.addDocumentToCase({
        requestId: own.id,
        // The case's own area, read a moment ago — a document never chooses one.
        area: own.area,
        documents: prepared.ok
          ? prepared.documents.map((document) => ({
              filename: document.filename,
              originalName: document.originalName,
              mimeType: document.mimeType,
              size: document.size,
              contentBase64: document.contentBase64,
              /*
               * The same switch as the intake form: does this document go to an AI
               * provider? Today `false` — no model is connected — so an attached
               * document is stored and never counted against the pilot meter.
               */
              aiMetered: server.aiMeteringEnabled(),
            }))
          : [],
        readingAid: { version: READING_AID_VERSION, locale },
      });
      if (!stored.ok) return { ok: false, error: t.errors.caseNotFound, fields: {} };

      return { ok: true, area: own.area, documents: stored.documents };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/**
 * PUT ONE NOTICE AWAY. The person's decision, and it holds: a dismissed notice
 * never appears again and is never re-sent (the row keeps `dismissed_at`).
 */
export const dismissMyNotice = createServerFn({ method: "POST" })
  .validator((input: { noticeId: string }) => input)
  .handler(async ({ data: input }): Promise<ActionResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };

    const noticeId = typeof input.noticeId === "string" ? input.noticeId : "";
    try {
      const access = await import("./access.server");
      const notice = await access.getOwnNotice(access.viewerForUser(user), noticeId);
      if (!notice) return { ok: false, error: t.errors.caseNotFound, fields: {} };
      await server.dismissNotice({ noticeId: notice.id });
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/* ------------------------------------------------- the owner's inbox */

/** One document in the owner's view. */
export type InboxDocument = {
  id: string;
  originalName: string;
  size: number;
  createdAt: string;
};

/** One notice in the owner's view, including the ones the person has closed. */
export type InboxNotice = {
  id: string;
  message: string;
  createdAt: string;
  dismissedAt: string | null;
  fulfilledAt: string | null;
};

/** One case in the owner's casework view — every person's cases, nothing hidden. */
export type InboxCase = {
  id: string;
  area: AreaCode;
  subject: string;
  status: CaseStatus;
  createdAt: string;
  message: string;
  city: string;
  state: string;
  phone: string | null;
  /** The person's own details, as they gave them. There is no other record of them. */
  person: { name: string; email: string };
  documents: InboxDocument[];
  notices: InboxNotice[];
};

/**
 * What the inbox route got back.
 *
 * Three states, because the route has to answer differently for each and the
 * difference must be made on the server: signed out → 307 to the sign-in page,
 * signed in but not the owner → 404, owner → the cases. `forbidden` carries no
 * data at all, so a person who calls the server function directly learns nothing.
 */
export type OwnerInbox =
  | { state: "signed_out" }
  | { state: "forbidden" }
  | { state: "ok"; locale: Locale; cases: InboxCase[] };

/**
 * THE OWNER'S INBOX — every case of every person, newest first.
 *
 * Only an account whose stored role is `owner` gets `state: "ok"`; everybody else
 * gets `forbidden`, and the page turns that into a 404 in the server response. The
 * read itself goes through `listAllCasesForOwner`, which takes an `OwnerViewer`
 * that only `viewerForOwner` can build.
 */
export const getOwnerInbox = createServerFn({ method: "GET" }).handler(
  async (): Promise<OwnerInbox> => {
    const server = await import("./data.server");
    const user = await server.currentUser();
    if (!user) return { state: "signed_out" };
    if (!isOwnerRole(user.role) || !server.dbConfigured()) return { state: "forbidden" };

    const access = await import("./access.server");
    const cases = await access.listAllCasesForOwner(access.viewerForOwner(user));

    return {
      state: "ok",
      locale: server.currentLocale(),
      cases: cases.map((item) => ({
        id: item.id,
        area: item.area,
        subject: item.subject,
        status: item.status,
        createdAt: item.createdAt,
        message: item.message,
        city: item.city,
        state: item.state,
        phone: item.phone,
        person: item.person,
        documents: item.documents.map((document) => ({
          id: document.id,
          originalName: document.originalName,
          size: document.size,
          createdAt: document.createdAt,
        })),
        notices: item.notices.map((notice) => ({
          id: notice.id,
          message: notice.message,
          createdAt: notice.createdAt,
          dismissedAt: notice.dismissedAt,
          fulfilledAt: notice.fulfilledAt,
        })),
      })),
    };
  },
);

/**
 * MARK A CASE AS BEING HANDLED OR COMPLETED — the owner's own bookkeeping.
 *
 * The role is checked here, on the server, from the session cookie: a person who
 * called this endpoint directly would be refused before the write path is
 * reached, whatever their browser showed them.
 */
export const ownerSetCaseStatus = createServerFn({ method: "POST" })
  .validator((input: { requestId: string; status: string }) => input)
  .handler(async ({ data: input }): Promise<ActionResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };
    if (!isOwnerRole(user.role))
      return { ok: false, error: t.errors.caseNotFound, fields: {} };

    if (!isCaseStatus(input.status))
      return { ok: false, error: t.errors.generic, fields: {} };
    try {
      const changed = await server.setCaseStatus({
        requestId: String(input.requestId ?? ""),
        status: input.status,
      });
      if (!changed) return { ok: false, error: t.errors.caseNotFound, fields: {} };
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/**
 * ASK A PERSON FOR ONE MISSING DOCUMENT — from us, inside the app.
 *
 * No e-mail, no authority, no letter: the notice is a row the person sees on their
 * own list, in their own language, with a way to attach the document and a way to
 * put the notice away. The words on the person's side say it is from AIE
 * Deutschland (`myRequests.noticeFrom`), because that is who is asking.
 */
export const ownerRequestDocument = createServerFn({ method: "POST" })
  .validator((input: { requestId: string; message: string }) => input)
  .handler(async ({ data: input }): Promise<ActionResult> => {
    const server = await import("./data.server");
    const t = getDictionary(server.currentLocale());
    const fields: FieldErrors = {};

    const user = await server.currentUser();
    if (!user) return { ok: false, error: t.errors.notSignedIn, fields: {} };
    if (!isOwnerRole(user.role))
      return { ok: false, error: t.errors.caseNotFound, fields: {} };

    const message = String(input.message ?? "").trim();
    if (message.length < NOTICE_MIN_LENGTH) fields.message = t.errors.noticeTooShort;
    if (message.length > NOTICE_MAX_LENGTH) fields.message = t.errors.noticeTooLong;
    if (Object.keys(fields).length > 0) return { ok: false, fields };

    try {
      const created = await server.createNotice({
        requestId: String(input.requestId ?? ""),
        message,
      });
      if (!created) return { ok: false, error: t.errors.caseNotFound, fields: {} };
      return { ok: true };
    } catch {
      return { ok: false, error: t.errors.dbUnavailable, fields: {} };
    }
  });

/**
 * A refusal from the upload gate, in the visitor's language.
 *
 * The four sentences are deliberately plain and never blame the person: they say
 * what we could not take and what to do instead. `unreadable` exists because a
 * file we cannot rebuild is a file we will not store — and saying so is better
 * than a vague "something went wrong".
 */
function uploadRefusalMessage(
  code: import("./uploads.server").UploadRefusal,
  t: ReturnType<typeof getDictionary>,
): string {
  switch (code) {
    case "too_many":
      return t.errors.filesTooMany;
    case "too_large":
      return t.errors.fileTooLarge;
    case "total_too_large":
      return t.errors.filesTooBigAll;
    case "type":
      return t.errors.fileType;
    case "unreadable":
      return t.errors.fileUnreadable;
  }
}

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
