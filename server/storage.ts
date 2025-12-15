import { db } from "./db.js";
import { 
  fastnetOrders, settings, adminUsers, datagodOrders, datagodPackages,
  type FastnetOrder, type InsertFastnetOrder,
  type DatagodOrder, type InsertDatagodOrder,
  type DatagodPackage, type InsertDatagodPackage
} from "../shared/db-schema.js";
import { eq, desc } from "drizzle-orm";

interface Settings {
  id: string;
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
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
}

export const storage = new Storage();
