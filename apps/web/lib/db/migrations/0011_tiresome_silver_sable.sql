ALTER TABLE "performances" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Sessions written before this column keep the order they have been shown in
-- until now (by distance), so nothing reshuffles under anyone on upgrade.
UPDATE "performances" p
SET "sort_order" = s.rn - 1
FROM (
  SELECT "id", row_number() OVER (
    PARTITION BY "session_id" ORDER BY "distance" NULLS LAST, "created_at", "id"
  ) AS rn
  FROM "performances"
) s
WHERE p."id" = s."id";
