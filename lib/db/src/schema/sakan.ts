import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const sakanWorkspaces = pgTable("sakan_workspaces", {
  id: text("id").primaryKey(),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  saved: jsonb("saved").$type<string[]>().notNull().default([]),
  compare: jsonb("compare").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const sakanEnquiries = pgTable("sakan_enquiries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => sakanWorkspaces.id, { onDelete: "cascade" }),
  listingId: text("listing_id").notNull(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("recorded-not-forwarded"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertSakanWorkspaceSchema = createInsertSchema(sakanWorkspaces);
export const insertSakanEnquirySchema = createInsertSchema(sakanEnquiries);
export type SakanWorkspaceRow = typeof sakanWorkspaces.$inferSelect;
export type SakanEnquiryRow = typeof sakanEnquiries.$inferSelect;
