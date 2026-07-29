import { planFix, type ImportedRow } from "@/lib/db/repair";

/** Rows as the two bugs left them, plus rows that must not be touched. */
const row = (over: Partial<ImportedRow>): ImportedRow => ({
  performanceId: "p",
  userId: "u",
  discipline: "sprint",
  distance: 100,
  event: null,
  result: "11.82",
  note: "FIDAL · 100 piani",
  ...over,
});

const cases: Array<{ what: string; row: ImportedRow; expect: string | null }> = [
  {
    what: "high jump stored in metres",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "1.49", note: "FIDAL · salto in alto" }),
    expect: "jump/-/alto 149",
  },
  {
    what: "long jump: wrong event AND wrong unit",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "5.20", note: "FIDAL · salto in lungo" }),
    expect: "jump/-/lungo 520",
  },
  {
    what: "triple jump filed as high jump",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "11.05", note: "FIDAL · salto triplo" }),
    expect: "jump/-/triplo 1105",
  },
  {
    what: "pole vault filed as high jump",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "3.40", note: "FIDAL · salto con l'asta" }),
    expect: "jump/-/asta 340",
  },
  {
    what: "long jump already corrected by hand",
    row: row({ discipline: "jump", distance: null, event: "lungo", result: "520.00", note: "FIDAL · salto in lungo" }),
    expect: null,
  },
  {
    what: "value fixed by hand, event still wrong",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "520.00", note: "FIDAL · salto in lungo" }),
    expect: "jump/-/lungo 520.00",
  },
  {
    what: "a sprint, untouched",
    row: row({}),
    expect: null,
  },
  {
    what: "a throw — published in metres, stored in metres",
    row: row({ discipline: "throw", distance: null, event: "peso", result: "12.45", note: "FIDAL · getto del peso" }),
    expect: null,
  },
  {
    what: "a session note that isn't a FIDAL specialità",
    row: row({ discipline: "jump", distance: null, event: "alto", result: "1.49", note: "FIDAL · " }),
    expect: null,
  },
];

let failures = 0;
for (const c of cases) {
  const fix = planFix(c.row);
  const got = fix ? fix.after : null;
  const ok = got === c.expect;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${c.what.padEnd(38)} ${fix ? `${fix.before} → ${fix.after}` : "left alone"}` +
      (ok ? "" : `   ← expected ${c.expect}`),
  );
}

// Running it twice must change nothing the second time.
const repaired = cases
  .map((c) => ({ c, fix: planFix(c.row) }))
  .filter(({ fix }) => fix)
  .map(({ c, fix }) => ({
    ...c.row,
    discipline: fix!.set.discipline ?? c.row.discipline,
    distance: fix!.set.distance !== undefined ? fix!.set.distance : c.row.distance,
    event: fix!.set.event !== undefined ? fix!.set.event : c.row.event,
    result: fix!.set.result ?? c.row.result,
  }));
const secondPass = repaired.filter((r) => planFix(r) !== null);
const idempotent = secondPass.length === 0;
if (!idempotent) failures++;
console.log(`\n  ${idempotent ? "ok  " : "FAIL"} idempotent: second pass changes ${secondPass.length} rows`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
