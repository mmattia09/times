ALTER TABLE "users" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Before this column existed, "the admin" meant the single env-provisioned
-- account. Hand ownership to the oldest admin so provisioning keeps targeting
-- the same row once other users can be granted admin too.
UPDATE "users" SET "is_owner" = true WHERE "id" = (
  SELECT "id" FROM "users" WHERE "is_admin" = true ORDER BY "created_at" ASC LIMIT 1
);
