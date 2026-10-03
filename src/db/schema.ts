import { jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  progressStage: text("progress_stage").notNull().default("idle"),
  progressLog: jsonb("progress_log").$type<string[]>().notNull().default([]),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  analysis: jsonb("analysis").$type<Record<string, unknown> | null>(),
  editPlan: jsonb("edit_plan").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  filePath: text("file_path").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const renders = pgTable("renders", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  resolution: text("resolution").notNull(),
  status: text("status").notNull().default("queued"),
  outputPath: text("output_path"),
  fileSizeMb: numeric("file_size_mb", { precision: 10, scale: 2 }),
  durationSec: numeric("duration_sec", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
