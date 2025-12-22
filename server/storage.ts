import { db } from "./db.js";
import { 
  fastnetOrders, settings, adminUsers, datagodOrders, datagodPackages,
  atOrders, telecelOrders, atPackages, telecelPackages,
  type FastnetOrder, type InsertFastnetOrder,
  type DatagodOrder, type InsertDatagodOrder,
  type DatagodPackage, type InsertDatagodPackage,
  type AtOrder, type InsertAtOrder,
  type TelecelOrder, type InsertTelecelOrder,
  type AtPackage, type InsertAtPackage,
  type TelecelPackage, type InsertTelecelPackage
} from "../shared/db-schema.js";
import { and, desc, eq } from "drizzle-orm";

interface Settings {
  id: string;
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
  atEnabled: boolean;
  telecelEnabled: boolean;
  afaEnabled: boolean;
  afaLink?: string;
  announcementText?: string;
  announcementLink?: string;
  announcementSeverity?: "info" | "success" | "warning" | "error";
  announcementActive?: boolean;
  datagodTransactionCharge?: string;
  fastnetTransactionCharge?: string;
  atTransactionCharge?: string;
  telecelTransactionCharge?: string;
  fastnetActiveSupplier?: string;
  atActiveSupplier?: string;
  telecelActiveSupplier?: string;
  // SMS notification settings
  smsEnabled?: boolean;
  smsNotificationPhones?: string[]; // Array of phone numbers
  createdAt: Date;
  updatedAt: Date;
}

interface AdminUser {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

class Storage {
  async findFastnetOrderByPaymentAndItem(data: {
    paymentReference: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
  }): Promise<FastnetOrder | null> {
    const result = await db
      .select()
      .from(fastnetOrders)
      .where(
        and(
          eq(fastnetOrders.paymentReference, data.paymentReference),
          eq(fastnetOrders.customerPhone, data.customerPhone),
          eq(fastnetOrders.packageDetails, data.packageDetails),
          eq(fastnetOrders.packagePrice, data.packagePrice)
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async findAtOrderByPaymentAndItem(data: {
    paymentReference: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
  }): Promise<AtOrder | null> {
    const result = await db
      .select()
      .from(atOrders)
      .where(
        and(
          eq(atOrders.paymentReference, data.paymentReference),
          eq(atOrders.customerPhone, data.customerPhone),
          eq(atOrders.packageDetails, data.packageDetails),
          eq(atOrders.packagePrice, data.packagePrice)
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async findTelecelOrderByPaymentAndItem(data: {
    paymentReference: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
  }): Promise<TelecelOrder | null> {
    const result = await db
      .select()
      .from(telecelOrders)
      .where(
        and(
          eq(telecelOrders.paymentReference, data.paymentReference),
          eq(telecelOrders.customerPhone, data.customerPhone),
          eq(telecelOrders.packageDetails, data.packageDetails),
          eq(telecelOrders.packagePrice, data.packagePrice)
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async findDatagodOrderByPaymentAndItem(data: {
    paymentReference: string;
    customerPhone: string;
    packageName: string;
    packagePrice: number;
  }): Promise<DatagodOrder | null> {
    const result = await db
      .select()
      .from(datagodOrders)
      .where(
        and(
          eq(datagodOrders.paymentReference, data.paymentReference),
          eq(datagodOrders.customerPhone, data.customerPhone),
          eq(datagodOrders.packageName, data.packageName),
          eq(datagodOrders.packagePrice, data.packagePrice)
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }
  async getSettings(): Promise<Settings | null> {
    const allSettings = await db.select().from(settings);
    
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value;
    }

    return {
      id: "default",
      whatsappLink: settingsMap["whatsappLink"] || "",
      datagodEnabled: settingsMap["datagodEnabled"] !== "false",
      fastnetEnabled: settingsMap["fastnetEnabled"] !== "false",
      atEnabled: settingsMap["atEnabled"] !== "false",
      telecelEnabled: settingsMap["telecelEnabled"] !== "false",
      afaEnabled: settingsMap["afaEnabled"] !== "false",
      afaLink: settingsMap["afaLink"] || "",
      announcementText: settingsMap["announcementText"] || "",
      announcementLink: settingsMap["announcementLink"] || "",
      announcementSeverity: (settingsMap["announcementSeverity"] as Settings["announcementSeverity"]) || "info",
      announcementActive: settingsMap["announcementActive"] === "true",
      datagodTransactionCharge: settingsMap["datagodTransactionCharge"] || "1.3",
      fastnetTransactionCharge: settingsMap["fastnetTransactionCharge"] || "1.3",
      atTransactionCharge: settingsMap["atTransactionCharge"] || "1.3",
      telecelTransactionCharge: settingsMap["telecelTransactionCharge"] || "1.3",
      fastnetActiveSupplier: settingsMap["fastnetActiveSupplier"] || "dataxpress",
      atActiveSupplier: settingsMap["atActiveSupplier"] || "codecraft",
      telecelActiveSupplier: settingsMap["telecelActiveSupplier"] || "codecraft",
      smsEnabled: settingsMap["smsEnabled"] === "true",
      smsNotificationPhones: (() => {
        try {
          return settingsMap["smsNotificationPhones"] ? JSON.parse(settingsMap["smsNotificationPhones"]) : [];
        } catch (e) {
          console.error("Error parsing smsNotificationPhones:", e);
          return [];
        }
      })(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    if (data.whatsappLink !== undefined) {
      await this.upsertSetting("whatsappLink", data.whatsappLink);
    }
    if (data.datagodEnabled !== undefined) {
      await this.upsertSetting("datagodEnabled", String(data.datagodEnabled));
    }
    if (data.fastnetEnabled !== undefined) {
      await this.upsertSetting("fastnetEnabled", String(data.fastnetEnabled));
    }
    if (data.atEnabled !== undefined) {
      await this.upsertSetting("atEnabled", String(data.atEnabled));
    }
    if (data.telecelEnabled !== undefined) {
      await this.upsertSetting("telecelEnabled", String(data.telecelEnabled));
    }
    if (data.afaEnabled !== undefined) {
      await this.upsertSetting("afaEnabled", String(data.afaEnabled));
    }
    if (data.afaLink !== undefined) {
      await this.upsertSetting("afaLink", data.afaLink);
    }
    if (data.announcementText !== undefined) {
      await this.upsertSetting("announcementText", data.announcementText);
    }
    if (data.announcementLink !== undefined) {
      await this.upsertSetting("announcementLink", data.announcementLink);
    }
    if (data.announcementSeverity !== undefined) {
      await this.upsertSetting("announcementSeverity", data.announcementSeverity);
    }
    if (data.announcementActive !== undefined) {
      await this.upsertSetting("announcementActive", String(data.announcementActive));
    }
    if (data.datagodTransactionCharge !== undefined) {
      await this.upsertSetting("datagodTransactionCharge", data.datagodTransactionCharge);
    }
    if (data.fastnetTransactionCharge !== undefined) {
      await this.upsertSetting("fastnetTransactionCharge", data.fastnetTransactionCharge);
    }
    if (data.atTransactionCharge !== undefined) {
      await this.upsertSetting("atTransactionCharge", data.atTransactionCharge);
    }
    if (data.telecelTransactionCharge !== undefined) {
      await this.upsertSetting("telecelTransactionCharge", data.telecelTransactionCharge);
    }
    if (data.fastnetActiveSupplier !== undefined) {
      await this.upsertSetting("fastnetActiveSupplier", data.fastnetActiveSupplier);
    }
    if (data.atActiveSupplier !== undefined) {
      await this.upsertSetting("atActiveSupplier", data.atActiveSupplier);
    }
    if (data.telecelActiveSupplier !== undefined) {
      await this.upsertSetting("telecelActiveSupplier", data.telecelActiveSupplier);
    }
    if (data.smsEnabled !== undefined) {
      await this.upsertSetting("smsEnabled", String(data.smsEnabled));
    }
    if (data.smsNotificationPhones !== undefined) {
      console.log("📱 Saving smsNotificationPhones:", data.smsNotificationPhones);
      await this.upsertSetting("smsNotificationPhones", JSON.stringify(data.smsNotificationPhones));
    }

    return (await this.getSettings())!;
  }

  async getSetting(key: string): Promise<{ key: string; value: string } | null> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (result.length > 0) {
      return { key: result[0].key, value: result[0].value };
    }
    return null;
  }

  async upsertSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing) {
      await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | null> {
    const result = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (result.length > 0) {
      return {
        id: String(result[0].id),
        email: result[0].email,
        password: result[0].password,
        createdAt: result[0].createdAt,
      };
    }
    return null;
  }

  async createAdminUser(email: string, password: string): Promise<AdminUser> {
    const result = await db.insert(adminUsers).values({ email, password }).returning();
    return {
      id: String(result[0].id),
      email: result[0].email,
      password: result[0].password,
      createdAt: result[0].createdAt,
    };
  }

  async createFastnetOrder(data: {
    shortId: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
    status?: string;
    paymentReference?: string;
    supplierUsed?: string;
    supplierResponse?: string;
  }): Promise<FastnetOrder> {
    const result = await db.insert(fastnetOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageDetails: data.packageDetails,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      supplierUsed: data.supplierUsed || null,
      supplierResponse: data.supplierResponse || null,
    }).returning();
    return result[0];
  }

  async getFastnetOrders(): Promise<FastnetOrder[]> {
    return await db.select().from(fastnetOrders).orderBy(desc(fastnetOrders.createdAt));
  }

  async updateFastnetOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string): Promise<FastnetOrder | null> {
    const updateData: Partial<InsertFastnetOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;

    const result = await db.update(fastnetOrders)
      .set(updateData)
      .where(eq(fastnetOrders.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  async getFastnetOrderByShortId(shortId: string): Promise<FastnetOrder | null> {
    const result = await db.select().from(fastnetOrders).where(eq(fastnetOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getFastnetOrderByPaymentReference(paymentReference: string): Promise<FastnetOrder | null> {
    const result = await db.select().from(fastnetOrders).where(eq(fastnetOrders.paymentReference, paymentReference)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  // DataGod Orders
  async createDatagodOrder(data: {
    shortId: string;
    customerPhone: string;
    packageName: string;
    packagePrice: number;
    status?: string;
    paymentReference?: string;
  }): Promise<DatagodOrder> {
    const result = await db.insert(datagodOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageName: data.packageName,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
    }).returning();
    return result[0];
  }

  async getDatagodOrders(): Promise<DatagodOrder[]> {
    return await db.select().from(datagodOrders).orderBy(desc(datagodOrders.createdAt));
  }

  async updateDatagodOrderStatus(id: number, status: string): Promise<DatagodOrder | null> {
    const result = await db.update(datagodOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(datagodOrders.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async getDatagodOrderByShortId(shortId: string): Promise<DatagodOrder | null> {
    const result = await db.select().from(datagodOrders).where(eq(datagodOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getDatagodOrderByPaymentReference(paymentReference: string): Promise<DatagodOrder | null> {
    const result = await db.select().from(datagodOrders).where(eq(datagodOrders.paymentReference, paymentReference)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  // DataGod Packages
  async createDatagodPackage(data: {
    packageName: string;
    dataValueGB: number;
    priceGHS: number;
    isEnabled?: boolean;
  }): Promise<DatagodPackage> {
    const result = await db.insert(datagodPackages).values({
      packageName: data.packageName,
      dataValueGB: data.dataValueGB,
      priceGHS: data.priceGHS,
      isEnabled: data.isEnabled !== false,
    }).returning();
    return result[0];
  }

  async getDatagodPackages(): Promise<DatagodPackage[]> {
    return await db.select().from(datagodPackages).orderBy(datagodPackages.dataValueGB);
  }

  async getEnabledDatagodPackages(): Promise<DatagodPackage[]> {
    return await db.select().from(datagodPackages)
      .where(eq(datagodPackages.isEnabled, true))
      .orderBy(datagodPackages.dataValueGB);
  }

  async updateDatagodPackage(id: number, data: Partial<InsertDatagodPackage>): Promise<DatagodPackage | null> {
    const result = await db.update(datagodPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(datagodPackages.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async deleteDatagodPackage(id: number): Promise<boolean> {
    const result = await db.delete(datagodPackages).where(eq(datagodPackages.id, id)).returning();
    return result.length > 0;
  }

  // AT ISHARE Orders
  async createAtOrder(data: {
    shortId: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
    status?: string;
    paymentReference?: string;
    supplierReference?: string;
  }): Promise<AtOrder> {
    const result = await db.insert(atOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageDetails: data.packageDetails,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      supplierReference: data.supplierReference || null,
    }).returning();
    return result[0];
  }

  async getAtOrders(): Promise<AtOrder[]> {
    console.log("🔍 Querying at_orders table...");
    const orders = await db.select().from(atOrders).orderBy(desc(atOrders.createdAt));
    console.log(`🔍 Found ${orders.length} AT orders in database`);
    return orders;
  }

  async getAtOrderById(id: number): Promise<AtOrder | null> {
    const result = await db.select().from(atOrders).where(eq(atOrders.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateAtOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string, supplierReference?: string): Promise<AtOrder | null> {
    const updateData: Partial<InsertAtOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;
    if (supplierReference) updateData.supplierReference = supplierReference;

    console.log(`🔧 Updating AT order ${id} with status ${status}`, updateData);
    
    const result = await db.update(atOrders)
      .set(updateData)
      .where(eq(atOrders.id, id))
      .returning();
    
    console.log(`✅ AT order ${id} updated. Result:`, result);
    return result.length > 0 ? result[0] : null;
  }

  async getAtOrderByShortId(shortId: string): Promise<AtOrder | null> {
    const result = await db.select().from(atOrders).where(eq(atOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  // TELECEL Orders
  async createTelecelOrder(data: {
    shortId: string;
    customerPhone: string;
    packageDetails: string;
    packagePrice: number;
    status?: string;
    paymentReference?: string;
    supplierReference?: string;
  }): Promise<TelecelOrder> {
    const result = await db.insert(telecelOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageDetails: data.packageDetails,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      supplierReference: data.supplierReference || null,
    }).returning();
    return result[0];
  }

  async getTelecelOrders(): Promise<TelecelOrder[]> {
    console.log("🔍 Querying telecel_orders table...");
    const orders = await db.select().from(telecelOrders).orderBy(desc(telecelOrders.createdAt));
    console.log(`🔍 Found ${orders.length} orders in database`);
    return orders;
  }

  async getTelecelOrderById(id: number): Promise<TelecelOrder | null> {
    const result = await db.select().from(telecelOrders).where(eq(telecelOrders.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateTelecelOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string, supplierReference?: string): Promise<TelecelOrder | null> {
    const updateData: Partial<InsertTelecelOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;
    if (supplierReference) updateData.supplierReference = supplierReference;

    console.log(`🔧 Updating Telecel order ${id} with status ${status}`, updateData);
    
    const result = await db.update(telecelOrders)
      .set(updateData)
      .where(eq(telecelOrders.id, id))
      .returning();
    
    console.log(`✅ Telecel order ${id} updated. Result:`, result);
    return result.length > 0 ? result[0] : null;
    
    return result.length > 0 ? result[0] : null;
  }

  async getTelecelOrderByShortId(shortId: string): Promise<TelecelOrder | null> {
    const result = await db.select().from(telecelOrders).where(eq(telecelOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  // AT Packages
  async createAtPackage(data: InsertAtPackage): Promise<AtPackage> {
    const result = await db.insert(atPackages).values(data).returning();
    return result[0];
  }

  async getAtPackages(): Promise<AtPackage[]> {
    return await db.select().from(atPackages).orderBy(atPackages.createdAt);
  }

  async updateAtPackage(id: number, data: Partial<InsertAtPackage>): Promise<AtPackage | null> {
    const result = await db.update(atPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(atPackages.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async deleteAtPackage(id: number): Promise<boolean> {
    const result = await db.delete(atPackages).where(eq(atPackages.id, id)).returning();
    return result.length > 0;
  }

  // TELECEL Packages
  async createTelecelPackage(data: InsertTelecelPackage): Promise<TelecelPackage> {
    const result = await db.insert(telecelPackages).values(data).returning();
    return result[0];
  }

  async getTelecelPackages(): Promise<TelecelPackage[]> {
    return await db.select().from(telecelPackages).orderBy(telecelPackages.createdAt);
  }

  async updateTelecelPackage(id: number, data: Partial<InsertTelecelPackage>): Promise<TelecelPackage | null> {
    const result = await db.update(telecelPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(telecelPackages.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async deleteTelecelPackage(id: number): Promise<boolean> {
    const result = await db.delete(telecelPackages).where(eq(telecelPackages.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new Storage();
