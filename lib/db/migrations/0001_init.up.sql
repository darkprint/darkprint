-- Wave 5 (T200, semantic search) needs pgvector; enabling it now means the image never
-- has to be swapped later, per T000's environment contract in backend.md. No column
-- uses it yet, so this is the whole of T000's obligation toward it.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."actor_kind" AS ENUM('owner', 'operator', 'system');--> statement-breakpoint
CREATE TYPE "public"."audit_decision" AS ENUM('allowed', 'denied', 'error');--> statement-breakpoint
CREATE TYPE "public"."target_kind" AS ENUM('blueprint', 'card', 'term');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" text NOT NULL,
	"github_login" text NOT NULL,
	"handle" text,
	"display_name" text,
	"email" text,
	"bio" text,
	"avatar_hue" smallint,
	"validator" boolean DEFAULT false NOT NULL,
	"validator_since" timestamp with time zone,
	"validator_weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"default_visibility" "visibility" DEFAULT 'public' NOT NULL,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_kind" "actor_kind" DEFAULT 'owner' NOT NULL,
	"action" text NOT NULL,
	"target_kind" text,
	"target_id" text,
	"decision" "audit_decision" DEFAULT 'allowed' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"lineage_owner_id" uuid,
	"lineage_slug" text,
	"lineage_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" text NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"body" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handle_reservation" (
	"handle" text PRIMARY KEY NOT NULL,
	"account_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ontology_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ontology_version_id" uuid NOT NULL,
	"term_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ontology_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"dot" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"card_refs" text[] NOT NULL,
	"card_digests" text[] NOT NULL,
	"local_vocabulary" jsonb,
	"autonomy" jsonb,
	"security" jsonb,
	"phase_coverage" jsonb,
	"scored_ontology_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "target_kind" NOT NULL,
	"ref_id" text NOT NULL,
	"star_count" numeric(12, 0) DEFAULT '0' NOT NULL,
	"download_count" numeric(12, 0) DEFAULT '0' NOT NULL,
	"note_count" numeric(12, 0) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_actor_id_account_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle" ADD CONSTRAINT "bundle_owner_id_account_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle" ADD CONSTRAINT "bundle_lineage_owner_id_account_id_fk" FOREIGN KEY ("lineage_owner_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_version" ADD CONSTRAINT "card_version_owner_id_account_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handle_reservation" ADD CONSTRAINT "handle_reservation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_term" ADD CONSTRAINT "ontology_term_ontology_version_id_ontology_version_id_fk" FOREIGN KEY ("ontology_version_id") REFERENCES "public"."ontology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_bundle_id_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_scored_ontology_version_id_ontology_version_id_fk" FOREIGN KEY ("scored_ontology_version_id") REFERENCES "public"."ontology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_github_id_key" ON "account" USING btree ("github_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_handle_key" ON "account" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "audit_actor_id_idx" ON "audit" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "audit_occurred_at_idx" ON "audit" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_owner_slug_key" ON "bundle" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "card_version_id_version_key" ON "card_version" USING btree ("card_id","version");--> statement-breakpoint
CREATE INDEX "card_version_digest_idx" ON "card_version" USING btree ("digest");--> statement-breakpoint
CREATE INDEX "handle_reservation_account_id_idx" ON "handle_reservation" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ontology_term_version_term_key" ON "ontology_term" USING btree ("ontology_version_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ontology_version_version_key" ON "ontology_version" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "release_bundle_version_key" ON "release" USING btree ("bundle_id","version");--> statement-breakpoint
CREATE INDEX "release_digest_idx" ON "release" USING btree ("digest");--> statement-breakpoint
CREATE UNIQUE INDEX "target_kind_ref_id_key" ON "target" USING btree ("kind","ref_id");