CREATE TABLE "tags" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"url" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"expiration" bigint,
	"title" text,
	"description" text,
	"image" text,
	"apple" text,
	"google" text,
	"cloaking" boolean DEFAULT false,
	"redirect_with_query" boolean DEFAULT false,
	"password" text,
	"unsafe" boolean DEFAULT false,
	"tag_id" varchar(64),
	CONSTRAINT "links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" varchar(64),
	"slug" varchar(128),
	"url" text,
	"ua" text,
	"ip" "inet",
	"referer" text,
	"country" varchar(120),
	"region" text,
	"city" text,
	"timezone" text,
	"language" text,
	"os" text,
	"browser" text,
	"browser_type" text,
	"device" text,
	"device_type" text,
	"latitude" double precision DEFAULT 0,
	"longitude" double precision DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"homepage_mode" varchar(20),
	"redirect_url" varchar(2048),
	"bio_content" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "links" ADD CONSTRAINT "links_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
