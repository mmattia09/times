import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { de } from "@/lib/i18n/locales/de";
import { en } from "@/lib/i18n/locales/en";
import { es } from "@/lib/i18n/locales/es";
import { it } from "@/lib/i18n/locales/it";

/**
 * Two ways the app can end up speaking the wrong language, neither of which
 * the type system catches.
 *
 * The dictionary shape is typed against Italian, so a *missing* key is already
 * a compile error. What isn't:
 *
 *   1. A string that never goes through t() at all. "raggiunto" sat hardcoded
 *      in the dashboard through a review and four locales, and showed in
 *      Italian to everyone.
 *   2. A translation that drops a placeholder. "{count} sessions" translated
 *      without the {count} type-checks perfectly and renders a sentence with a
 *      number missing from it.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `\n       ${detail}` : ""}`);
};

// ── 1. Placeholders survive translation ─────────────────────────────────────

type Tree = { [k: string]: string | Tree };

function flatten(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(path, v);
    else for (const [ik, iv] of flatten(v, path)) out.set(ik, iv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const source = flatten(it as unknown as Tree);
for (const [name, dict] of [
  ["en", en],
  ["de", de],
  ["es", es],
] as const) {
  const other = flatten(dict as unknown as Tree);
  const drifted: string[] = [];
  for (const [key, value] of source) {
    const mine = other.get(key);
    if (mine === undefined) continue; // the type system covers this
    const a = placeholders(value).join(",");
    const b = placeholders(mine).join(",");
    if (a !== b) drifted.push(`${key}: it has {${a}}, ${name} has {${b}}`);
  }
  check(
    `${name}: every translation keeps its placeholders`,
    drifted.length === 0,
    drifted.slice(0, 6).join("\n       "),
  );
}

// ── 2. No user-visible text written straight into the markup ────────────────

const ROOTS = ["app", "components"];

/**
 * Text that is not language: symbols, numbers, units, abbreviations that are
 * the same everywhere. "PB" and "m/s" read the same in Milan and Munich.
 */
const NOT_LANGUAGE = new Set([
  "pb",
  "sb",
  "times",
  "fidal",
  "csi",
  "api",
  "json",
  "url",
  "id",
  "km",
  "kg",
  "cm",
  "pts",
  "utc",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Words a human would read, ignoring units, symbols and known abbreviations. */
function languageWords(text: string): string[] {
  return text
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length >= 3 && !NOT_LANGUAGE.has(w.toLowerCase()));
}

const offenders: string[] = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      // Text sitting between two tags on one line: >like this</span>. Anything
      // interpolated is inside braces and never matches.
      //
      // A generic looks the same to a regex — `=> Promise<void>` puts
      // "Promise" between a > and a <. Two signals separate them: real markup
      // text is followed by a closing tag, and real prose contains a
      // lowercase word. A type argument has neither.
      for (const m of line.matchAll(/>([^<>{}\n]+)<(\/?)/g)) {
        const text = m[1].trim();
        if (!text) continue;
        const words = languageWords(text);
        if (words.length === 0) continue;
        const closesTag = m[2] === "/";
        const readsLikeProse = words.some((w) => w === w.toLowerCase());
        if (!closesTag && !readsLikeProse) continue;
        offenders.push(`${file}:${i + 1}  "${text.slice(0, 48)}"`);
      }
    });
  }
}

check(
  "no user-visible string is written straight into the markup",
  offenders.length === 0,
  offenders.slice(0, 12).join("\n       ") +
    (offenders.length > 12 ? `\n       …and ${offenders.length - 12} more` : ""),
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
