ALTER TABLE "sessions" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_user_client_key" ON "sessions" USING btree ("user_id","client_id");