import "server-only";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { mapSpecialitaToEvent } from "@/lib/athletics";
import type { SessionInput } from "@/lib/validation";

const FIDAL_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://www.google.com/",
  "Sec-GPC": "1",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export type FidalRow = {
  rawDate: string;
  date: Date | null;
  manifestazione: string;
  luogo: string;
  specialita: string;
  prestazione: string;
  result: number | null;
  vento: number | null;
  cat: string;
  tempo: "elettronico" | "manuale" | null;
  tipo: "indoor" | "outdoor";
  position: number | null;
};

export type FidalImportItem = {
  fidalId: string;
  date: Date;
  specialita: string;
  prestazione: string;
  session: SessionInput;
};

/** Fetch the athlete profile HTML using the prescribed headers. Server-only. */
export async function fetchFidalProfile(url: string): Promise<string> {
  const res = await fetch(url, { headers: FIDAL_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`FIDAL request failed: ${res.status} ${res.statusText}`);
  return res.text();
}

/** Parse an Italian dd/mm/yyyy (or dd-mm-yyyy) date string. */
export function parseItalianDate(raw: string): Date | null {
  const m = raw.trim().match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse a prestazione like "12.15", `12"15`, "1:58.4", "5,32" into seconds/meters. */
export function parsePrestazione(raw: string): number | null {
  let s = raw.trim().replace(/[^\d:.,"']/g, "");
  if (!s) return null;
  // mm:ss(.cc) → seconds
  const time = s.match(/^(\d+):(\d+(?:[.,]\d+)?)$/);
  if (time) {
    return parseInt(time[1], 10) * 60 + parseFloat(time[2].replace(",", "."));
  }
  // 12"15 → 12.15
  s = s.replace(/["']/g, ".").replace(",", ".");
  // collapse multiple dots
  const parts = s.split(".");
  if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join("")}`;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseVento(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isNaN(n) ? null : n;
}

/** Stable dedup id from date + specialità + prestazione. */
export function fidalHash(date: Date, specialita: string, prestazione: string): string {
  const key = `${date.toISOString().slice(0, 10)}|${specialita.trim().toLowerCase()}|${prestazione.trim()}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/**
 * Parse the results tables from a FIDAL athlete page.
 *
 * FIDAL renders one `<table class="table">` per specialità, each preceded by an
 * `<h2 class="title-table">` with the event name (e.g. "100 metri", "60 piani").
 * Columns: Anno · Data (dd/mm) · Tipo (abbr I=Indoor) · Cr. (abbr E=Elettrico,
 * M=Manuale) · Cat. · Piazz. · Prestaz. · Vento · Città.
 */
export function parseFidalResults(html: string): FidalRow[] {
  const $ = cheerio.load(html);
  const rows: FidalRow[] = [];

  $("table.table").each((_, table) => {
    const $table = $(table);
    const specialita =
      $table.closest(".table-responsive").prevAll("h2.title-table").first().text().trim() ||
      $table.prevAll("h2.title-table").first().text().trim();

    // Header order from <thead> th cells.
    const headers = $table
      .find("thead th")
      .map((__, c) => $(c).text().trim().toLowerCase())
      .get();
    const col = (needle: string) => headers.findIndex((h) => h.includes(needle));
    const idx = {
      anno: col("anno"),
      data: col("data"),
      tipo: col("tipo"),
      cr: col("cr"),
      piazz: col("piazz"),
      prestaz: col("prestaz"),
      vento: col("vento"),
      citta: col("citt"),
    };

    $table.find("tbody tr, tr").each((__, tr) => {
      const $cells = $(tr).find("td");
      if ($cells.length < 5) return;
      const text = (i: number) => (i >= 0 ? $cells.eq(i).text().trim() : "");
      const abbr = (i: number) =>
        (i >= 0 ? $cells.eq(i).find("abbr").attr("title") : "")?.toLowerCase() ?? "";

      const anno = text(idx.anno);
      const dataDM = text(idx.data); // "10/01"
      const rawDate = anno && dataDM ? `${dataDM}/${anno}` : dataDM;
      const prestazione = text(idx.prestaz);
      if (!prestazione) return;

      const crAbbr = abbr(idx.cr);
      const tipoAbbr = abbr(idx.tipo);
      const piazz = text(idx.piazz).match(/\d+/);

      rows.push({
        rawDate,
        date: parseItalianDate(rawDate),
        manifestazione: specialita,
        luogo: text(idx.citta),
        specialita,
        prestazione,
        result: parsePrestazione(prestazione),
        vento: parseVento(text(idx.vento)),
        cat: "",
        tempo: crAbbr.includes("elettr") ? "elettronico" : crAbbr.includes("manu") ? "manuale" : null,
        tipo: tipoAbbr.includes("indoor") ? "indoor" : "outdoor",
        position: piazz ? parseInt(piazz[0], 10) : null,
      });
    });
  });

  return rows;
}

/** Convert parsed rows into importable session inputs (one performance each). */
export function toImportItems(rows: FidalRow[]): FidalImportItem[] {
  const items: FidalImportItem[] = [];
  for (const r of rows) {
    if (!r.date || r.result == null) continue;
    const ev = mapSpecialitaToEvent(r.specialita);
    if (!ev) continue;

    const fidalId = fidalHash(r.date, r.specialita, r.prestazione);
    items.push({
      fidalId,
      date: r.date,
      specialita: r.specialita,
      prestazione: r.prestazione,
      session: {
        date: r.date.toISOString(),
        endDate: null,
        type: "competition",
        tempo: r.tempo,
        livello: null,
        luogo: r.luogo || null,
        organizzatore: "fidal",
        tipo: r.tipo,
        note: r.specialita ? `FIDAL · ${r.specialita}` : null,
        performances: [
          {
            discipline: ev.discipline,
            distance: ev.distance,
            event: ev.event,
            result: r.result,
            wind: r.vento,
            lane: null,
            position: r.position,
            heat: null,
          },
        ],
      },
    });
  }
  return items;
}
