CREATE INDEX "performances_session_idx" ON "performances" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "performances_user_idx" ON "performances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_date_idx" ON "sessions" USING btree ("user_id","date");