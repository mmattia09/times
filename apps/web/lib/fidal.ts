import "server-only";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { mapSpecialitaToEvent, resultUnit, type EventKey } from "@/lib/athletics";
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

/** Hosts the scraper is allowed to talk to. */
const ALLOWED_HOSTS = new Set(["fidal.it", "www.fidal.it"]);

/** Max bytes we'll read from the profile page (it's ~110KB in practice). */
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/**
 * Validate a FIDAL profile URL. The server fetches this URL, so it must be
 * pinned to the real host: a substring check would accept
 * `http://169.254.169.254/?x=fidal.it` or `http://fidal.it.evil.com/` and turn
 * the scraper into an SSRF gadget against the internal network.
 */
export function assertFidalUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("errors.fidalInvalidUrl");
  }
  if (url.protocol !== "https:") throw new Error("errors.fidalHttps");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("errors.fidalHost");
  }
  return url;
}

/** True if the URL is a valid FIDAL profile URL (no throw). */
export function isValidFidalUrl(raw: string): boolean {
  try {
    assertFidalUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch the athlete profile HTML using the prescribed headers. Server-only.
 * Redirects are followed manually so every hop is re-checked against the
 * allow-list (an open redirect on the origin would otherwise escape it).
 */
export async function fetchFidalProfile(url: string): Promise<string> {
  let current = assertFidalUrl(url);

  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, {
      headers: FIDAL_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("FIDAL redirect without a destination.");
      current = assertFidalUrl(new URL(location, current).toString());
      continue;
    }

    if (!res.ok) throw new Error(`FIDAL request failed: ${res.status} ${res.statusText}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new Error("FIDAL response too large.");

    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) throw new Error("FIDAL response too large.");
    return new TextDecoder().decode(body);
  }

  throw new Error("errors.fidalTooManyRedirects");
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

/** True when the mark is written with minutes: "2:05.30" or `2\'05"30`. */
export function hasMinutes(raw: string): boolean {
  return /\d\s*[:'\u2019\u2032]\s*\d/.test(raw);
}

/**
 * Parse a prestazione into seconds (times) or metres (field events).
 *
 * FIDAL is not consistent about separators between meets: the same minute can
 * be written `2:05.30` or `2\'05"30`, and decimals arrive as either a comma or
 * a dot. Normalise the punctuation first, then read it.
 */
export function parsePrestazione(raw: string): number | null {
  const kept = raw.trim().replace(/[^\d:.,"'\u2019\u2032\u2033]/g, "");
  if (!kept) return null;

  // Minutes/hours use ' or :, decimals use " or , or .
  const s = kept
    .replace(/[\u2019\u2032']/g, ":")
    .replace(/[\u2033"]/g, ".")
    .replace(/,/g, ".");

  // h:mm:ss(.cc) — marathons and race walks.
  const hms = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (hms) {
    return parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseFloat(hms[3]);
  }
  // m:ss(.cc) → seconds.
  const ms = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (ms) {
    return parseInt(ms[1], 10) * 60 + parseFloat(ms[2]);
  }

  // Plain number, possibly with a stray separator left over ("12.34.5").
  const parts = s.replace(/:/g, ".").split(".");
  const flat = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : parts.join(".");
  const n = parseFloat(flat);
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

/**
 * FIDAL publishes field results in metres and times in seconds; the app stores
 * jumps in centimetres and the long cross-country events in minutes. Without
 * this a 1,49 high jump is filed as 1.49 cm.
 */
export function toStoredResult(ev: EventKey, parsed: number, raw: string): number {
  switch (resultUnit(ev)) {
    case "cm":
      // Rounded on purpose: 5.2 * 100 is 520.0000000000001 in binary floating point.
      return Math.round(parsed * 100);
    case "min":
      // Only a mark actually written with minutes was parsed into seconds; one
      // written "7.35" is already the minutes the app wants.
      return hasMinutes(raw) ? Number((parsed / 60).toFixed(2)) : parsed;
    default:
      return parsed;
  }
}

/** Convert parsed rows into importable session inputs (one performance each). */
export function toImportItems(rows: FidalRow[]): FidalImportItem[] {
  const items: FidalImportItem[] = [];
  for (const r of rows) {
    if (!r.date || r.result == null) continue;
    const ev = mapSpecialitaToEvent(r.specialita);
    if (!ev) continue;

    const result = toStoredResult(ev, r.result, r.prestazione);
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
            result,
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
