import { z } from "zod";

export const disciplineSchema = z.enum([
  "sprint",
  "hurdles",
  "middle_distance",
  "long_distance",
  "relay",
  "walk",
  "jump",
  "throw",
  "combined",
  "test",
]);
export const sessionTypeSchema = z.enum(["training", "competition"]);
export const tempoSchema = z.enum(["elettronico", "cronometro", "manuale"]);
export const livelloSchema = z.enum([
  "regionale",
  "provinciale",
  "nazionale",
  "internazionale",
]);
export const organizzatoreSchema = z.enum(["fidal", "csi", "altro"]);
export const tipoSchema = z.enum(["outdoor", "indoor"]);

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());

export const workoutBlockSchema = z.object({
  label: emptyToNull(z.string().max(64)),
  ripetute: z.string().min(1).max(256),
  recupero: emptyToNull(z.string().max(128)),
  pausa: emptyToNull(z.string().max(128)),
  ritmo: emptyToNull(z.string().max(128)),
  note: emptyToNull(z.string().max(512)),
});

export const sessionWorkoutSchema = z.object({
  templateId: emptyToNull(z.string().max(64)),
  name: emptyToNull(z.string().max(128)),
  blocks: z.array(workoutBlockSchema).min(1),
});

export const workoutTemplateInputSchema = z.object({
  name: z.string().min(1, "Nome richiesto").max(128),
  category: emptyToNull(z.string().max(64)),
  description: emptyToNull(z.string().max(1000)),
  blocks: z.array(workoutBlockSchema).min(1, "Aggiungi almeno un blocco"),
});

export const goalInputSchema = z.object({
  discipline: disciplineSchema.default("sprint"),
  distance: emptyToNull(z.coerce.number().int().positive()),
  event: emptyToNull(z.string().max(32)),
  target: z.coerce.number().positive({ message: "Obiettivo richiesto" }),
  note: emptyToNull(z.string().max(256)),
});

export type WorkoutTemplateInput = z.infer<typeof workoutTemplateInputSchema>;
export type GoalInput = z.infer<typeof goalInputSchema>;

export const performanceInputSchema = z.object({
  discipline: disciplineSchema.default("sprint"),
  distance: emptyToNull(z.coerce.number().int().positive()),
  event: emptyToNull(z.string().max(32)),
  result: z.coerce.number().positive({ message: "Risultato richiesto" }),
  wind: emptyToNull(z.coerce.number()),
  lane: emptyToNull(z.coerce.number().int()),
  position: emptyToNull(z.coerce.number().int()),
  heat: emptyToNull(z.string().max(32)),
});

const dateString = z
  .string()
  .min(1, { message: "Data richiesta" })
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Data non valida" });

export const sessionInputSchema = z.object({
  date: dateString,
  endDate: emptyToNull(dateString),
  type: sessionTypeSchema.default("training"),
  tempo: emptyToNull(tempoSchema),
  livello: emptyToNull(livelloSchema),
  luogo: emptyToNull(z.string().max(256)),
  organizzatore: emptyToNull(organizzatoreSchema),
  tipo: emptyToNull(tipoSchema),
  note: emptyToNull(z.string().max(2000)),
  workout: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), sessionWorkoutSchema.nullable())
    .optional(),
  // May be empty: a session can just mark that you trained (or a multi-day
  // competition you attended) without any measured result.
  performances: z.array(performanceInputSchema).default([]),
});

/** Shared rule: an end date can't precede the start date. */
function endsAfterStart(s: { date: string; endDate?: string | null }): boolean {
  return !s.endDate || Date.parse(s.endDate) >= Date.parse(s.date);
}

/** Session schema with the date-order check — use this to validate input. */
export const sessionInputCheckedSchema = sessionInputSchema.refine(endsAfterStart, {
  message: "La data di fine non può precedere quella di inizio",
  path: ["endDate"],
});

export type SessionInput = z.infer<typeof sessionInputSchema>;
export type PerformanceInput = z.infer<typeof performanceInputSchema>;

export const sessionQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: sessionTypeSchema.optional(),
  distance: z.coerce.number().int().optional(),
  organizzatore: organizzatoreSchema.optional(),
  livello: livelloSchema.optional(),
  tipo: tipoSchema.optional(),
  season: z.string().optional(), // season key, e.g. "estiva-2025"
});

export const apiKeyInputSchema = z.object({
  label: z.string().min(1, "Etichetta richiesta").max(64),
});

export const fidalUrlSchema = z.object({
  fidalUrl: z.string().url("URL non valido").includes("fidal.it", {
    message: "Deve essere un URL fidal.it",
  }),
});
