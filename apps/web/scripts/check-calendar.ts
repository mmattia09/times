import { daysCovered, monthKey, monthRange, parseMonth } from "@/lib/calendar";

/**
 * The grid itself is react-day-picker's. What's ours is the arithmetic around
 * it — reading the month out of the URL, asking the database for the right
 * range, and working out which days a multi-day meet belongs to.
 */
let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

// Whatever is in the URL, this must produce a month and never throw.
const now = new Date("2026-07-15T00:00:00Z");
check("a month parses", monthKey(parseMonth("2026-02", now)) === "2026-02");
check("no month falls back to today's", monthKey(parseMonth(undefined, now)) === "2026-07");
check("nonsense falls back too", monthKey(parseMonth("banana", now)) === "2026-07");
check("month 13 falls back too", monthKey(parseMonth("2026-13", now)) === "2026-07");
check("month 00 falls back too", monthKey(parseMonth("2026-00", now)) === "2026-07");

// The range handed to the query has to cover the month and stop at the next.
const feb = monthRange(parseMonth("2026-02", now));
check("range starts on the 1st", feb.start.toISOString() === "2026-02-01T00:00:00.000Z");
check("range is half-open at the next month", feb.end.toISOString() === "2026-03-01T00:00:00.000Z");
const dec = monthRange(parseMonth("2026-12", now));
check("December rolls into January", dec.end.toISOString() === "2027-01-01T00:00:00.000Z");

// Multi-day periods, including one crossing a month.
const single = daysCovered(new Date("2026-07-04T00:00:00Z"), null);
check("a one-day session covers one day", single.length === 1 && single[0] === "2026-07-04");
const threeDays = daysCovered(new Date("2026-07-24T00:00:00Z"), new Date("2026-07-26T00:00:00Z"));
check(
  "a three-day meet covers three days",
  threeDays.join(",") === "2026-07-24,2026-07-25,2026-07-26",
  threeDays.join(","),
);
const crossing = daysCovered(new Date("2026-07-30T00:00:00Z"), new Date("2026-08-02T00:00:00Z"));
check("a period crossing the month is complete", crossing.length === 4, crossing.join(","));
const leap = daysCovered(new Date("2024-02-28T00:00:00Z"), new Date("2024-03-01T00:00:00Z"));
check("a period over the leap day includes it", leap.includes("2024-02-29"), leap.join(","));
// An end date before the start would otherwise loop.
const backwards = daysCovered(new Date("2026-07-10T00:00:00Z"), new Date("2026-07-01T00:00:00Z"));
check("a backwards period stops at one day", backwards.length === 1, backwards.join(","));
// And an absurd one is capped rather than spinning.
const absurd = daysCovered(new Date("2026-01-01T00:00:00Z"), new Date("2030-01-01T00:00:00Z"));
check("an absurd period is capped", absurd.length === 60, String(absurd.length));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
