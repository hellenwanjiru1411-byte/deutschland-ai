# Adding a language

Everything the app knows about a language lives in **one registry**:
`src/i18n/index.ts` (`LANGUAGES`). No component, route, server function or test
names a language itself — they all read the registry. Adding a language is
therefore a data change, and it is exactly two edits.

Languages live today: **German and English** (see `LANGUAGES`).

---

## 1. The two steps

**Step 1 — add the dictionary.** Copy the German file and translate every value:

```bash
cd /home/team/shared/site
cp src/i18n/de.ts src/i18n/<code>.ts      # e.g. ar.ts, tr.ts, uk.ts
```

In the copy:

- rename the export (`export const de = {` becomes `export const ar = {`, using
  your code),
- translate **every** string value,
- do not rename, add or remove keys. `src/i18n/de.ts` is the definition of the
  `Dictionary` type, so a missing or misspelled key is a **build error** — a
  half-translated page cannot ship.

**Step 2 — add one registry entry** to `LANGUAGES` in `src/i18n/index.ts`:

```ts
{
  code: "ar",          // the code: the `lang` cookie value, and how code refers to it
  lang: "ar",          // the `lang` attribute (a BCP-47 tag; may be "pt-BR")
  dir: "rtl",          // "ltr" or "rtl"
  label: "ع",          // switcher label, in the language itself
  name: "العربية",      // full name in the language itself (the button's tooltip)
  dictionary: ar,      // the dictionary from step 1
},
```

Also import the new dictionary at the top of that file.

**That is the whole change.** The visible switcher, the language cookie,
`<html lang>`, `<html dir>`, the server-side language resolution and the smoke
test all pick it up, because all of them read this list. Nothing else has to be
touched — if you find yourself editing another file, the registry has a gap and
that gap should be fixed instead (say so in the pull request).

Then:

```bash
bun run build         # a missing key in the new dictionary fails here
bun run smoke         # the new language is checked automatically
```

---

## 2. What a native speaker must check before it goes live

Machine translation is **never acceptable** for two strings: they are the legal
basis on which we process someone's documents, and the person has to genuinely
understand them.

| String | Where it is shown | Rule |
| --- | --- | --- |
| `intake.consent` | the checkbox on the intake form | **Native speaker writes or approves it. Never machine-translated.** |
| `footer.disclaimer` | the legal line in the footer, on every page | **Native speaker writes or approves it. Never machine-translated.** |

Everything else below must be read by a native speaker too — machine translation
is at best a first draft, and every one of these lines is what a worried person
reads at a difficult moment:

- **Error page** (`error.title`, `error.lead`, `error.contactLead`) and the
  **404 page** (`notFound.title`, `notFound.lead`) — calm, plain, and it must
  still say that the person's documents are safe.
- **Form labels and hints**: `auth.*` (`name`, `email`, `password`,
  `passwordRepeat`, `passwordHint`, `submitSignUp`, `submitSignIn`,
  `sendingSignUp`, `sendingSignIn`, `haveAccount`, `noAccount`,
  `signUpTitle`, `signUpIntro`, `signInTitle`, `signInIntro`, `forgot`,
  `existingSession`, `signedInAs`, `signOutDone`) and `intake.*` (`title`,
  `intro`, `name`, `email`, `city`, `state`, `stateHint`, `statePick`, `subject`,
  `phone`, `message`, `messageHint`, `files`, `filesHint`, `filesChosen`,
  `consentLabel`, `submit`, `sending`, `success`) plus the subject list
  `intake.subjects.*`.
- **Every message in `errors.*`** — each one appears next to a field the person
  has just filled in, and has to explain what to do, not just what went wrong.
- **The contact label** `footer.contactLabel` (it is the only contact route the
  site offers — no phone number, no postal address).
- **The area-of-life labels** `areas.*` — these are the words a worried person
  reads to see which area their case was filed under (see
  `docs/areas-of-life.md`). Every area code must have a label in the new language;
  the build fails if one is missing.
- Navigation and language switch: `nav.*`, `lang.*`.
- The marketing pages: `meta.*` (titles and description), `hero.*`, `panel.*`,
  `how.*`, `services.*`, `newcomers.*`, `free`, `booking.*`, `footer.pilot`,
  `footer.freeLine`, `footer.navLabel`, `status.loading`.

Further checks that matter for German authorities' context:

- **Form of address.** German uses the polite *Sie* throughout; the translation
  must use the polite register of that language consistently (French *vous*,
  Turkish *siz*, …), never the informal one.
- **`brand.*` stays as it is** — the business name is the same in every language.
- **`intake.states` is empty on purpose** and stays that way: the 16 federal
  states are official names, and people see them spelled the German way on their
  own documents (`Baden-Württemberg`, not a translated name).
- **Numbers, dates and currency** are not formatted anywhere yet; if that is
  added later it has to follow the language's conventions.

### Sign-off record

Fill this in the pull request that adds the language, and keep the row up to date.
A language without a completed row is not ready to go live.

| Language | Native reviewer | Date | `intake.consent` checked | `footer.disclaimer` checked | Pull request |
| --- | --- | --- | --- | --- | --- |
| de | owner (German) | — | yes | yes | baseline |
| en | — | — | **to check** | **to check** | baseline |
| _(new)_ | | | | | |

> Note: English today is a team-written translation. Before English is treated as
> finished, the consent sentence and the disclaimer need a native-speaker reading
> like any other language (see stage-4 report / lead).

---

## 3. Right-to-left languages (Arabic, Hebrew, Persian, Urdu)

Set `dir: "rtl"` in the registry entry. That is all the switch itself needs:

- `<html>` is rendered with `dir="rtl"` (and `dir="ltr"` otherwise) from the
  registry, so text alignment, list numbering, form field order and the flex
  layouts mirror themselves.
- The layout uses **logical** direction utilities: `ms-`/`me-`/`ps-`/`pe-`,
  `text-start`/`text-end`, and `gap-*`/`justify-*`, which follow the writing
  direction. The one place that needs a physical mirror is deliberate and
  marked: the arrow next to a call to action uses `rtl:-scale-x-100`.
- **If you add CSS, do not use `ml-`/`mr-`/`pl-`/`pr-`, `text-left`/`text-right`,
  `left-*`/`right-*`, `space-x-*`, `border-l`/`border-r` or `rounded-l`/`rounded-r`.**
  Use the logical equivalent (`ms-`, `me-`, `ps-`, `pe-`, `text-start`,
  `text-end`, `gap-*`). A physical utility is a layout bug for every RTL language.
  To look for them:

  ```bash
  grep -rnE "\b(ml|mr|pl|pr|left|right|space-x|divide-x|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-" src
  ```

- Check the mirrors by eye with the language selected: the header (brand on the
  right, switch and account links on the left), the language switcher's own order,
  left/right padding of every box, the hero, the form field order and its labels,
  the footer, and the arrow in the call to action.

---

## 4. Turning a language on, and off

- **On:** the registry entry is the switch. Once it is there, the language appears
  in the switcher, can be stored in the `lang` cookie, and is covered by the smoke
  test. There is deliberately no separate "publish"/"draft" flag: a language in
  the registry is a language people can choose.
- **Default language:** the **first** entry of `LANGUAGES`. A visitor with no
  cookie gets it. To change the default, move the entry — do not add a second
  "default" flag, and do not reorder entries by accident.
- **Off:** remove the registry entry (and, if you want, the dictionary file). Do
  not delete a language file that is still referenced by an entry — the build
  fails, which is the intended safety net.
- **Preparing a language without offering it yet:** keep it on a branch until the
  sign-off row above is complete, then merge. The stage is finished only when the
  smoke test passes **against the public URL** after the lead publishes.

---

## 5. Running the smoke test for a language

```bash
cd /home/team/shared/site
bun run smoke                                        # the live site
SMOKE_BASE_URL=http://localhost:3000 bun run smoke   # the working site
```

`scripts/smoke.mjs` reads the same registry, and for **every** declared language
checks:

- the `<title>` of `/`, `/registrieren` and `/anmelden` against that language's
  `meta.*` strings,
- `<html lang="…">` against the entry's `lang`,
- `<html dir="…">` against the entry's `dir`,
- the 404 page's copy (`notFound.title`).

It also checks the registry itself — unique codes, a declared direction, a present
`lang`/`label`/`name`, a present dictionary — and that `/` with no cookie serves
the default language. It checks the area-of-life model too (every subject maps to
a declared area, every area has a label in every language — see
`docs/areas-of-life.md`). A language added later is therefore tested automatically
and cannot go live unchecked.

To look at a language by hand, use the language switcher (it stores the cookie
`lang=<code>` and reloads), or ask the server directly:

```bash
curl -s -H 'Cookie: lang=tr' http://localhost:3000/ | grep -o '<html[^>]*>'
```

### Verifying the pipeline with a throwaway language

To rehearse the two steps — or to inspect an RTL layout before the real language
is ready — add a temporary entry with an obvious non-user code (for example `zz`,
with `dir: "rtl"` and a dictionary that copies `de`), run `bun run build` and
`bun run smoke`, look at the pages, and then **remove the entry and the file
again**. A throwaway code must never be merged: it would appear in the switcher
for real visitors. (This is exactly how stage 4 proved that one dictionary file
plus one registry entry is all it takes.)
