/*
 * Read a student's typed number. Accepts the ways physics students write
 * values: 3.0e8, 3.0E8, 3.0 × 10^8, 3.0x10^-3, 3*10^(−3), 1.5 × 10⁸,
 * −9.81, .5. Thin spaces and digit-group spaces ("299 792 458") are ignored.
 * Commas are NOT accepted (they are ambiguous between 1,000 and 1,5).
 * Returns null when the text isn't a single number.
 *
 * This only converts the student's own input; marking happens in Postgres.
 */

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+",
};

const PLAIN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const TIMES_TEN = /^([+-]?(?:\d+\.?\d*|\.\d+))(?:[x×*·]|\\times)10\^?\(?([+-]?\d+)\)?$/i;

export function parseNumericAnswer(raw: string): number | null {
  if (typeof raw !== "string" || raw.length > 100) return null;
  let s = raw
    .trim()
    .replace(/[−‒–]/g, "-") // unicode minus / dashes
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS[c]).join(""))
    .replace(/[\s   ]+/g, "");
  if (!s) return null;
  s = s.replace(/\^\^/g, "^");

  let value: number;
  if (PLAIN.test(s)) {
    value = Number(s);
  } else {
    const m = s.match(TIMES_TEN);
    if (!m) return null;
    value = Number(`${m[1]}e${m[2]}`);
  }
  return Number.isFinite(value) ? value : null;
}
