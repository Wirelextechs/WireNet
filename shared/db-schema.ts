import { pgTable, serial, varchar, integer, timestamp, text, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============ SHOP/RESELLER SYSTEM TABLES ============

// Shop Users (separate from admin_users and Supabase auth users)
export const shopUsers = pgTable("shop_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, suspended
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ShopUser = typeof shopUsers.$inferSelect;
export type InsertShopUser = typeof shopUsers.$inferInsert;

// Shops
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => shopUsers.id),
  shopName: varchar("shop_name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-friendly name
  description: text("description"),
  logo: text("logo"), // URL or base64
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, banned
  totalEarnings: real("total_earnings").notNull().default(0),
  availableBalance: real("available_balance").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Shop = typeof shops.$inferSelect;
export type InsertShop = typeof shops.$inferInsert;

// Shop Package Configuration (markup per package)
export const shopPackageConfig = pgTable("shop_package_config", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  serviceType: varchar("service_type", { length: 20 }).notNull(), // datagod, fastnet, at, telecel
  packageId: integer("package_id").notNull(), // ID from respective package table
  markupAmount: real("markup_amount").notNull().default(0), // Fixed GHS amount added to base price
  isEnabled: boolean("is_enabled").notNull().default(true), // Whether to show this package
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ShopPackageConfig = typeof shopPackageConfig.$inferSelect;
export type InsertShopPackageConfig = typeof shopPackageConfig.$inferInsert;

// Withdrawals
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  amount: real("amount").notNull(), // Requested amount
  fee: real("fee").notNull().default(0), // Withdrawal fee
  netAmount: real("net_amount").notNull(), // Amount after fee (what they receive)
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  network: varchar("network", { length: 50 }), // Mobile money network (MTN, Vodafone, AirtelTigo)
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, completed, rejected
  adminNote: text("admin_note"), // Optional note from admin
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

// ============ ORDER TABLES (with shopId support) ============

export const fastnetOrders = pgTable("fastnet_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageDetails: varchar("package_details", { length: 50 }).notNull(),
  packagePrice: integer("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  supplierUsed: varchar("supplier_used", { length: 50 }),
  supplierResponse: text("supplier_response"),
  shopId: integer("shop_id"), // NULL for direct orders, shop ID for shop orders
  shopMarkup: real("shop_markup"), // Markup amount earned by shop
  paymentConfirmed: boolean("payment_confirmed").notNull().default(false), // Payment confirmed by gateway (Paystack/Moolre P01)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFastnetOrderSchema = createInsertSchema(fastnetOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FastnetOrder = typeof fastnetOrders.$inferSelect;
export type InsertFastnetOrder = typeof fastnetOrders.$inferInsert;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;

// DataGod Tables
export const datagodOrders = pgTable("datagod_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageName: varchar("package_name", { length: 100 }).notNull(),
  packagePrice: real("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  shopId: integer("shop_id"), // NULL for direct orders, shop ID for shop orders
  shopMarkup: real("shop_markup"), // Markup amount earned by shop
  paymentConfirmed: boolean("payment_confirmed").notNull().default(false), // Payment confirmed by gateway (Paystack/Moolre P01)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DatagodOrder = typeof datagodOrders.$inferSelect;
export type InsertDatagodOrder = typeof datagodOrders.$inferInsert;

export const datagodPackages = pgTable("datagod_packages", {
  id: serial("id").primaryKey(),
  packageName: varchar("package_name", { length: 100 }).notNull(),
  dataValueGB: real("data_value_gb").notNull(),
  priceGHS: real("price_ghs").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DatagodPackage = typeof datagodPackages.$inferSelect;
export type InsertDatagodPackage = typeof datagodPackages.$inferInsert;
// AT ISHARE Orders
export const atOrders = pgTable("at_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageDetails: varchar("package_details", { length: 50 }).notNull(),
  packagePrice: integer("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  supplierUsed: varchar("supplier_used", { length: 50 }),
  supplierReference: varchar("supplier_reference", { length: 100 }),
  supplierResponse: text("supplier_response"),
  shopId: integer("shop_id"), // NULL for direct orders, shop ID for shop orders
  shopMarkup: real("shop_markup"), // Markup amount earned by shop
  paymentConfirmed: boolean("payment_confirmed").notNull().default(false), // Payment confirmed by gateway (Paystack/Moolre P01)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAtOrderSchema = createInsertSchema(atOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AtOrder = typeof atOrders.$inferSelect;
export type InsertAtOrder = typeof atOrders.$inferInsert;

// TELECEL Orders
export const telecelOrders = pgTable("telecel_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageDetails: varchar("package_details", { length: 50 }).notNull(),
  packagePrice: integer("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  supplierUsed: varchar("supplier_used", { length: 50 }),
  supplierReference: varchar("supplier_reference", { length: 100 }),
  supplierResponse: text("supplier_response"),
  shopId: integer("shop_id"), // NULL for direct orders, shop ID for shop orders
  shopMarkup: real("shop_markup"), // Markup amount earned by shop
  paymentConfirmed: boolean("payment_confirmed").notNull().default(false), // Payment confirmed by gateway (Paystack/Moolre P01)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTelecelOrderSchema = createInsertSchema(telecelOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TelecelOrder = typeof telecelOrders.$inferSelect;
export type InsertTelecelOrder = typeof telecelOrders.$inferInsert;

// AT ISHARE Packages
export const atPackages = pgTable("at_packages", {
  id: serial("id").primaryKey(),
  dataAmount: varchar("data_amount", { length: 50 }).notNull(),
  price: real("price").notNull(),
  deliveryTime: varchar("delivery_time", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AtPackage = typeof atPackages.$inferSelect;
export type InsertAtPackage = typeof atPackages.$inferInsert;

// TELECEL Packages
export const telecelPackages = pgTable("telecel_packages", {
  id: serial("id").primaryKey(),
  dataAmount: varchar("data_amount", { length: 50 }).notNull(),
  price: real("price").notNull(),
  deliveryTime: varchar("delivery_time", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelecelPackage = typeof telecelPackages.$inferSelect;
export type InsertTelecelPackage = typeof telecelPackages.$inferInsert;