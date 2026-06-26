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
  performances: z.array(performanceInputSchema).min(1, {
    message: "Aggiungi almeno una prestazione",
  }),
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
