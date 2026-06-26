import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { sessions as sessionsTable, userSettings, users } from "./schema";
import { auth } from "../auth";
import { recomputePersonalBests } from "../records";
import type { PerformanceInput, SessionInput } from "../validation";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CSV parsing ───────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseEnglishDate(raw: string): Date | null {
  const m = raw.trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month == null) return null;
  return new Date(Date.UTC(year, month, day));
}

// ── Discipline column → event mapping ───────────────────────────────────────────
type ColMap = { discipline: PerformanceInput["discipline"]; distance: number | null; event: string | null };
const RUN_COLS: Record<string, number> = {
  "40m": 40, "50m": 50, "60m": 60, "80m": 80, "100m": 100, "120m": 120,
  "150m": 150, "200m": 200, "250m": 250, "300m": 300, "400m": 400,
};
function columnToEvent(col: string): ColMap | null {
  if (RUN_COLS[col] != null) return { discipline: "sprint", distance: RUN_COLS[col], event: null };
  if (col === "2km campestre")
    return { discipline: "long_distance", distance: 2000, event: "campestre" };
  if (col === "alto") return { discipline: "jump", distance: null, event: "alto" };
  if (col === "lungo") return { discipline: "jump", distance: null, event: "lungo" };
  if (col === "giavellotto") return { discipline: "throw", distance: null, event: "giavellotto" };
  return null;
}

const COMPETITION_RE =
  /^(gara|meeting|cds|nazionali|campionat|trofeo|csi |fidal |campestre .* a |.* a [a-z])/i;

function inferType(note: string, hasMeta: boolean): "training" | "competition" {
  if (hasMeta) return "competition";
  const n = note.trim().toLowerCase();
  if (!n) return "training";
  if (n === "time" || n === "time." || n.startsWith("allenamento")) return "training";
  return COMPETITION_RE.test(note.trim()) ? "competition" : "training";
}

function cleanNote(raw: string): string | null {
  const n = raw.trim();
  if (!n || n.toLowerCase() === "time" || n.toLowerCase() === "time.") return null;
  return n;
}

function num(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// ── Build session inputs from CSV ───────────────────────────────────────────────
// Prefers the private export (gitignored); falls back to the committed sample so a
// fresh clone still seeds something. Returns [] if neither file exists.
function readSeedCsv(): string | null {
  const dir = join(__dirname, "seed-data");
  for (const name of ["notion-times.csv", "notion-times.sample.csv"]) {
    try {
      return readFileSync(join(dir, name), "utf8");
    } catch {
      // try next
    }
  }
  return null;
}

function buildSessionInputs(): SessionInput[] {
  const csv = readSeedCsv();
  if (!csv) return [];
  const rows = parseCsv(csv);
  const header = rows[0].map((h) => h.trim());
  const out: SessionInput[] = [];

  for (const r of rows.slice(1)) {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => (rec[h] = r[i] ?? ""));

    // Date (supports "a → b" multi-day ranges).
    const dateRaw = rec["date"] ?? "";
    const [startRaw, endRaw] = dateRaw.split(/→|->/).map((s) => s.trim());
    const date = parseEnglishDate(startRaw);
    if (!date) continue; // skip rows without a parseable date (e.g. "test")
    const endDate = endRaw ? parseEnglishDate(endRaw) : null;

    // Performances from discipline columns.
    const performances: PerformanceInput[] = [];
    for (const col of header) {
      const map = columnToEvent(col);
      if (!map) continue;
      const value = num(rec[col]);
      if (value == null) continue;
      performances.push({
        discipline: map.discipline,
        distance: map.distance,
        event: map.event,
        result: value,
        wind: null,
        lane: null,
        position: null,
        heat: null,
      });
    }
    if (performances.length === 0) continue; // no measurable result

    const livello = (rec["livello"]?.trim() || null) as SessionInput["livello"];
    const organizzatore = (rec["organizzatore"]?.trim() || null) as SessionInput["organizzatore"];
    const tipo = (rec["tipo"]?.trim() || null) as SessionInput["tipo"];
    const tempo = (rec["tempo"]?.trim() || null) as SessionInput["tempo"];
    const luogo = rec["luogo"]?.trim() || null;
    const note = cleanNote(rec["note"] ?? "");
    const hasMeta = !!(livello || organizzatore || (luogo && tipo));

    out.push({
      date: date.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      type: inferType(rec["note"] ?? "", hasMeta),
      tempo,
      livello,
      luogo,
      organizzatore,
      tipo,
      note,
      performances,
    });
  }
  return out;
}

// ── Seed runner ───────────────────────────────────────────────────────────────
async function ensureUser(): Promise<string> {
  const email = process.env.SEED_USER_EMAIL ?? "athlete@example.com";
  const name = process.env.SEED_USER_NAME ?? "Athlete";
  const password = process.env.SEED_USER_PASSWORD ?? "changeme";

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing.id;

  await auth.api.signUpEmail({ body: { email, name, password } });
  const [created] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!created) throw new Error("Failed to create seed user");
  return created.id;
}

async function main() {
  const userId = await ensureUser();

  const existingSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .limit(1);
  if (existingSessions.length > 0) {
    console.log("Sessions already present — skipping data seed (idempotent).");
  } else {
    const inputs = buildSessionInputs();
    console.log(`Seeding ${inputs.length} sessions…`);
    // Insert with PB recompute deferred, then recompute once at the end.
    const { createSession } = await import("../services");
    let n = 0;
    for (const input of inputs) {
      await createSession(userId, input, { recompute: false });
      n++;
    }
    console.log(`Inserted ${n} sessions.`);
    await recomputePersonalBests(userId);
  }

  // Settings + optional FIDAL url (only from env; no personal default committed).
  const fidalUrl = process.env.FIDAL_ATHLETE_URL ?? null;
  await db
    .insert(userSettings)
    .values({ userId, fidalUrl, seasonStartMonth: 10 })
    .onConflictDoUpdate({ target: userSettings.userId, set: { fidalUrl } });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
