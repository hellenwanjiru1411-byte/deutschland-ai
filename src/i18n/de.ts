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
export const de = {
  // The business name is the same in every language, but it still lives here so
  // that no page or component ever hardcodes it.
  brand: {
    name: "AIE Deutschland",
    mark: "A",
  },
  meta: {
    siteTitle: "AIE Deutschland",
    homeTitle: "AIE Deutschland — Schluss mit Behördenfrust",
    homeDescription:
      "Wir kümmern uns um Anträge, Formulare und Termine bei Behörden in Deutschland. Sagen Sie uns, wo Sie feststecken.",
    signUpTitle: "Konto erstellen — AIE Deutschland",
    signInTitle: "Anmelden — AIE Deutschland",
    intakeTitle: "Anliegen schildern — AIE Deutschland",
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
    home: "Startseite",
  },
  lang: {
    label: "Sprache wählen",
    switchTo: "Auf Englisch ansehen",
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
    intro: "Das sind die Fälle, die uns am häufigsten begegnen.",
    items: [
      "Anmeldung und Ummeldung",
      "Anträge und Formulare bei Ämtern",
      "Termine bei Behörden vereinbaren",
      "Fristen im Blick behalten",
      "Wohnungsunterlagen und Wohnungsgeberbestätigung",
      "Unterlagen prüfen und vervollständigen",
      "Hilfe beim Finden der passenden Anwältin oder des passenden Anwalts",
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
    freeLine: "Aktuell kostenlos.",
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
    existingSession: "Sie sind bereits angemeldet.",
    signedInAs: "Angemeldet als",
    // There is no email integration yet: we cannot send a reset link, so a
    // forgotten password has to be reset by hand.
    forgot:
      "Passwort vergessen? Schreiben Sie uns — wir setzen es für Sie zurück.",
    signOutDone: "Sie sind abgemeldet.",
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
    submit: "Anliegen senden",
    sending: "Wird gesendet …",
    success:
      "Danke! Wir haben Ihr Anliegen erhalten und melden uns schnellstmöglich bei Ihnen.",
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
