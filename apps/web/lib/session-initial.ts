import { toDateInputValue } from "@/lib/format";
import type { SessionWithPerformances } from "@/lib/db/schema";
import type { PerformanceInput, SessionInput } from "@/lib/validation";

/**
 * What the session form starts from. Looser than SessionInput because a
 * repeated session keeps the event rows but drops the results — the athlete
 * has to type the new marks.
 */
export type SessionFormInitial = Omit<Partial<SessionInput>, "performances"> & {
  performances?: (Omit<PerformanceInput, "result"> & { result?: number })[];
};

/** Map a stored session onto the form, for editing it. */
export function toSessionInitial(session: SessionWithPerformances): SessionFormInitial {
  return {
    date: toDateInputValue(session.date),
    endDate: session.endDate ? toDateInputValue(session.endDate) : null,
    type: session.type,
    tempo: session.tempo,
    livello: session.livello,
    luogo: session.luogo,
    organizzatore: session.organizzatore,
    tipo: session.tipo,
    note: session.note,
    workout: session.workout ?? null,
    performances: session.performances.map((p) => ({
      discipline: p.discipline,
      distance: p.distance,
      event: p.event,
      result: Number(p.result),
      wind: p.wind != null ? Number(p.wind) : null,
      lane: p.lane,
      position: p.position,
      heat: p.heat,
    })),
  };
}

/**
 * Same session, ready to be logged again today: the setup (venue, timing,
 * level, workout) and the list of events carry over, the date resets to today
 * and the results are blank so nothing is copied in by accident.
 */
export function toRepeatInitial(session: SessionWithPerformances): SessionFormInitial {
  const base = toSessionInitial(session);
  return {
    ...base,
    // No date: the form defaults to today as the browser sees it, which is the
    // day the athlete is actually living in.
    date: undefined,
    endDate: null,
    performances: base.performances?.map((p) => ({
      discipline: p.discipline,
      distance: p.distance,
      event: p.event,
      wind: null,
      lane: null,
      position: null,
      heat: null,
    })),
  };
}
