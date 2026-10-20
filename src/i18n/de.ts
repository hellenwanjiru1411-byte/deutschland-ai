/**
 * German dictionary — the default language of the site.
 *
 * IMPORTANT for every language added later:
 *   - Add one new file next to this one (e.g. `ar.ts`), export an object with the
 *     same shape as this one, and add one entry to `LANGUAGES` in
 *     `src/i18n/index.ts`. Nothing else in the app has to change.
 *   - A new language must be written by a human who speaks it. Two pieces of text
 *     may NEVER go live machine-translated: the CONSENT text in `intake.consent`
 *     and the LEGAL DISCLAIMER in `footer.disclaimer`. Both carry legal weight.
 *   - `docs/adding-a-language.md` is the full checklist, including what a native
 *     speaker has to sign off before the language goes live.
 */
import type { AreaCode } from "~/lib/areas";
import type { CapabilityCode, CapabilityCopy } from "~/lib/capabilities";

export const de = {
  // The business name is the same in every language, but it still lives here so
  // that no page or component ever hardcodes it.
  brand: {
    name: "AIE Deutschland",
    mark: "A",
  },
  meta: {
    homeTitle: "AIE Deutschland — Schluss mit Behördenfrust",
    homeDescription:
      "Wir kümmern uns um Anträge, Formulare und Termine bei Behörden in Deutschland. Sagen Sie uns, wo Sie feststecken.",
    signUpTitle: "Konto erstellen — AIE Deutschland",
    signInTitle: "Anmelden — AIE Deutschland",
    intakeTitle: "Anliegen schildern — AIE Deutschland",
    dashboardTitle: "Ihr Überblick — AIE Deutschland",
  },
  nav: {
    label: "Navigation",
    how: "So funktioniert es",
    services: "Was wir übernehmen",
    signIn: "Anmelden",
    signUp: "Konto erstellen",
    signOut: "Abmelden",
    signingOut: "Wird abgemeldet …",
    intake: "Anliegen schildern",
    dashboard: "Überblick",
    home: "Startseite",
  },
  lang: {
    label: "Sprache wählen",
    switching: "Sprache wird umgestellt …",
  },
  status: {
    // Shown while a page that needs the server is still loading.
    loading: "Einen Moment bitte — die Seite wird geladen.",
  },
  hero: {
    eyebrow: "Hilfe bei Anträgen, Formularen und Terminen",
    title: "Schluss mit",
    titleAccent: "Behördenfrust.",
    lead: "Sie sagen uns, wo Sie feststecken — wir kümmern uns um Anträge, Formulare und Termine. Ohne Warteschleifen und ohne Behördendeutsch.",
    ctaPrimary: "Anliegen schildern",
    ctaSecondary: "Konto erstellen",
  },
  panel: {
    title: "Typische Anliegen",
    intro: "Sie schildern uns in ein paar Sätzen, worum es geht. Wir übernehmen den Rest.",
    chips: [
      "Anmeldung",
      "Aufenthaltstitel",
      "Kindergeld",
      "Steuer-ID",
      "Krankenversicherung",
      "Wohnungsgeberbestätigung",
      "Termin beim Amt",
      "Frist",
    ],
  },
  how: {
    title: "So funktioniert es",
    steps: [
      {
        title: "Anliegen schildern",
        body: "Sagen Sie uns in ein paar Sätzen, worum es geht. Zum Beispiel: Anmeldung, Aufenthaltstitel, Kindergeld oder Steuer-ID.",
      },
      {
        title: "Unterlagen hochladen",
        body: "Laden Sie Ihre Dokumente hoch. Wir prüfen, was noch fehlt.",
      },
      {
        title: "Wir übernehmen",
        body: "Wir kümmern uns um die Formulare, die Termine und die Fristen und melden uns, sobald es Neuigkeiten gibt.",
      },
    ],
  },
  services: {
    title: "Was wir übernehmen",
    intro: "Alltägliche Anliegen bei Behörden, die wir für Sie übernehmen.",
    items: [
      "Anmeldung und Ummeldung",
      "Anträge und Formulare bei Ämtern",
      "Termine bei Behörden vereinbaren",
      "Fristen im Blick behalten",
      "Wohnungsunterlagen und Wohnungsgeberbestätigung",
      "Unterlagen prüfen und Ihnen sagen, was noch fehlt",
      // A line offering help finding a lawyer used to sit here. Legal referrals
      // are one of the regulated activities the business plan names, so it stays
      // out of customer copy until the legal check has cleared it.
    ],
  },
  newcomers: {
    title: "Neu in Deutschland?",
    body: "Wir helfen bei den ersten Schritten: Anmeldung, Steuer-ID, Krankenversicherung und den Unterlagen für Ihren Aufenthalt.",
  },
  free: "Aktuell kostenlos — wir arbeiten noch am Pilotbetrieb.",
  booking: {
    title: "Termin buchen",
    body: "Sie sprechen lieber persönlich? Buchen Sie einen Termin. Sie können uns Ihr Anliegen aber auch direkt hier senden.",
    cta: "Termin buchen",
    note: "Sie können uns Ihr Anliegen hier senden oder einen Termin buchen.",
  },
  footer: {
    // LEGAL DISCLAIMER — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    disclaimer:
      "AIE Deutschland ist kein Anwaltsbüro und keine Behörde. Wir unterstützen bei Anträgen, Formularen und Terminen und leisten keine Rechtsberatung.",
    pilot: "Pilotbetrieb",
    // The only contact route we offer. No phone number, no postal address.
    contactLabel: "Schreiben Sie uns",
    navLabel: "Fußzeile",
  },
  notFound: {
    title: "Diese Seite gibt es nicht.",
    lead: "Vielleicht hat sich die Adresse geändert. Sie können zur Startseite zurückgehen oder uns Ihr Anliegen direkt schildern.",
  },
  // The screen a visitor sees when something in the site breaks. Plain language,
  // no error codes and no internals: nobody should have to read a stack trace,
  // and the most important thing to say is that their documents are safe.
  error: {
    title: "Da ist etwas schiefgelaufen.",
    lead: "Diese Seite konnte gerade nicht angezeigt werden. Ihre Angaben und Unterlagen sind sicher — es ist nichts verloren gegangen. Bitte versuchen Sie es in einem Moment noch einmal.",
    contactLead: "Wenn es weiterhin nicht klappt, schreiben Sie uns:",
  },
  auth: {
    signUpTitle: "Konto erstellen",
    signUpIntro:
      "Ein eigenes Konto sorgt dafür, dass Ihre Unterlagen nur für Sie und für uns sichtbar sind.",
    signInTitle: "Anmelden",
    signInIntro: "Melden Sie sich an, um Ihr Anliegen zu schildern.",
    name: "Name",
    email: "E-Mail-Adresse",
    password: "Passwort",
    passwordRepeat: "Passwort wiederholen",
    submitSignUp: "Konto erstellen",
    submitSignIn: "Anmelden",
    sendingSignUp: "Konto wird erstellt …",
    sendingSignIn: "Anmeldung läuft …",
    haveAccount: "Sie haben schon ein Konto?",
    noAccount: "Noch kein Konto?",
    passwordHint: "Mindestens 8 Zeichen.",
    signedInAs: "Angemeldet als",
    // There is no email integration yet: we cannot send a reset link, so a
    // forgotten password has to be reset by hand.
    forgot:
      "Passwort vergessen? Schreiben Sie uns — wir setzen es für Sie zurück.",
  },
  intake: {
    title: "Anliegen schildern",
    intro:
      "Je klarer wir wissen, worum es geht, desto schneller können wir uns darum kümmern.",
    name: "Name",
    email: "E-Mail-Adresse",
    city: "Stadt oder Gemeinde",
    state: "Bundesland",
    stateHint: "So wie auf Ihren Unterlagen.",
    statePick: "Bitte auswählen",
    subject: "Worum geht es?",
    phone: "Telefon (optional)",
    message: "Beschreiben Sie kurz Ihr Anliegen",
    messageHint: "Mindestens 20 Zeichen.",
    files: "Unterlagen hochladen (optional)",
    filesHint: "PDF, JPG oder PNG. Maximal 2 Dateien, je höchstens 2 MB.",
    filesChosen: "Ausgewählte Dateien",
    consentLabel: "Einverständnis",
    // CONSENT TEXT — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    consent:
      "Ich bin damit einverstanden, dass AIE Deutschland meine Angaben und Unterlagen vertraulich verarbeitet, um mein Anliegen zu bearbeiten. Ich kann meine Daten jederzeit löschen lassen.",
    /*
     * READING-AID ACKNOWLEDGEMENT — the box that has to be ticked before a
     * document can be sent with a request.
     *
     * A NATIVE SPEAKER MUST CHECK THIS WORDING in any new language before it goes
     * live. It is the line on which someone hands us their papers, so it carries
     * the same weight as the consent text above. Never machine-translate it.
     *
     * WHAT IT MAY SAY — only what is true while the legal question is open (see
     * the business plan): we are a reading and understanding aid, we are not
     * lawyers, we are not an authority, and the person checks every deadline
     * themselves. It must claim no conclusion about German law, must say nothing
     * about whether this help is lawful or unlawful, and must not call our output
     * legal advice.
     *
     * CHANGING THIS WORDING — in this language or any other — means bumping
     * `READING_AID_VERSION` in `src/lib/constants.ts` in the same change, because
     * every stored request records which version the person confirmed.
     */
    readingAidLabel: "Lese- und Verständnishilfe",
    readingAid:
      "Ich habe verstanden: AIE Deutschland ist eine Lese- und Verständnishilfe. Wir sind keine Anwältinnen und Anwälte und keine Behörde. Ich prüfe jede Frist selbst.",
    readingAidHint: "Nötig, sobald Sie Unterlagen hochladen.",
    submit: "Anliegen senden",
    sending: "Wird gesendet …",
    success:
      "Danke! Wir haben Ihr Anliegen erhalten und melden uns schnellstmöglich bei Ihnen.",
    // Shown under the thank-you line, followed by the area of life the case was
    // filed under (see `areas` below). The person picks a subject and never has to
    // answer a second question — this line just tells them where the case landed.
    filedUnder: "Ihr Anliegen ist diesem Bereich zugeordnet:",
    subjects: {
      anmeldung: "Anmeldung oder Ummeldung",
      aufenthalt_visa: "Aufenthalt und Visa",
      anerkennung: "Anerkennung von Abschlüssen",
      krankenversicherung: "Krankenversicherung",
      kindergeld: "Kindergeld und Familie",
      steuern: "Steuern und Steuer-ID",
      gewerbe: "Gewerbe und Selbstständigkeit",
      wohnung: "Wohnung und Mietunterlagen",
      termin_frist: "Termin oder Frist",
      anwalt_gericht: "Anwalt oder Gericht",
      sonstiges: "Sonstiges",
    },
    // The 16 states are official names: they stay the same in every language,
    // because that is what people see on their official documents.
    states: {} as Record<string, string>,
  },
  /*
   * AREAS OF LIFE — the labels for the closed set of areas a case can belong to.
   *
   * The keys are stable internal codes (`src/lib/areas.ts`), never shown; these
   * are the words a person reads. The type below says every area code must have a
   * label here, so a new area without German copy is a build error. Nothing
   * crosses between areas: a case is filed under exactly one of these.
   */
  areas: {
    residence: "Aufenthalt und Einwanderung",
    health_insurance: "Krankenversicherung",
    taxes: "Steuern",
    family: "Familie und Kindergeld",
    housing: "Wohnen und Miete",
    work: "Arbeit und Selbstständigkeit",
    appointments: "Termine und Fristen",
    legal: "Recht und Gericht",
    other: "Sonstiges",
  } satisfies Record<AreaCode, string>,
  /*
   * THE DASHBOARD — the page a signed-in person lands on.
   *
   * Two rules are enforced here, not just written down (the smoke test checks
   * both): every card shows BOTH routes with labels that cannot be mistaken for
   * each other, and nothing on the page claims that a capability works. The AI
   * route says it is not available yet on every card until a model is really
   * connected — see `src/lib/capabilities.ts`.
   */
  dashboard: {
    title: "Ihr Überblick",
    lead: "Hier sehen Sie Ihre Anliegen — nach Bereich sortiert — und was wir für Sie übernehmen. Jede Aufgabe hat zwei Wege: die App mit KI oder ein Mensch, der sie mit Ihnen erledigt.",
    honestyTitle: "Was heute schon geht — und was noch nicht",
    honesty:
      "Eine KI ist noch nicht angebunden. Die App kann noch keinen Brief erklären, keine Frist erkennen und nichts übersetzen. Der menschliche Weg funktioniert dagegen schon: Sie schildern uns Ihr Anliegen, und wir kümmern uns darum — im Pilotbetrieb sitzen wir selbst daran.",
    routes: {
      // The two route labels. They must stay clearly different words: nobody
      // should have to guess whether a machine or a person is dealing with their
      // paperwork. The smoke test fails if they become the same sentence.
      aiLabel: "Die App erledigt das mit KI",
      aiStatus: "Noch nicht verfügbar",
      humanLabel: "Ein Mensch erledigt das mit Ihnen",
      humanStatus: "Heute verfügbar",
      humanCta: "Anliegen schildern",
    },
    capabilitiesTitle: "Was wir übernehmen",
    capabilitiesIntro:
      "Sieben Aufgaben, jede mit beiden Wegen. Die Reihenfolge zeigt, was wir zuerst bauen.",
    cases: {
      title: "Ihre Anliegen",
      intro:
        "Ihre eigenen Anliegen, nach Bereich sortiert. Was in einen Bereich gehört, ist in keinem anderen sichtbar.",
      receivedLabel: "Eingegangen",
      documentsLabel: "Unterlagen",
      emptyTitle: "Sie haben uns noch kein Anliegen geschildert.",
      emptyLead:
        "Sobald Sie uns eines schildern, steht es hier — sortiert nach dem Bereich, zu dem es gehört.",
      emptyCta: "Anliegen schildern",
    },
  },
  /*
   * PILOT SAFEGUARDS — the monthly document cap.
   *
   * The owner pays for every letter personally during the pilot, so the app counts
   * and limits how many documents one person may send. Three things have to be
   * said plainly in every language, and the smoke test checks that these strings
   * exist: the limit is OURS, it exists because we pay per letter ourselves, and
   * nothing is charged to the person. The human route must stay open, with a way
   * to take it.
   *
   * `{used}` and `{cap}` are filled in by the page (`src/routes/anliegen.tsx`).
   * Every language has to keep both placeholders, or the numbers cannot be shown.
   */
  pilot: {
    capTitle: "Grenze im Pilotbetrieb",
    capBody:
      "Im Pilotbetrieb zahlen wir jede Unterlage selbst. Deshalb nehmen wir pro Person und Kalendermonat höchstens {cap} Unterlagen an. Das ist unsere Grenze — Ihnen wird nichts berechnet.",
    usage: "{used} von {cap} Unterlagen in diesem Monat",
    reachedTitle: "Für diesen Monat ist die Grenze erreicht",
    reachedBody:
      "Sie haben in diesem Monat so viele Unterlagen gesendet, wie wir im Pilotbetrieb annehmen können. Das ist unsere Grenze, nicht Ihre: Ihnen wird nichts berechnet. Der menschliche Weg bleibt offen — schildern Sie uns Ihr Anliegen ohne Unterlagen, wir kümmern uns darum.",
    contactCta: "Schreiben Sie uns direkt",
  },
  /*
   * THE SEVEN CAPABILITIES — the cards on the dashboard, in the business plan's
   * order (`CAPABILITY_CODES` in `src/lib/capabilities.ts`).
   *
   * `satisfies Record<CapabilityCode, CapabilityCopy>` is the guarantee: a
   * capability without German copy is a build error, and every other language has
   * to match this shape or the build fails too.
   *
   * `body` describes the capability — it must not claim it works. `aiNote` says
   * plainly what the app cannot do yet, per capability. `humanNote` says what the
   * human route does today: during the pilot the human is the team itself, so it
   * may promise help we really give — never legal advice, and never a certified
   * translation.
   */
  capabilities: {
    understand_letter: {
      title: "Brief verstehen",
      body: "Ein Behördenbrief in einfacher Sprache: wer schreibt, worum es geht, welche Frist gilt und was Sie tun müssen.",
      aiNote: "Die App kann noch keinen Brief erklären — dafür fehlt das KI-Modell.",
      humanNote:
        "Laden Sie den Brief beim Anliegen hoch. Wir erklären Ihnen, was er bedeutet und was zu tun ist.",
    },
    track_deadlines: {
      title: "Fristen im Blick behalten",
      body: "Fristen aus Ihren Briefen an einer Stelle gesammelt, damit keine davon untergeht.",
      aiNote: "Die App erkennt noch keine Fristen in Briefen.",
      // No reminder channel exists yet (no e-mail, the calendar comes in the
      // next stage), so this line must not promise to get in touch later.
      humanNote:
        "Nennen Sie uns die Frist mit Ihrem Anliegen. Wir sagen Ihnen, was zu tun ist, damit sie nicht versäumt wird.",
    },
    organise_paperwork: {
      title: "Unterlagen ordnen",
      body: "Alle Dokumente zu einem Anliegen an einer Stelle — später auffindbar statt im Ordner verloren.",
      aiNote: "Die App sortiert Ihre Unterlagen noch nicht selbst.",
      humanNote:
        "Laden Sie Ihre Unterlagen beim Anliegen hoch. Wir prüfen sie und sagen Ihnen, was noch fehlt.",
    },
    find_authority: {
      title: "Die richtige Stelle finden",
      body: "Sie schildern das Problem und erfahren, welche Behörde oder Stelle zuständig ist.",
      aiNote: "Die App schlägt Ihnen noch keine Behörde vor.",
      humanNote:
        "Schildern Sie uns, worum es geht. Wir sagen Ihnen, an welche Stelle Sie sich wenden können.",
    },
    manage_appointments: {
      title: "Termine verwalten",
      body: "Termine bei Behörden und die Fristen aus Ihren Briefen an einer Stelle in der App.",
      aiNote:
        "Der Kalender in der App ist noch nicht gebaut — Termine und Erinnerungen gibt es hier noch nicht.",
      // We cannot book anything on someone's behalf, so this says what we really
      // do: help them get the appointment.
      humanNote:
        "Schildern Sie uns, welchen Termin Sie brauchen. Wir sagen Ihnen, wie Sie ihn bekommen, und unterstützen Sie dabei.",
    },
    translate_documents: {
      title: "Dokumente übersetzen",
      body: "Deutsches Behördendeutsch in eine Sprache, die Sie wirklich lesen.",
      aiNote: "Die App übersetzt noch keine Dokumente.",
      humanNote:
        "Schildern Sie uns, welche Sprache Sie brauchen. Wir erklären Ihnen, was im Dokument steht — eine beglaubigte Übersetzung ist das nicht.",
    },
    access_support: {
      title: "Weitere Hilfe finden",
      body: "Wo Sie über uns hinaus Unterstützung bekommen — Beratungsstellen und Anlaufpunkte.",
      aiNote: "Die App zeigt Ihnen noch keine Beratungsstellen.",
      humanNote:
        "Schildern Sie uns Ihre Situation. Wir suchen mit Ihnen, wo Sie weiter Unterstützung bekommen.",
    },
  } satisfies Record<CapabilityCode, CapabilityCopy>,
  errors: {
    required: "Bitte füllen Sie dieses Feld aus.",
    nameRequired: "Bitte geben Sie Ihren Namen ein.",
    emailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    passwordShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    emailTaken:
      "Für diese E-Mail-Adresse gibt es schon ein Konto. Bitte melden Sie sich an.",
    invalidCredentials: "E-Mail-Adresse oder Passwort stimmt nicht.",
    locked:
      "Zu viele Fehlversuche. Bitte versuchen Sie es in ein paar Minuten noch einmal.",
    notSignedIn: "Bitte melden Sie sich an.",
    cityRequired: "Bitte geben Sie Ihre Stadt oder Gemeinde ein.",
    stateRequired: "Bitte wählen Sie Ihr Bundesland aus.",
    subjectInvalid: "Bitte wählen Sie aus, worum es geht.",
    messageShort: "Bitte beschreiben Sie Ihr Anliegen in mindestens 20 Zeichen.",
    consentRequired: "Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.",
    readingAidRequired:
      "Bitte bestätigen Sie den Hinweis zur Lese- und Verständnishilfe, bevor Sie Unterlagen senden.",
    capReached:
      "Mehr Unterlagen können wir in diesem Monat nicht annehmen: Im Pilotbetrieb zahlen wir jede Unterlage selbst und nehmen deshalb nur eine begrenzte Zahl pro Person an. Ihnen wird nichts berechnet. Der menschliche Weg bleibt offen — schildern Sie uns Ihr Anliegen ohne Unterlagen.",
    fileType: "Nur PDF-, JPG- und PNG-Dateien. Bitte laden Sie die Datei erneut hoch.",
    fileTooLarge: "Diese Datei ist zu groß. Maximal 2 MB pro Datei.",
    filesTooMany: "Bitte laden Sie höchstens 2 Dateien hoch.",
    filesTooBigAll: "Die Dateien sind zusammen zu groß. Bitte laden Sie weniger hoch.",
    dbUnavailable:
      "Wir können Ihr Anliegen gerade nicht speichern. Bitte versuchen Sie es in ein paar Minuten noch einmal.",
    generic: "Da ist etwas schiefgelaufen. Bitte versuchen Sie es noch einmal.",
  },
};

/**
 * Every other language file must match this shape exactly. If a key is missing,
 * the build fails — which is the point: a half-translated page should never ship.
 */
export type Dictionary = typeof de;
