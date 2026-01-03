import { z } from "zod";

// Category types
export const CategoryType = z.enum(["datagod", "fastnet"]);
export type CategoryType = z.infer<typeof CategoryType>;

// Settings schema
export const settingsSchema = z.object({
  id: z.string().optional(),
  whatsappLink: z.string().url().optional(),
  datagodEnabled: z.boolean().default(true),
  fastnetEnabled: z.boolean().default(true),
  announcementText: z.string().default(""),
  announcementLink: z.string().url().optional(),
  announcementSeverity: z.enum(["info", "success", "warning", "error"]).default("info"),
  announcementActive: z.boolean().default(false),
  purchaseWarningNotice: z.string().default("DATA TO WRONG NETWORKS/NUMBERS ARE IRREVERSIBLE"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

// Admin user schema
export const adminUserSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3),
  password: z.string().min(6),
  createdAt: z.date().optional(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

// Insert schemas
export const insertSettingsSchema = settingsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserSchema = adminUserSchema.omit({
  id: true,
  createdAt: true,
});
