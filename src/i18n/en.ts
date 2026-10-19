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
    siteTitle: "AIE Deutschland",
    homeTitle: "AIE Deutschland — stop drowning in paperwork",
    homeDescription:
      "We take care of applications, forms and appointments with German authorities. Tell us where you are stuck.",
    signUpTitle: "Create an account — AIE Deutschland",
    signInTitle: "Sign in — AIE Deutschland",
    intakeTitle: "Describe your case — AIE Deutschland",
  },
  nav: {
    label: "Navigation",
    how: "How it works",
    services: "What we take care of",
    signIn: "Sign in",
    signUp: "Create an account",
    signOut: "Sign out",
    signingOut: "Signing out …",
    intake: "Describe your case",
    home: "Home",
  },
  lang: {
    label: "Choose language",
    switchTo: "View this page in German",
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
    ctaPrimary: "Describe your case",
    ctaSecondary: "Create an account",
  },
  panel: {
    title: "Typical cases",
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
    intro: "These are the cases we see most often.",
    items: [
      "Registering or changing your address (Anmeldung, Ummeldung)",
      "Applications and forms at public offices",
      "Booking appointments with authorities",
      "Keeping an eye on your deadlines",
      "Housing documents and your landlord confirmation (Wohnungsgeberbestätigung)",
      "Checking your documents and telling you what is missing",
      "Help finding the right lawyer",
    ],
  },
  newcomers: {
    title: "New to Germany?",
    body: "We help with the first steps: registering your address, your tax ID (Steuer-ID), health insurance and the documents for your residence permit.",
  },
  free: "Currently free of charge — we are still running our pilot.",
  booking: {
    title: "Book an appointment",
    body: "Would you rather talk it through? Book an appointment. You can also send us your case right here.",
    cta: "Book an appointment",
    note: "You can send us your case here, or book an appointment.",
  },
  footer: {
    // LEGAL DISCLAIMER — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    disclaimer:
      "AIE Deutschland is not a law firm and not a government office. We help with applications, forms and appointments, and we do not provide legal advice.",
    pilot: "Pilot",
    freeLine: "Currently free of charge.",
    // The only contact route we offer. No phone number, no postal address.
    contactLabel: "Email us",
    navLabel: "Footer",
  },
  notFound: {
    title: "This page does not exist.",
    lead: "The address may have changed. You can go back to the home page, or send us your case directly.",
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
    signInIntro: "Sign in to describe your case.",
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
    existingSession: "You are already signed in.",
    signedInAs: "Signed in as",
    // There is no email integration yet: we cannot send a reset link, so a
    // forgotten password has to be reset by hand.
    forgot: "Forgot your password? Write to us — we will reset it for you.",
    signOutDone: "You are signed out.",
  },
  intake: {
    title: "Describe your case",
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
    message: "Briefly describe your case",
    messageHint: "At least 20 characters.",
    files: "Upload documents (optional)",
    filesHint: "PDF, JPG or PNG. Up to 2 files, max. 2 MB each.",
    filesChosen: "Selected files",
    consentLabel: "Consent",
    // CONSENT TEXT — a native speaker must check this wording in any new
    // language before it goes live. Never machine-translate it.
    consent:
      "I agree that AIE Deutschland may process my details and documents confidentially in order to handle my case. I can ask for my data to be deleted at any time.",
    submit: "Send my case",
    sending: "Sending …",
    success:
      "Thank you! We have received your case and we will get back to you as soon as we can.",
    // Shown under the thank-you line, followed by the area of life the case was
    // filed under (see `areas` below).
    filedUnder: "Your case has been filed under this area of life:",
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
  // AREAS OF LIFE — the labels for the closed set of areas a case can belong to.
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
    subjectInvalid: "Please choose what your case is about.",
    messageShort: "Please describe your case in at least 20 characters.",
    consentRequired: "Please agree to us processing your details.",
    fileType: "Only PDF, JPG and PNG files. Please upload the file again.",
    fileTooLarge: "This file is too large. Max. 2 MB per file.",
    filesTooMany: "Please upload no more than 2 files.",
    filesTooBigAll: "Your files are too large together. Please upload fewer.",
    dbUnavailable:
      "We cannot save your case right now. Please try again in a few minutes.",
    generic: "Something went wrong. Please try again.",
  },
};
