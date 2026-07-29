import { mapSpecialitaToEvent, formatResult, resultUnit } from "@/lib/athletics";
import { parsePrestazione, parseVento, toStoredResult } from "@/lib/fidal";

/**
 * Every shape a FIDAL prestazione arrives in, through the whole chain:
 * text → parsed number → the unit the app stores → what the app shows.
 */
const cases: Array<{
  specialita: string;
  prestazione: string;
  /** What the app must store. */
  stored: number | null;
  /** What the athlete should then read on the page. */
  shown?: string;
}> = [
  // Sprints — seconds, three separator styles.
  { specialita: "100 piani", prestazione: "11.82", stored: 11.82, shown: "11.82s" },
  { specialita: "100 piani", prestazione: '11"82', stored: 11.82, shown: "11.82s" },
  { specialita: "60 piani", prestazione: "7,65", stored: 7.65, shown: "7.65s" },
  { specialita: "400 piani", prestazione: "54.90", stored: 54.9, shown: "54.90s" },

  // Middle distance — minutes, both separator styles.
  { specialita: "800 piani", prestazione: "2:05.30", stored: 125.3, shown: "2:05.30" },
  { specialita: "800 piani", prestazione: '2\'05"30', stored: 125.3, shown: "2:05.30" },
  { specialita: "1500 piani", prestazione: "4:12.5", stored: 252.5, shown: "4:12.50" },

  // Long distance — hours.
  { specialita: "maratona", prestazione: "2:35:10", stored: 9310, shown: "2:35:10.00" },

  // Jumps — published in metres, stored in centimetres.
  { specialita: "salto in alto", prestazione: "1,49", stored: 149, shown: "149 cm" },
  { specialita: "salto in lungo", prestazione: "5,20", stored: 520, shown: "520 cm" },
  { specialita: "salto in lungo", prestazione: "5.20", stored: 520, shown: "520 cm" },
  { specialita: "salto triplo", prestazione: "11,05", stored: 1105, shown: "1105 cm" },
  { specialita: "salto con l'asta", prestazione: "3,40", stored: 340, shown: "340 cm" },

  // Throws — metres, stored as metres.
  { specialita: "getto del peso", prestazione: "12,45", stored: 12.45, shown: "12.45 m" },
  { specialita: "lancio del giavellotto", prestazione: "38,20", stored: 38.2, shown: "38.20 m" },

  // Combined — points.
  { specialita: "prove multiple", prestazione: "4520", stored: 4520, shown: "4520 pts" },

  // Hurdles and walks keep seconds.
  { specialita: "100 ostacoli", prestazione: "14,55", stored: 14.55, shown: "14.55s" },
  { specialita: "marcia 5000", prestazione: "24:10.0", stored: 1450, shown: "24:10.00" },

  // Not a result: nothing should be imported.
  { specialita: "100 piani", prestazione: "SQ", stored: null },
  { specialita: "salto in lungo", prestazione: "NM", stored: null },
  { specialita: "100 piani", prestazione: "-", stored: null },
];

let failures = 0;
console.log("specialità              prestazione   stored      shown");
console.log("─".repeat(62));

for (const c of cases) {
  const ev = mapSpecialitaToEvent(c.specialita);
  const parsed = parsePrestazione(c.prestazione);
  const stored = ev && parsed != null ? toStoredResult(ev, parsed, c.prestazione) : null;
  const shown = ev && stored != null ? formatResult(stored, ev) : "—";

  const ok = stored === c.stored && (c.shown === undefined || shown === c.shown);
  if (!ok) failures++;

  console.log(
    `${ok ? "ok  " : "FAIL"} ${c.specialita.padEnd(22)} ${c.prestazione.padEnd(12)} ` +
      `${String(stored).padEnd(10)} ${shown}` +
      (ok ? "" : `   ← expected ${c.stored} / ${c.shown ?? "*"}`),
  );
}

// The event a mark is filed under matters as much as its value.
const events: Array<[string, string]> = [
  ["salto in alto", "alto"],
  ["salto in lungo", "lungo"],
  ["salto triplo", "triplo"],
  ["salto con l'asta", "asta"],
  ["salto in lungo da fermo", "lungo_fermo"],
];
console.log();
for (const [specialita, expected] of events) {
  const ev = mapSpecialitaToEvent(specialita);
  const ok = ev?.event === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${specialita.padEnd(26)} → ${ev?.event}`);
}

// Units the app itself declares, so the table above can't drift from the app.
console.log();
for (const [specialita, unit] of [
  ["salto in lungo", "cm"],
  ["getto del peso", "m"],
  ["100 piani", "s"],
  ["prove multiple", "pts"],
] as Array<[string, string]>) {
  const ev = mapSpecialitaToEvent(specialita)!;
  const ok = resultUnit(ev) === unit;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${specialita.padEnd(26)} stored in ${resultUnit(ev)}`);
}

// Wind decides whether a mark counts as a record, so its sign has to survive
// whichever dash the meet used.
console.log();
for (const [raw, expected] of [
  ["+1,5", 1.5],
  ["-0,3", -0.3],
  ["\u22120,3", -0.3],
  ["\u20130,3", -0.3],
  ["0.0", 0],
  ["", null],
  ["n.d.", null],
] as Array<[string, number | null]>) {
  const got = parseVento(raw);
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} wind ${JSON.stringify(raw).padEnd(10)} → ${got}`);
}

// A no-mark is published as 0,00; importing it would beat every real time.
console.log();
for (const raw of ["0,00", "0.00"]) {
  const parsed = parsePrestazione(raw);
  const ok = parsed !== null && parsed <= 0; // toImportItems drops these
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} no-mark ${JSON.stringify(raw)} parses to ${parsed}, dropped on import`);
}

// The event column holds 32 characters and combined events use the whole name.
console.log();
for (const specialita of [
  "prove multiple maschili indoor cadetti",
  "Eptathlon Allievi su pista outdoor",
]) {
  const ev = mapSpecialitaToEvent(specialita);
  const ok = (ev?.event?.length ?? 0) <= 32;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${String(ev?.event?.length).padStart(2)} chars  ${ev?.event}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
