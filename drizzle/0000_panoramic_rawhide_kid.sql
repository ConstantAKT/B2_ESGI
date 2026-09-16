CREATE TABLE "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"team_id" text NOT NULL,
	"turn_number" integer NOT NULL,
	"buy_materials" integer DEFAULT 0 NOT NULL,
	"produce" integer DEFAULT 0 NOT NULL,
	"sell_goods" integer DEFAULT 0 NOT NULL,
	"hire_delta" integer DEFAULT 0 NOT NULL,
	"validated" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"team_id" text,
	"pseudo" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"host_token" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"settings" jsonb NOT NULL,
	"current_turn" integer DEFAULT 0 NOT NULL,
	"turn_started_at" timestamp with time zone,
	"turn_ends_at" timestamp with time zone,
	"paused" boolean DEFAULT false NOT NULL,
	"paused_remaining_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "team_states" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"team_id" text NOT NULL,
	"cash" real NOT NULL,
	"materials" integer NOT NULL,
	"finished_goods" integer NOT NULL,
	"employees" integer NOT NULL,
	"debt" real NOT NULL,
	"active_sanctions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ever_sanctioned" boolean DEFAULT false NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"turn_number" integer NOT NULL,
	"material_buy_price" real NOT NULL,
	"goods_sell_price" real NOT NULL,
	"trend_index" integer NOT NULL,
	"event_id" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"report" jsonb,
	"costliest_decision" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_states" ADD CONSTRAINT "team_states_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_states" ADD CONSTRAINT "team_states_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actions_team_turn_idx" ON "actions" USING btree ("team_id","turn_number");--> statement-breakpoint
CREATE UNIQUE INDEX "team_states_team_id_idx" ON "team_states" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turns_room_turn_idx" ON "turns" USING btree ("room_id","turn_number");