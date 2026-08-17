CREATE TYPE "public"."criticality" AS ENUM('standard', 'critical');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('pending', 'completed', 'overdue', 'missed');--> statement-breakpoint
CREATE TYPE "public"."recurrence_type" AS ENUM('daily', 'weekly', 'weekly_multi', 'biweekly', 'monthly', 'quarterly', 'biannual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('janitor', 'ops_admin', 'super_admin');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"task_occurrence_id" integer,
	"severity" text DEFAULT 'warning' NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"message" text NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_log_id" integer NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_occurrence_id" integer NOT NULL,
	"janitor_id" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"gps_lat" double precision,
	"gps_lng" double precision,
	"status_at_log_time" "occurrence_status" DEFAULT 'pending' NOT NULL,
	"client_log_id" text,
	"synced_offline" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_template_id" integer NOT NULL,
	"facility_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"status" "occurrence_status" DEFAULT 'pending' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"category" text DEFAULT 'soft_service' NOT NULL,
	"recurrence_type" "recurrence_type" NOT NULL,
	"recurrence_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requires_photo" boolean DEFAULT true NOT NULL,
	"instructions" text,
	"criticality" "criticality" DEFAULT 'standard' NOT NULL,
	"assigned_user_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'janitor' NOT NULL,
	"phone" text,
	"email" text,
	"pin_hash" text,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_task_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("task_occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_task_log_id_task_logs_id_fk" FOREIGN KEY ("task_log_id") REFERENCES "public"."task_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("task_occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_janitor_id_users_id_fk" FOREIGN KEY ("janitor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_template_id_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_logs_client_uq" ON "task_logs" USING btree ("client_log_id");--> statement-breakpoint
CREATE INDEX "task_logs_occurrence_idx" ON "task_logs" USING btree ("task_occurrence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_template_due_uq" ON "task_occurrences" USING btree ("task_template_id","due_date");--> statement-breakpoint
CREATE INDEX "occurrence_due_idx" ON "task_occurrences" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "task_templates_facility_idx" ON "task_templates" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");