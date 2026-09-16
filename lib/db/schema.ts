import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { RoomSettings, SanctionType, TurnStepReport } from "@/engine/types";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostToken: text("host_token").notNull(),
  status: text("status")
    .$type<"lobby" | "playing" | "transition" | "ended">()
    .notNull()
    .default("lobby"),
  settings: jsonb("settings").$type<RoomSettings>().notNull(),
  currentTurn: integer("current_turn").notNull().default(0),
  turnStartedAt: timestamp("turn_started_at", { withTimezone: true }),
  turnEndsAt: timestamp("turn_ends_at", { withTimezone: true }),
  paused: boolean("paused").notNull().default(false),
  pausedRemainingSeconds: integer("paused_remaining_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
  pseudo: text("pseudo").notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamStates = pgTable(
  "team_states",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    cash: real("cash").notNull(),
    materials: integer("materials").notNull(),
    finishedGoods: integer("finished_goods").notNull(),
    employees: integer("employees").notNull(),
    debt: real("debt").notNull(),
    activeSanctions: jsonb("active_sanctions").$type<SanctionType[]>().notNull().default([]),
    everSanctioned: boolean("ever_sanctioned").notNull().default(false),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("team_states_team_id_idx").on(table.teamId)]
);

export const turns = pgTable(
  "turns",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    turnNumber: integer("turn_number").notNull(),
    materialBuyPrice: real("material_buy_price").notNull(),
    goodsSellPrice: real("goods_sell_price").notNull(),
    trendIndex: integer("trend_index").notNull(),
    eventId: text("event_id").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    report: jsonb("report").$type<TurnStepReport[]>(),
    costliestDecision: jsonb("costliest_decision").$type<
      Record<string, { label: string; amount: number }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("turns_room_turn_idx").on(table.roomId, table.turnNumber)]
);

export const actions = pgTable(
  "actions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    turnNumber: integer("turn_number").notNull(),
    buyMaterials: integer("buy_materials").notNull().default(0),
    produce: integer("produce").notNull().default(0),
    sellGoods: integer("sell_goods").notNull().default(0),
    hireDelta: integer("hire_delta").notNull().default(0),
    validated: boolean("validated").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("actions_team_turn_idx").on(table.teamId, table.turnNumber)]
);
