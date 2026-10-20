/**
 * Small helpers for text that comes out of the language files.
 *
 * Kept language-neutral on purpose: the sentence itself lives in `src/i18n/*`, and
 * the only thing done here is putting a number into it. Nothing here decides
 * wording, order or grammar — that is the translator's job, which is why every
 * language file has to keep the same `{placeholders}`.
 */

/**
 * Replace `{name}` placeholders with numbers.
 *
 * Only whole numbers are accepted, and an unknown or malformed placeholder is
 * left exactly as it is rather than rendering `undefined` — a missing number must
 * look wrong to us, never look like a real figure to the person reading it.
 */
export function fillNumbers(
  template: string,
  values: Record<string, number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : whole;
  });
}
