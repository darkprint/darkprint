-- T005: the community and account tables — save, ballot, note, note_vote,
-- run_report, api_key — for five tasks that each have `lib/db/schema.ts`
-- Forbidden and so could not add their own.
--
-- Every constraint here is load-bearing rather than decorative. Four consuming
-- tasks have an acceptance criterion only the database can deliver, and a column
-- list held up by caller convention would let all four pass their own tests
-- against a store permitting exactly what they forbid.
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ballot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"bundle_id" uuid NOT NULL,
	"efficacy" smallint,
	"reliability" smallint,
	"transparency" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballot_metric_range" CHECK ("ballot"."efficacy" between 0 and 100 and "ballot"."reliability" between 0 and 100 and "ballot"."transparency" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"target_kind" "target_kind" NOT NULL,
	"target_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "note_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_digest" text NOT NULL,
	"account_id" uuid NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"hardware" text NOT NULL,
	"input_size" integer NOT NULL,
	"harness_version" text NOT NULL,
	"cost_units" numeric NOT NULL,
	"duration_ms" integer NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"target_kind" "target_kind" NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_bundle_id_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_vote" ADD CONSTRAINT "note_vote_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_vote" ADD CONSTRAINT "note_vote_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_report" ADD CONSTRAINT "run_report_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_token_hash_key" ON "api_key" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_key_account_id_idx" ON "api_key" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ballot_account_bundle_key" ON "ballot" USING btree ("account_id","bundle_id");--> statement-breakpoint
CREATE INDEX "note_target_created_idx" ON "note" USING btree ("target_kind","target_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_vote_note_account_key" ON "note_vote" USING btree ("note_id","account_id");--> statement-breakpoint
CREATE INDEX "run_report_release_digest_idx" ON "run_report" USING btree ("release_digest");--> statement-breakpoint
CREATE INDEX "run_report_account_id_idx" ON "run_report" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "save_account_target_key" ON "save" USING btree ("account_id","target_kind","target_id");--> statement-breakpoint

-- T005 AC4, D-05-01 as ruled. The criterion first asked for a foreign key from
-- `run_report` to the release; Postgres refuses one, because `release.digest` carries
-- a non-unique index and the unique constraint that would let it be referenced is
-- closed twice over — AC7 forbids altering `release`, and `bundleDigest({ dot,
-- cardDigests })` reads neither owner nor slug nor version, so an unchanged T110 fork
-- yields a second release at the same digest and uniqueness would make that fork
-- unpublishable.
--
-- What the criterion demands is honoured instead: "a run_report row naming a digest
-- no release holds must fail at the driver". This raises `foreign_key_violation` —
-- SQLSTATE 23503, the code a real foreign key raises — so a consumer branching on the
-- code cannot tell the two apart.
--
-- It fires on INSERT and UPDATE only. Deleting the last release at a digest orphans
-- its reports, where a foreign key would refuse; guarding that needs a trigger on
-- `release`, which AC7 forbids, and it is recorded against T120 — the task that first
-- deletes a release — rather than silently left.
CREATE FUNCTION "run_report_release_exists"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "release" WHERE "digest" = NEW."release_digest") THEN
		RAISE EXCEPTION 'run_report.release_digest names no release'
			USING ERRCODE = 'foreign_key_violation';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "run_report_release_exists_trigger"
	BEFORE INSERT OR UPDATE OF "release_digest" ON "run_report"
	FOR EACH ROW EXECUTE FUNCTION "run_report_release_exists"();--> statement-breakpoint

-- T005 AC7a — the one named exception to "no existing table is altered".
--
-- A reservation with a NULL owner is garbage that can never be claimed or released:
-- under T070's ruled predicate `handle_reservation.account_id = excluded.account_id`,
-- `NULL = NULL` is NULL, so such a row refuses everyone forever. T070 cannot fix it,
-- `lib/db/schema.ts` being Forbidden there, and a runtime guard in `allocateHandle`
-- closes only T070's own door while T050's and every later writer's stay open.
--
-- Note for anyone re-verifying T070: this makes the NULL-owner row unstorable, so the
-- one cell that behaviourally separates its shipped predicate from the null-safe form
-- is now unreachable. That evidence is `read, not measured` from here on. Nothing is
-- wrong — NOT NULL is strictly better than the guard it replaces — and T070's own
-- adversary named this as one of six conditions that would falsify its PASS.
ALTER TABLE "handle_reservation" ALTER COLUMN "account_id" SET NOT NULL;
