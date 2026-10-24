# Browser intake traps — what actually fools a tester here

Notes for whoever next drives `/anliegen` with `agent-browser` and checks the
result in Postgres. Written from what the team hit, not from theory.

**Provenance, stated plainly:** the traps below are the ones that have actually
cost this team time. The off-screen click trap and the `upload`/DOM trap were
found in the earlier session that produced
`/home/team/shared/skills/browser-flow-verification/SKILL.md`; the session that
wrote this note confirmed the harness behaviour but its own full run did not
complete inside the work budget, so it did **not** add a new end-to-end result.
Treat the list as the harness's known failure modes, not as a fresh proof.

## 1. `upload` reports success, then the DOM input reads 0 files

`agent-browser upload "#files" /path/file.pdf` answers `✓` and the form still
looks empty to a script, because the app reads the files and then deliberately
clears the input:

```js
event.target.value = ""; // src/routes/anliegen.tsx — lets the visitor re-pick
```

So `document.getElementById('files').files.length` is `0` **after a successful
upload**. That is the app working, not a failed upload.

**Check the page, not the input.** The chosen files are rendered from React
state, under the heading "Ausgewählte Dateien":

```bash
agent-browser --session s eval "document.body.innerText.includes('aufenthaltstitel.pdf')"
```

If that is `true`, the file is really in the form and will be sent.

## 2. A click below the fold silently does nothing

`click` dispatches at the element's centre **without scrolling first**, and the
headless viewport here is 1280×577 while the intake submit button sits at
y ≈ 1100. The result is: no click event, no submit, no POST, no console error —
a working form that looks broken.

**Scroll from inside the page as the last step before the click:**

```bash
agent-browser --session s eval "document.querySelector('button[type=submit]').scrollIntoView({block:'center'}); 'scrolled'"
sleep 2
agent-browser --session s click "button[type=submit]"
```

`agent-browser scrollintoview <css>` answers `✓ Done` and does **not** scroll —
do not rely on it.

## 3. `form.requestSubmit()` works where clicking does nothing

When the click is swallowed by the trap above, the same submit can be driven
from the page, and it goes through React's handler:

```bash
agent-browser --session s eval "document.querySelector('form').requestSubmit(); 'submitted'"
```

This is a harness workaround, not a product path: a real person scrolls and taps.

## 4. Other facts worth not rediscovering

- `fill` sets DOM values without firing React's change events; the app's state
  stays empty and the submit fails validation. Use `type`, `select`, `check`,
  `upload`.
- Give the page ~4 s after `open` so React has hydrated before typing.
- Use CSS selectors, not `@ref`s: refs from an earlier snapshot expire.
- Every field is required except the phone number. The town field is `#city`
  (the third text input — the first two are the read-only name and email), the
  state is `#state` (Berlin), the subject is `#subject` (`anmeldung`), the
  message is `#message` and needs at least 20 characters, and **both**
  checkboxes must be ticked: the reading-aid acknowledgement and the consent.
- Confirm the submit really happened: the page text changes to the success
  notice, and `documents`/`requests` in Postgres grow by one.
- The upload gate is server-side (`src/server/uploads.server.ts`): a renamed SVG
  passes the browser's `accept` filter and is still refused, so a refusal in the
  form is a correct result, not a broken test.
