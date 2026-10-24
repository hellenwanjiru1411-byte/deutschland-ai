import type { Dictionary } from "./de";

/**
 * English dictionary.
 *
 * This is NOT a literal translation of the German file: it is written for the
 * same reader — someone standing in front of a form they cannot fill in — but in
 * natural English. Where the official German term is the one they will meet on
 * paper, it is kept in brackets instead of being translated away.
 *
 * IMPORTANT for every language added later:
 *   - Copy this file's structure, write a real translation (not machine output),
 *     and register it in `src/i18n/index.ts`.
 *   - A new language must be written by a human who speaks it. Two pieces of text
 *     may NEVER go live machine-translated: the CONSENT text in `intake.consent`
 *     and the LEGAL DISCLAIMER in `footer.disclaimer`. Both carry legal weight.
 */
export const en: Dictionary = {
  // The business name is the same in every language, but it still lives here so
  // that no page or component ever hardcodes it.
  brand: {
    name: "AIE Deutschland",
    mark: "A",
  },
  meta: {
    homeTitle: "AIE Deutschland — stop drowning in paperwork",
    homeDescription:
      "We take care of applications, forms and appointments with German authorities. Tell us where you are stuck.",
    signUpTitle: "Create an account — AIE Deutschland",
    signInTitle: "Sign in — AIE Deutschland",
    intakeTitle: "Describe your request — AIE Deutschland",
    dashboardTitle: "Your overview — AIE Deutschland",
  },
  nav: {
    label: "Navigation",
    how: "How it works",
    services: "What we take care of",
    signIn: "Sign in",
    signUp: "Create an account",
    signOut: "Sign out",
    signingOut: "Signing out …",
    intake: "Describe your request",
    dashboard: "Overview",
    home: "Home",
  },
  lang: {
    label: "Choose language",
    switching: "Switching language …",
  },
  status: {
    // Shown while a page that needs the server is still loading.
    loading: "One moment please — the page is loading.",
  },
  hero: {
    eyebrow: "Help with applications, forms and appointments",
    title: "Stop drowning in",
    titleAccent: "paperwork.",
    lead: "Tell us where you are stuck — we take care of the applications, the forms and the appointments. No waiting on hold, no bureaucratic German.",
    ctaPrimary: "Describe your request",
    ctaSecondary: "Create an account",
  },
  panel: {
    title: "Typical requests",
    intro:
      "You describe your situation in a few sentences. We take care of the rest.",
    chips: [
      "Registering your address",
      "Residence permit",
      "Child benefit",
      "Tax ID",
      "Health insurance",
      "Landlord confirmation",
      "Appointment at the office",
      "Deadline",
    ],
  },
  how: {
    title: "How it works",
    steps: [
      {
        title: "Tell us what is going on",
        body: "Describe your situation in a couple of sentences. For example: registering your address, a residence permit, child benefit or a tax ID.",
      },
      {
        title: "Upload your documents",
        body: "Upload your documents. We check what is still missing.",
      },
      {
        title: "We take it from there",
        body: "We handle the forms, the appointments and the deadlines, and we get back to you as soon as there is news.",
      },
    ],
  },
  services: {
    title: "What we take care of",
    intro: "Everyday matters with German authorities that we take on for you.",
    items: [
      "Registering or changing your address (Anmeldung, Ummeldung)",
      "Applications and forms at public offices",
      "Booking appointments with authorities",
      "Keeping an eye on your deadlines",
      "Housing documents and your landlord confirmation (Wohnungsgeberbestätigung)",
      "Checking your documents and telling you what is missing",
    ],
  },
  newcomers: {
    title: "New to Germany?",
    body: "We help with the first steps: registering your address, your tax ID (Steuer-ID), health insurance and the documents for your residence permit.",
  },
  free: "Currently free of charge — we are still running our pilot.",
  booking: {
    title: "Book an appointment",
    body: "Would you rather talk it through? Book an appointment. You can also send us your request right here.",
    cta: "Book an appointment",
    note: "You can send us your request here, or book an appointment.",
  },
  footer: {
    // LEGAL DISCLAIMER — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    disclaimer:
      "AIE Deutschland is not a law firm and not a government office. We help with applications, forms and appointments, and we do not provide legal advice.",
    pilot: "Pilot",
    // The only contact route we offer. No phone number, no postal address.
    contactLabel: "Email us",
    navLabel: "Footer",
  },
  notFound: {
    title: "This page does not exist.",
    lead: "The address may have changed. You can go back to the home page, or send us your request directly.",
  },
  // The screen a visitor sees when something in the site breaks. Plain language,
  // no error codes and no internals — and the most important thing to say is
  // that their documents are safe.
  error: {
    title: "Something went wrong.",
    lead: "We could not show this page just now. Your details and your documents are safe — nothing has been lost. Please try again in a moment.",
    contactLead: "If it still does not work, please write to us:",
  },
  auth: {
    signUpTitle: "Create an account",
    signUpIntro:
      "An account of your own keeps your documents visible only to you and to us.",
    signInTitle: "Sign in",
    signInIntro: "Sign in to describe your request.",
    name: "Name",
    email: "Email address",
    password: "Password",
    passwordRepeat: "Repeat password",
    submitSignUp: "Create an account",
    submitSignIn: "Sign in",
    sendingSignUp: "Creating your account …",
    sendingSignIn: "Signing in …",
    haveAccount: "Already have an account?",
    noAccount: "No account yet?",
    passwordHint: "At least 8 characters.",
    signedInAs: "Signed in as",
    // There is no email integration yet: we cannot send a reset link, so a
    // forgotten password has to be reset by hand.
    forgot: "Forgot your password? Write to us — we will reset it for you.",
  },
  intake: {
    title: "Describe your request",
    intro:
      "The clearer we understand your situation, the faster we can deal with it.",
    name: "Name",
    email: "Email address",
    city: "City or municipality",
    state: "Federal state",
    stateHint: "As written on your documents.",
    statePick: "Please choose",
    subject: "What is it about?",
    phone: "Phone (optional)",
    message: "Briefly describe your request",
    messageHint: "At least 20 characters.",
    files: "Upload documents (optional)",
    filesHint: "PDF, JPG or PNG. Up to 2 files, max. 2 MB each.",
    filesChosen: "Selected files",
    consentLabel: "Consent",
    // CONSENT TEXT — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    consent:
      "I agree that AIE Deutschland may process my details and documents confidentially in order to handle my request. I can ask for my data to be deleted at any time.",
    /*
     * READING-AID ACKNOWLEDGEMENT — the box that has to be ticked before a
     * document can be sent with a request.
     *
     * A NATIVE SPEAKER MUST CHECK THIS WORDING in any new language before it goes
     * live. It is the line on which someone hands us their papers, so it carries
     * the same weight as the consent text above. Never machine-translate it.
     *
     * WHAT IT MAY SAY — only what is true while the legal question is open: we are
     * a reading and understanding aid, we are not lawyers, we are not an authority,
     * and the person checks every deadline themselves. It must claim no conclusion
     * about German law, must say nothing about whether this help is lawful or
     * unlawful, and must not call our output legal advice.
     *
     * CHANGING THIS WORDING — in this language or any other — means bumping
     * `READING_AID_VERSION` in `src/lib/constants.ts` in the same change.
     */
    readingAidLabel: "Reading and understanding aid",
    readingAid:
      "I understand: AIE Deutschland is a reading and understanding aid. We are not lawyers and not an authority. I check every deadline myself.",
    readingAidHint: "Required as soon as you upload documents.",
    submit: "Send my request",
    sending: "Sending …",
    success:
      "Thank you! We have received your request and we will get back to you as soon as we can.",
    // Shown under the thank-you line, followed by the area of life the request was
    // filed under (see `areas` below).
    filedUnder: "Your request has been filed under this area of life:",
    subjects: {
      anmeldung: "Registering or changing my address",
      aufenthalt_visa: "Residence and visas",
      anerkennung: "Recognising foreign qualifications",
      krankenversicherung: "Health insurance",
      kindergeld: "Child benefit and family",
      steuern: "Taxes and tax ID",
      gewerbe: "Business and self-employment",
      wohnung: "Housing and rental documents",
      termin_frist: "An appointment or a deadline",
      anwalt_gericht: "Lawyer or court",
      sonstiges: "Something else",
    },
    // Official German state names stay untranslated — see the German file.
    states: {},
  },
  // AREAS OF LIFE — the labels for the closed set of areas a request can belong to.
  // The keys are stable internal codes (`src/lib/areas.ts`); these are the words
  // a person reads. Every area code needs a label in every language.
  areas: {
    residence: "Residence and immigration",
    health_insurance: "Health insurance",
    taxes: "Taxes",
    family: "Family and child benefit",
    housing: "Housing and rent",
    work: "Work and self-employment",
    appointments: "Appointments and deadlines",
    legal: "Legal and court",
    other: "Other",
  },
  // THE DASHBOARD — see the German file for the two rules these strings have to
  // keep: both routes labelled unmistakably, and nothing claiming a capability
  // works while it does not.
  dashboard: {
    title: "Your overview",
    lead: "Here you see your requests — sorted by area of life — and what we take off your hands. Every task has two routes: the app with AI, or a person who does it with you.",
    honestyTitle: "What works today — and what does not",
    honesty:
      "No AI is connected yet. The app cannot explain a letter, recognise a deadline or translate anything. The human route does work: you describe your request and we take care of it — during the pilot that is us ourselves.",
    routes: {
      aiLabel: "The app does this with AI",
      aiStatus: "Not available yet",
      humanLabel: "A person does this with you",
      humanStatus: "Available today",
      humanCta: "Describe your request",
    },
    capabilitiesTitle: "What we take on",
    capabilitiesIntro:
      "Seven tasks, each with both routes. The order shows what we are building first.",
    // The key is `cases` in every language (the German file owns the shape).
    // The words a person reads say "request": in English "case" collides with a
    // court case, which is one of the areas of life.
    cases: {
      title: "Your requests",
      intro:
        "Your own requests, sorted by area of life. What belongs to one area is not visible in another.",
      receivedLabel: "Received",
      documentsLabel: "Documents",
      emptyTitle: "You have not described a request to us yet.",
      emptyLead:
        "As soon as you describe one, it appears here — sorted into the area of life it belongs to.",
      emptyCta: "Describe your request",
    },
  },
  /*
   * PILOT SAFEGUARDS — the monthly meter on AI work. See the German file for the
   * four things these words must say exactly: storing and organising documents is
   * unlimited, the limit of {cap} applies only to what the AI does with a letter,
   * that limit caps OUR bill and is never a wall around the person, and nothing is
   * charged to the person. `notConnected` says plainly that nothing is refused
   * today. Keep the `{used}` and `{cap}` placeholders — the page fills them in.
   */
  pilot: {
    capTitle: "Storing documents: unlimited",
    capBody:
      "You can store and organise as many documents as you like — there is no limit on that. The limit of {cap} per person per calendar month applies only to what the AI does with a letter: during the pilot we pay for every document we put to an AI ourselves. It caps our costs and is no barrier for you. You are not charged anything.",
    usage: "{used} of {cap} AI reviews this month",
    notConnected:
      "No AI is connected yet. That is why nothing is refused today: you can store your documents, as many as you like.",
    reachedTitle: "AI reviews are used up for this month",
    reachedBody:
      "We have put as many documents to an AI this month as we can pay for ourselves during the pilot. This limit is ours, not yours: you are not charged anything, and documents you have already stored stay with us. The human route stays open — describe your request without documents and we will take care of it. AI reviews are available again next calendar month.",
    contactCta: "Write to us directly",
  },
  // THE SEVEN CAPABILITIES — one card each, in the business plan's order. See
  // the German file for what `body`, `aiNote` and `humanNote` may and may not say.
  capabilities: {
    understand_letter: {
      title: "Understand a letter",
      body: "An official letter in plain language: who wrote it, what it is about, which deadline applies and what you have to do.",
      aiNote: "The app cannot explain a letter yet — the AI model is not connected.",
      humanNote:
        "Upload the letter with your request. We explain what it means and what you have to do.",
    },
    track_deadlines: {
      title: "Keep track of deadlines",
      body: "The deadlines from your letters collected in one place, so none of them gets lost.",
      aiNote: "The app does not recognise deadlines in letters yet.",
      // No reminder channel exists yet (no e-mail, the calendar comes in the
      // next stage), so this line must not promise to get in touch later.
      humanNote:
        "Tell us the deadline with your request. We tell you what to do so it is not missed.",
    },
    organise_paperwork: {
      title: "Organise your paperwork",
      body: "All the documents for a request in one place — findable later instead of lost in a folder.",
      aiNote: "The app does not sort your documents by itself yet.",
      humanNote:
        "Upload your documents with your request. We check them and tell you what is still missing.",
    },
    find_authority: {
      title: "Find the right office",
      body: "You describe the problem and learn which office or authority is responsible.",
      aiNote: "The app does not suggest an office to you yet.",
      humanNote:
        "Tell us what it is about. We tell you which office you can turn to.",
    },
    manage_appointments: {
      title: "Manage appointments",
      body: "Appointments with authorities and the deadlines from your letters in one place in the app.",
      aiNote:
        "The calendar in the app is not built yet — there are no appointments or reminders here so far.",
      // We cannot book anything on someone's behalf, so this says what we really
      // do: help them get the appointment.
      humanNote:
        "Tell us which appointment you need. We tell you how to get it — and help you along the way.",
    },
    translate_documents: {
      title: "Translate documents",
      body: "German official language into a language you really read.",
      aiNote: "The app does not translate documents yet.",
      humanNote:
        "Tell us which language you need. We explain what the document says — this is not a certified translation.",
    },
    access_support: {
      title: "Find further support",
      body: "Where to get help beyond us — advice centres and places to turn.",
      aiNote: "The app does not show you any advice centres yet.",
      humanNote:
        "Tell us your situation. We look with you for where you can get further support.",
    },
  },
  errors: {
    required: "Please fill in this field.",
    nameRequired: "Please enter your name.",
    emailInvalid: "Please enter a valid email address.",
    passwordShort: "Your password must be at least 8 characters long.",
    passwordMismatch: "The passwords do not match.",
    emailTaken:
      "There is already an account for this email address. Please sign in instead.",
    invalidCredentials: "That email address or password is not right.",
    locked: "Too many failed attempts. Please try again in a few minutes.",
    notSignedIn: "Please sign in first.",
    cityRequired: "Please enter your city or municipality.",
    stateRequired: "Please choose your federal state.",
    subjectInvalid: "Please choose what your request is about.",
    messageShort: "Please describe your request in at least 20 characters.",
    consentRequired: "Please agree to us processing your details.",
    readingAidRequired:
      "Please confirm the reading-aid notice before you send documents.",
    capReached:
      "AI reviews are used up for this month: during the pilot we pay for every document we put to an AI ourselves, so the number per person is limited. You are not charged anything, and the documents you have already stored stay with us. The human route stays open — describe your request without documents and we will take care of it. AI reviews are available again next calendar month.",
    fileType: "Only PDF, JPG and PNG files. Please upload the file again.",
    fileTooLarge: "This file is too large. Max. 2 MB per file.",
    filesTooMany: "Please upload no more than 2 files.",
    filesTooBigAll: "Your files are too large together. Please upload fewer.",
    dbUnavailable:
      "We cannot save your request right now. Please try again in a few minutes.",
    generic: "Something went wrong. Please try again.",
  },
};
