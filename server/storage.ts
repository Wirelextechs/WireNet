import { db } from "./db.js";
import { 
  fastnetOrders, settings, adminUsers, datagodOrders, datagodPackages,
  atOrders, telecelOrders, atPackages, telecelPackages,
  shopUsers, shops, shopPackageConfig, withdrawals,
  type FastnetOrder, type InsertFastnetOrder,
  type DatagodOrder, type InsertDatagodOrder,
  type DatagodPackage, type InsertDatagodPackage,
  type AtOrder, type InsertAtOrder,
  type TelecelOrder, type InsertTelecelOrder,
  type AtPackage, type InsertAtPackage,
  type TelecelPackage, type InsertTelecelPackage,
  type ShopUser, type InsertShopUser,
  type Shop, type InsertShop,
  type ShopPackageConfig, type InsertShopPackageConfig,
  type Withdrawal, type InsertWithdrawal
} from "../shared/db-schema.js";
import { and, desc, eq, sql } from "drizzle-orm";

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
  // Payment gateway settings
  activePaymentGateway?: "paystack" | "moolre"; // Primary payment gateway
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
      activePaymentGateway: (settingsMap["activePaymentGateway"] as "paystack" | "moolre") || "paystack",
      christmasThemeEnabled: settingsMap["christmasThemeEnabled"] === "true",
      purchaseWarningNotice: settingsMap["purchaseWarningNotice"] || "DATA TO WRONG NETWORKS/NUMBERS ARE IRREVERSIBLE",
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
    if (data.activePaymentGateway !== undefined) {
      console.log("💳 Saving activePaymentGateway:", data.activePaymentGateway);
      await this.upsertSetting("activePaymentGateway", data.activePaymentGateway);
    }
    if (data.christmasThemeEnabled !== undefined) {
      console.log("🎄 Saving christmasThemeEnabled:", data.christmasThemeEnabled);
      await this.upsertSetting("christmasThemeEnabled", String(data.christmasThemeEnabled));
    }
    if (data.purchaseWarningNotice !== undefined) {
      await this.upsertSetting("purchaseWarningNotice", data.purchaseWarningNotice);
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
    shopId?: number;
    shopMarkup?: number;
    paymentConfirmed?: boolean;
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
      shopId: data.shopId || null,
      shopMarkup: data.shopMarkup || null,
      paymentConfirmed: data.paymentConfirmed ?? (!!data.paymentReference), // True if Paystack confirmed (has paymentReference)
    }).returning();
    
    const order = result[0];
    
    // Update shop balance immediately when payment is confirmed
    if (order && data.shopId && data.shopMarkup) {
      console.log(`📝 [FastNet] Order created with shopId=${data.shopId}, shopMarkup=${data.shopMarkup}. Now updating balance...`);
      await this.updateShopBalance(data.shopId, data.shopMarkup);
    } else if (order) {
      console.log(`📝 [FastNet] Order created without shop (direct order). shopId=${data.shopId}, shopMarkup=${data.shopMarkup}`);
    }
    
    return order;
  }

  async getFastnetOrders(): Promise<(FastnetOrder & { shopName: string | null })[]> {
    try {
      const results = await db.select({
        id: fastnetOrders.id,
        shortId: fastnetOrders.shortId,
        customerPhone: fastnetOrders.customerPhone,
        packageDetails: fastnetOrders.packageDetails,
        packagePrice: fastnetOrders.packagePrice,
        status: fastnetOrders.status,
        supplierUsed: fastnetOrders.supplierUsed,
        supplierResponse: fastnetOrders.supplierResponse,
        paymentReference: fastnetOrders.paymentReference,
        createdAt: fastnetOrders.createdAt,
        updatedAt: fastnetOrders.updatedAt,
        shopId: fastnetOrders.shopId,
        shopMarkup: fastnetOrders.shopMarkup,
        shopName: shops.shopName,
      })
      .from(fastnetOrders)
      .leftJoin(shops, eq(fastnetOrders.shopId, shops.id))
      .orderBy(desc(fastnetOrders.createdAt));
      
      // Log shop orders for debugging
      const shopOrders = results.filter(r => r.shopId);
      if (shopOrders.length > 0) {
        console.log(`📊 FastNet: Found ${shopOrders.length} shop orders, ${results.length - shopOrders.length} direct orders`);
        shopOrders.slice(0, 3).forEach(o => {
          console.log(`  Order ${o.shortId}: shopId=${o.shopId}, shopName=${o.shopName}`);
        });
      }
      
      return results;
    } catch (error: any) {
      // If shops table doesn't exist, fall back to simple query
      if (error.code === '42P01' || error.code === '42703') {
        console.log("Shops table not found, using simple order query");
        const results = await db.select({
          id: fastnetOrders.id,
          shortId: fastnetOrders.shortId,
          customerPhone: fastnetOrders.customerPhone,
          packageDetails: fastnetOrders.packageDetails,
          packagePrice: fastnetOrders.packagePrice,
          status: fastnetOrders.status,
          paymentReference: fastnetOrders.paymentReference,
          shopId: fastnetOrders.shopId,
          shopMarkup: fastnetOrders.shopMarkup,
          paymentConfirmed: fastnetOrders.paymentConfirmed,
          createdAt: fastnetOrders.createdAt,
          updatedAt: fastnetOrders.updatedAt,
        }).from(fastnetOrders).orderBy(desc(fastnetOrders.createdAt));
        return results.map(r => ({ ...r, shopName: null }));
      }
      throw error;
    }
  }

  async updateFastnetOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string, paymentConfirmed?: boolean): Promise<FastnetOrder | null> {
    const updateData: Partial<InsertFastnetOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;
    if (paymentConfirmed !== undefined) updateData.paymentConfirmed = paymentConfirmed;

    const result = await db.update(fastnetOrders)
      .set(updateData)
      .where(eq(fastnetOrders.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  async getFastnetOrderByShortId(shortId: string): Promise<FastnetOrder | null> {
    const result = await db.select({
      id: fastnetOrders.id,
      shortId: fastnetOrders.shortId,
      customerPhone: fastnetOrders.customerPhone,
      packageDetails: fastnetOrders.packageDetails,
      packagePrice: fastnetOrders.packagePrice,
      status: fastnetOrders.status,
      paymentReference: fastnetOrders.paymentReference,
      shopId: fastnetOrders.shopId,
      shopMarkup: fastnetOrders.shopMarkup,
      paymentConfirmed: fastnetOrders.paymentConfirmed,
      createdAt: fastnetOrders.createdAt,
      updatedAt: fastnetOrders.updatedAt,
    }).from(fastnetOrders).where(eq(fastnetOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] as FastnetOrder : null;
  }

  async getFastnetOrderByPaymentReference(paymentReference: string): Promise<FastnetOrder | null> {
    const result = await db.select({
      id: fastnetOrders.id,
      shortId: fastnetOrders.shortId,
      customerPhone: fastnetOrders.customerPhone,
      packageDetails: fastnetOrders.packageDetails,
      packagePrice: fastnetOrders.packagePrice,
      status: fastnetOrders.status,
      paymentReference: fastnetOrders.paymentReference,
      shopId: fastnetOrders.shopId,
      shopMarkup: fastnetOrders.shopMarkup,
      paymentConfirmed: fastnetOrders.paymentConfirmed,
      createdAt: fastnetOrders.createdAt,
      updatedAt: fastnetOrders.updatedAt,
    }).from(fastnetOrders).where(eq(fastnetOrders.paymentReference, paymentReference)).limit(1);
    return result.length > 0 ? result[0] as FastnetOrder : null;
  }

  // DataGod Orders
  async createDatagodOrder(data: {
    shortId: string;
    customerPhone: string;
    packageName: string;
    packagePrice: number;
    status?: string;
    paymentReference?: string;
    shopId?: number;
    shopMarkup?: number;
    paymentConfirmed?: boolean;
  }): Promise<DatagodOrder> {
    const result = await db.insert(datagodOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageName: data.packageName,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      shopId: data.shopId || null,
      shopMarkup: data.shopMarkup || null,
      paymentConfirmed: data.paymentConfirmed ?? (!!data.paymentReference), // True if Paystack confirmed (has paymentReference)
    }).returning();
    
    const order = result[0];
    
    // Update shop balance immediately when payment is confirmed
    if (order && data.shopId && data.shopMarkup) {
      await this.updateShopBalance(data.shopId, data.shopMarkup);
    }
    
    return order;
  }

  async getDatagodOrders(): Promise<(DatagodOrder & { shopName: string | null })[]> {
    try {
      const results = await db.select({
        id: datagodOrders.id,
        shortId: datagodOrders.shortId,
        customerPhone: datagodOrders.customerPhone,
        packageName: datagodOrders.packageName,
        packagePrice: datagodOrders.packagePrice,
        status: datagodOrders.status,
        paymentReference: datagodOrders.paymentReference,
        createdAt: datagodOrders.createdAt,
        updatedAt: datagodOrders.updatedAt,
        shopId: datagodOrders.shopId,
        shopMarkup: datagodOrders.shopMarkup,
        shopName: shops.shopName,
      })
      .from(datagodOrders)
      .leftJoin(shops, eq(datagodOrders.shopId, shops.id))
      .orderBy(desc(datagodOrders.createdAt));
      
      return results;
    } catch (error: any) {
      // If shops table doesn't exist, fall back to simple query
      if (error.code === '42P01' || error.code === '42703') {
        console.log("Shops table not found, using simple order query");
        const results = await db.select({
          id: datagodOrders.id,
          shortId: datagodOrders.shortId,
          customerPhone: datagodOrders.customerPhone,
          packageName: datagodOrders.packageName,
          packagePrice: datagodOrders.packagePrice,
          status: datagodOrders.status,
          paymentReference: datagodOrders.paymentReference,
          shopId: datagodOrders.shopId,
          shopMarkup: datagodOrders.shopMarkup,
          paymentConfirmed: datagodOrders.paymentConfirmed,
          createdAt: datagodOrders.createdAt,
          updatedAt: datagodOrders.updatedAt,
        }).from(datagodOrders).orderBy(desc(datagodOrders.createdAt));
        return results.map(r => ({ ...r, shopName: null }));
      }
      throw error;
    }
  }

  async updateDatagodOrderStatus(
    id: number, 
    status: string, 
    paymentConfirmed?: boolean,
    supplierData?: {
      supplierUsed?: string;
      supplierReference?: string;
      failureReason?: string;
    }
  ): Promise<DatagodOrder | null> {
    const updateData: { 
      status: string; 
      updatedAt: Date; 
      paymentConfirmed?: boolean;
      supplierUsed?: string;
      supplierReference?: string;
      failureReason?: string;
    } = {
      status,
      updatedAt: new Date(),
    };
    
    if (paymentConfirmed !== undefined) updateData.paymentConfirmed = paymentConfirmed;
    if (supplierData?.supplierUsed !== undefined) updateData.supplierUsed = supplierData.supplierUsed;
    if (supplierData?.supplierReference !== undefined) updateData.supplierReference = supplierData.supplierReference;
    if (supplierData?.failureReason !== undefined) updateData.failureReason = supplierData.failureReason;

    const result = await db.update(datagodOrders)
      .set(updateData)
      .where(eq(datagodOrders.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async getDatagodOrderById(id: number): Promise<DatagodOrder | null> {
    const result = await db.select({
      id: datagodOrders.id,
      shortId: datagodOrders.shortId,
      customerPhone: datagodOrders.customerPhone,
      packageName: datagodOrders.packageName,
      packagePrice: datagodOrders.packagePrice,
      status: datagodOrders.status,
      paymentReference: datagodOrders.paymentReference,
      shopId: datagodOrders.shopId,
      shopMarkup: datagodOrders.shopMarkup,
      paymentConfirmed: datagodOrders.paymentConfirmed,
      createdAt: datagodOrders.createdAt,
      updatedAt: datagodOrders.updatedAt,
    }).from(datagodOrders).where(eq(datagodOrders.id, id)).limit(1);
    return result.length > 0 ? result[0] as DatagodOrder : null;
  }

  async getDatagodOrderByShortId(shortId: string): Promise<DatagodOrder | null> {
    const result = await db.select({
      id: datagodOrders.id,
      shortId: datagodOrders.shortId,
      customerPhone: datagodOrders.customerPhone,
      packageName: datagodOrders.packageName,
      packagePrice: datagodOrders.packagePrice,
      status: datagodOrders.status,
      paymentReference: datagodOrders.paymentReference,
      shopId: datagodOrders.shopId,
      shopMarkup: datagodOrders.shopMarkup,
      paymentConfirmed: datagodOrders.paymentConfirmed,
      createdAt: datagodOrders.createdAt,
      updatedAt: datagodOrders.updatedAt,
    }).from(datagodOrders).where(eq(datagodOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] as DatagodOrder : null;
  }

  async getDatagodOrderByPaymentReference(paymentReference: string): Promise<DatagodOrder | null> {
    const result = await db.select({
      id: datagodOrders.id,
      shortId: datagodOrders.shortId,
      customerPhone: datagodOrders.customerPhone,
      packageName: datagodOrders.packageName,
      packagePrice: datagodOrders.packagePrice,
      status: datagodOrders.status,
      paymentReference: datagodOrders.paymentReference,
      shopId: datagodOrders.shopId,
      shopMarkup: datagodOrders.shopMarkup,
      paymentConfirmed: datagodOrders.paymentConfirmed,
      createdAt: datagodOrders.createdAt,
      updatedAt: datagodOrders.updatedAt,
    }).from(datagodOrders).where(eq(datagodOrders.paymentReference, paymentReference)).limit(1);
    return result.length > 0 ? result[0] as DatagodOrder : null;
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
    shopId?: number;
    shopMarkup?: number;
    paymentConfirmed?: boolean;
  }): Promise<AtOrder> {
    const result = await db.insert(atOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageDetails: data.packageDetails,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      supplierReference: data.supplierReference || null,
      shopId: data.shopId || null,
      shopMarkup: data.shopMarkup || null,
      paymentConfirmed: data.paymentConfirmed ?? (!!data.paymentReference), // True if Paystack confirmed (has paymentReference)
    }).returning();
    
    const order = result[0];
    
    // Update shop balance immediately when payment is confirmed
    if (order && data.shopId && data.shopMarkup) {
      await this.updateShopBalance(data.shopId, data.shopMarkup);
    }
    
    return order;
  }

  async getAtOrders(): Promise<(AtOrder & { shopName: string | null })[]> {
    console.log("🔍 Querying at_orders table...");
    try {
      const results = await db.select({
        id: atOrders.id,
        shortId: atOrders.shortId,
        customerPhone: atOrders.customerPhone,
        packageDetails: atOrders.packageDetails,
        packagePrice: atOrders.packagePrice,
        status: atOrders.status,
        supplierUsed: atOrders.supplierUsed,
        supplierReference: atOrders.supplierReference,
        supplierResponse: atOrders.supplierResponse,
        paymentReference: atOrders.paymentReference,
        createdAt: atOrders.createdAt,
        updatedAt: atOrders.updatedAt,
        shopId: atOrders.shopId,
        shopMarkup: atOrders.shopMarkup,
        shopName: shops.shopName,
      })
      .from(atOrders)
      .leftJoin(shops, eq(atOrders.shopId, shops.id))
      .orderBy(desc(atOrders.createdAt));
      console.log(`🔍 Found ${results.length} AT orders in database`);
      return results;
    } catch (error: any) {
      // If shops table doesn't exist, fall back to simple query
      if (error.code === '42P01' || error.code === '42703') {
        console.log("Shops table not found, using simple AT order query");
        const results = await db.select().from(atOrders).orderBy(desc(atOrders.createdAt));
        return results.map(r => ({ ...r, shopName: null }));
      }
      throw error;
    }
  }

  async getAtOrderById(id: number): Promise<AtOrder | null> {
    const result = await db.select().from(atOrders).where(eq(atOrders.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateAtOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string, supplierReference?: string, paymentConfirmed?: boolean): Promise<AtOrder | null> {
    const updateData: Partial<InsertAtOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;
    if (supplierReference) updateData.supplierReference = supplierReference;
    if (paymentConfirmed !== undefined) updateData.paymentConfirmed = paymentConfirmed;

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
    shopId?: number;
    shopMarkup?: number;
    paymentConfirmed?: boolean;
  }): Promise<TelecelOrder> {
    const result = await db.insert(telecelOrders).values({
      shortId: data.shortId,
      customerPhone: data.customerPhone,
      packageDetails: data.packageDetails,
      packagePrice: data.packagePrice,
      status: data.status || "PAID",
      paymentReference: data.paymentReference || null,
      supplierReference: data.supplierReference || null,
      shopId: data.shopId || null,
      shopMarkup: data.shopMarkup || null,
      paymentConfirmed: data.paymentConfirmed ?? (!!data.paymentReference), // True if Paystack confirmed (has paymentReference)
    }).returning();
    
    const order = result[0];
    
    // Update shop balance immediately when payment is confirmed
    if (order && data.shopId && data.shopMarkup) {
      await this.updateShopBalance(data.shopId, data.shopMarkup);
    }
    
    return order;
  }

  async getTelecelOrders(): Promise<(TelecelOrder & { shopName: string | null })[]> {
    console.log("🔍 Querying telecel_orders table...");
    try {
      const results = await db.select({
        id: telecelOrders.id,
        shortId: telecelOrders.shortId,
        customerPhone: telecelOrders.customerPhone,
        packageDetails: telecelOrders.packageDetails,
        packagePrice: telecelOrders.packagePrice,
        status: telecelOrders.status,
        supplierUsed: telecelOrders.supplierUsed,
        supplierReference: telecelOrders.supplierReference,
        supplierResponse: telecelOrders.supplierResponse,
        paymentReference: telecelOrders.paymentReference,
        createdAt: telecelOrders.createdAt,
        updatedAt: telecelOrders.updatedAt,
        shopId: telecelOrders.shopId,
        shopMarkup: telecelOrders.shopMarkup,
        shopName: shops.shopName,
      })
      .from(telecelOrders)
      .leftJoin(shops, eq(telecelOrders.shopId, shops.id))
      .orderBy(desc(telecelOrders.createdAt));
      console.log(`🔍 Found ${results.length} orders in database`);
      return results;
    } catch (error: any) {
      // If shops table doesn't exist, fall back to simple query
      if (error.code === '42P01' || error.code === '42703') {
        console.log("Shops table not found, using simple Telecel order query");
        const results = await db.select().from(telecelOrders).orderBy(desc(telecelOrders.createdAt));
        return results.map(r => ({ ...r, shopName: null }));
      }
      throw error;
    }
  }

  async getTelecelOrderById(id: number): Promise<TelecelOrder | null> {
    const result = await db.select().from(telecelOrders).where(eq(telecelOrders.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateTelecelOrderStatus(id: number, status: string, supplierUsed?: string, supplierResponse?: string, supplierReference?: string, paymentConfirmed?: boolean): Promise<TelecelOrder | null> {
    const updateData: Partial<InsertTelecelOrder> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    
    if (supplierUsed) updateData.supplierUsed = supplierUsed;
    if (supplierResponse) updateData.supplierResponse = supplierResponse;
    if (supplierReference) updateData.supplierReference = supplierReference;
    if (paymentConfirmed !== undefined) updateData.paymentConfirmed = paymentConfirmed;

    console.log(`🔧 Updating Telecel order ${id} with status ${status}`, updateData);
    
    const result = await db.update(telecelOrders)
      .set(updateData)
      .where(eq(telecelOrders.id, id))
      .returning();
    
    console.log(`✅ Telecel order ${id} updated. Result:`, result);
    return result.length > 0 ? result[0] : null;
  }

  async getTelecelOrderByShortId(shortId: string): Promise<TelecelOrder | null> {
    const result = await db.select().from(telecelOrders).where(eq(telecelOrders.shortId, shortId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  // Get all shop orders from all service tables
  async getShopOrdersByShopId(shopId: number): Promise<any[]> {
    try {
      console.log(`🔍 [Storage] Querying orders for shop ${shopId}...`);
      
      // Use explicit column selection to avoid issues with missing columns in production DB
      // This ensures backward compatibility even if migration hasn't run yet
      const [fastnetOrds, datagodOrds, atOrds, telecelOrds] = await Promise.all([
        db.select({
          id: fastnetOrders.id,
          shortId: fastnetOrders.shortId,
          customerPhone: fastnetOrders.customerPhone,
          packageDetails: fastnetOrders.packageDetails,
          packagePrice: fastnetOrders.packagePrice,
          status: fastnetOrders.status,
          paymentReference: fastnetOrders.paymentReference,
          shopId: fastnetOrders.shopId,
          shopMarkup: fastnetOrders.shopMarkup,
          paymentConfirmed: fastnetOrders.paymentConfirmed,
          createdAt: fastnetOrders.createdAt,
          updatedAt: fastnetOrders.updatedAt,
        }).from(fastnetOrders).where(eq(fastnetOrders.shopId, shopId)),
        db.select({
          id: datagodOrders.id,
          shortId: datagodOrders.shortId,
          customerPhone: datagodOrders.customerPhone,
          packageName: datagodOrders.packageName,
          packagePrice: datagodOrders.packagePrice,
          status: datagodOrders.status,
          paymentReference: datagodOrders.paymentReference,
          shopId: datagodOrders.shopId,
          shopMarkup: datagodOrders.shopMarkup,
          paymentConfirmed: datagodOrders.paymentConfirmed,
          createdAt: datagodOrders.createdAt,
          updatedAt: datagodOrders.updatedAt,
        }).from(datagodOrders).where(eq(datagodOrders.shopId, shopId)),
        db.select().from(atOrders).where(eq(atOrders.shopId, shopId)),
        db.select().from(telecelOrders).where(eq(telecelOrders.shopId, shopId)),
      ]);
      
      console.log(`🔍 [Storage] Query results - FastNet: ${fastnetOrds.length}, DataGod: ${datagodOrds.length}, AT: ${atOrds.length}, Telecel: ${telecelOrds.length}`);
      
      // Combine all orders with service type and sort by created date descending
      const allOrders = [
        ...fastnetOrds.map(o => ({ ...o, serviceType: 'fastnet' })),
        ...datagodOrds.map(o => ({ ...o, serviceType: 'datagod' })),
        ...atOrds.map(o => ({ ...o, serviceType: 'at' })),
        ...telecelOrds.map(o => ({ ...o, serviceType: 'telecel' })),
      ];
      
      const sorted = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log(`🔍 [Storage] Total ${sorted.length} orders for shop ${shopId}`);
      if (sorted.length > 0) {
        console.log(`   Sample order:`, { shortId: sorted[0].shortId, packagePrice: sorted[0].packagePrice, shopMarkup: sorted[0].shopMarkup, serviceType: sorted[0].serviceType });
      }
      
      return sorted;
    } catch (error) {
      console.error("Error fetching shop orders:", error);
      return [];
    }
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

  // ============ SHOP SYSTEM METHODS ============

  // Shop Users
  async createShopUser(data: InsertShopUser): Promise<ShopUser> {
    const result = await db.insert(shopUsers).values(data).returning();
    return result[0];
  }

  async getShopUserByEmail(email: string): Promise<ShopUser | null> {
    const result = await db.select().from(shopUsers).where(eq(shopUsers.email, email.toLowerCase())).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getShopUserById(id: number): Promise<ShopUser | null> {
    const result = await db.select().from(shopUsers).where(eq(shopUsers.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateShopUser(id: number, data: Partial<InsertShopUser>): Promise<ShopUser | null> {
    const result = await db.update(shopUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shopUsers.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  // Shops
  async createShop(data: InsertShop): Promise<Shop> {
    const result = await db.insert(shops).values(data).returning();
    return result[0];
  }

  async getShopById(id: number): Promise<Shop | null> {
    const result = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getShopBySlug(slug: string): Promise<Shop | null> {
    const result = await db.select().from(shops).where(eq(shops.slug, slug.toLowerCase())).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getShopByUserId(userId: number): Promise<Shop | null> {
    const result = await db.select().from(shops).where(eq(shops.userId, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async getAllShops(): Promise<Shop[]> {
    return await db.select().from(shops).orderBy(desc(shops.createdAt));
  }

  async getShopsByStatus(status: string): Promise<Shop[]> {
    return await db.select().from(shops).where(eq(shops.status, status)).orderBy(desc(shops.createdAt));
  }

  async updateShop(id: number, data: Partial<InsertShop>): Promise<Shop | null> {
    const result = await db.update(shops)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shops.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async updateShopBalance(shopId: number, markupAmount: number): Promise<void> {
    try {
      console.log(`💰 [Shop] Updating shop ${shopId} balance with markup: ${markupAmount}`);
      const result = await db.update(shops)
        .set({
          totalEarnings: sql`${shops.totalEarnings} + ${markupAmount}`,
          availableBalance: sql`${shops.availableBalance} + ${markupAmount}`,
          updatedAt: new Date()
        })
        .where(eq(shops.id, shopId))
        .returning();
      
      if (result.length > 0) {
        console.log(`✅ [Shop] Balance updated. New balance: ${result[0].availableBalance}, New earnings: ${result[0].totalEarnings}`);
      }
    } catch (err) {
      console.error(`❌ [Shop] Failed to update shop balance:`, err);
    }
  }

  async deductShopBalance(shopId: number, amount: number): Promise<void> {
    await db.update(shops)
      .set({
        availableBalance: sql`${shops.availableBalance} - ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(shops.id, shopId));
  }

  // Shop Package Config
  async createShopPackageConfig(data: InsertShopPackageConfig): Promise<ShopPackageConfig> {
    const result = await db.insert(shopPackageConfig).values(data).returning();
    return result[0];
  }

  async getShopPackageConfigs(shopId: number): Promise<ShopPackageConfig[]> {
    return await db.select().from(shopPackageConfig).where(eq(shopPackageConfig.shopId, shopId));
  }

  async getShopPackageConfigsByService(shopId: number, serviceType: string): Promise<ShopPackageConfig[]> {
    return await db.select().from(shopPackageConfig)
      .where(and(
        eq(shopPackageConfig.shopId, shopId),
        eq(shopPackageConfig.serviceType, serviceType)
      ));
  }

  async getShopPackageConfig(shopId: number, serviceType: string, packageId: number): Promise<ShopPackageConfig | null> {
    const result = await db.select().from(shopPackageConfig)
      .where(and(
        eq(shopPackageConfig.shopId, shopId),
        eq(shopPackageConfig.serviceType, serviceType),
        eq(shopPackageConfig.packageId, packageId)
      ))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateShopPackageConfig(id: number, data: Partial<InsertShopPackageConfig>): Promise<ShopPackageConfig | null> {
    const result = await db.update(shopPackageConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shopPackageConfig.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  async upsertShopPackageConfig(data: InsertShopPackageConfig): Promise<ShopPackageConfig> {
    const existing = await this.getShopPackageConfig(data.shopId, data.serviceType, data.packageId);
    if (existing) {
      const result = await this.updateShopPackageConfig(existing.id, data);
      return result!;
    }
    return await this.createShopPackageConfig(data);
  }

  async deleteShopPackageConfig(id: number): Promise<boolean> {
    const result = await db.delete(shopPackageConfig).where(eq(shopPackageConfig.id, id)).returning();
    return result.length > 0;
  }

  // Withdrawals
  async createWithdrawal(data: InsertWithdrawal): Promise<Withdrawal> {
    try {
      const result = await db.insert(withdrawals).values(data).returning();
      return result[0];
    } catch (error: any) {
      // If network column doesn't exist yet (column "network" does not exist error), use raw SQL
      if (
        error.message?.includes('column "network"') ||
        error.code === "42703" ||
        error.detail?.includes('"network"')
      ) {
        console.log(
          "⚠️ Network column not found in withdrawals table, using raw SQL insert without it"
        );
        try {
          // Use raw SQL to bypass Drizzle schema which includes the network column
          const result = await db.execute(sql`
            INSERT INTO withdrawals (shop_id, amount, fee, net_amount, bank_name, account_number, account_name, status, created_at, updated_at)
            VALUES (${data.shopId}, ${data.amount}, ${data.fee}, ${data.netAmount}, ${data.bankName}, ${data.accountNumber}, ${data.accountName}, ${data.status || 'pending'}, NOW(), NOW())
            RETURNING *
          `);
          return result.rows[0] as Withdrawal;
        } catch (retryError: any) {
          console.error("❌ Raw SQL insert also failed:", {
            message: retryError.message,
            code: retryError.code,
          });
          throw retryError;
        }
      }
      console.error("❌ Withdrawal creation error:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
      });
      throw error;
    }
  }

  // Create withdrawal with external (Supabase) shop ID
  async createWithdrawalWithExternalId(data: {
    externalShopId: string;
    amount: number;
    fee: number;
    netAmount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    network?: string;
  }): Promise<any> {
    try {
      const result = await db.execute(sql`
        INSERT INTO withdrawals (external_shop_id, amount, fee, net_amount, bank_name, account_number, account_name, network, status, created_at, updated_at)
        VALUES (${data.externalShopId}, ${data.amount}, ${data.fee}, ${data.netAmount}, ${data.bankName}, ${data.accountNumber}, ${data.accountName}, ${data.network || null}, 'pending', NOW(), NOW())
        RETURNING *
      `);
      return result.rows[0];
    } catch (error: any) {
      // If external_shop_id column doesn't exist, fall back to using shop_id as 0
      if (error.code === "42703") {
        console.log("⚠️ external_shop_id column not found, using fallback insert");
        const result = await db.execute(sql`
          INSERT INTO withdrawals (shop_id, amount, fee, net_amount, bank_name, account_number, account_name, network, status, created_at, updated_at)
          VALUES (0, ${data.amount}, ${data.fee}, ${data.netAmount}, ${data.bankName}, ${data.accountNumber}, ${data.accountName}, ${data.network || null}, 'pending', NOW(), NOW())
          RETURNING *
        `);
        return result.rows[0];
      }
      throw error;
    }
  }

  // Get withdrawals by external shop ID (Supabase UUID)
  async getWithdrawalsByExternalShopId(externalShopId: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM withdrawals 
        WHERE external_shop_id = ${externalShopId}
        ORDER BY created_at DESC
      `);
      return result.rows as any[];
    } catch (error: any) {
      // If column doesn't exist, return empty
      if (error.code === "42703") {
        console.log("⚠️ external_shop_id column not found");
        return [];
      }
      throw error;
    }
  }

  async getWithdrawalById(id: number): Promise<any | null> {
    try {
      // Use raw SQL to avoid schema mismatch issues with external_shop_id column
      const result = await db.execute(sql`
        SELECT * FROM withdrawals WHERE id = ${id} LIMIT 1
      `);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error("getWithdrawalById error:", error.message);
      return null;
    }
  }

  async getWithdrawalsByShop(shopId: number): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM withdrawals WHERE shop_id = ${shopId} ORDER BY created_at DESC
      `);
      return result.rows as any[];
    } catch (error: any) {
      console.error("getWithdrawalsByShop error:", error.message);
      return [];
    }
  }

  async getAllWithdrawals(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM withdrawals ORDER BY created_at DESC
      `);
      return result.rows as any[];
    } catch (error: any) {
      console.error("getAllWithdrawals error:", error.message);
      return [];
    }
  }

  async getWithdrawalsByStatus(status: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM withdrawals WHERE status = ${status} ORDER BY created_at DESC
      `);
      return result.rows as any[];
    } catch (error: any) {
      console.error("getWithdrawalsByStatus error:", error.message);
      return [];
    }
  }

  async updateWithdrawal(id: number, data: Partial<InsertWithdrawal & { processedAt?: Date }>): Promise<any | null> {
    try {
      // Use raw SQL to avoid schema mismatch issues
      const result = await db.execute(sql`
        UPDATE withdrawals 
        SET status = ${data.status || 'pending'},
            admin_note = ${data.adminNote || null},
            processed_at = ${data.processedAt ? data.processedAt.toISOString() : null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error("updateWithdrawal error:", error.message);
      return null;
    }
  }

  // Shop Orders - get orders for a specific shop
  async getShopFastnetOrders(shopId: number): Promise<FastnetOrder[]> {
    return await db.select({
      id: fastnetOrders.id,
      shortId: fastnetOrders.shortId,
      customerPhone: fastnetOrders.customerPhone,
      packageDetails: fastnetOrders.packageDetails,
      packagePrice: fastnetOrders.packagePrice,
      status: fastnetOrders.status,
      paymentReference: fastnetOrders.paymentReference,
      shopId: fastnetOrders.shopId,
      shopMarkup: fastnetOrders.shopMarkup,
      paymentConfirmed: fastnetOrders.paymentConfirmed,
      createdAt: fastnetOrders.createdAt,
      updatedAt: fastnetOrders.updatedAt,
    }).from(fastnetOrders)
      .where(eq(fastnetOrders.shopId, shopId))
      .orderBy(desc(fastnetOrders.createdAt)) as unknown as FastnetOrder[];
  }

  async getShopDatagodOrders(shopId: number): Promise<DatagodOrder[]> {
    return await db.select({
      id: datagodOrders.id,
      shortId: datagodOrders.shortId,
      customerPhone: datagodOrders.customerPhone,
      packageName: datagodOrders.packageName,
      packagePrice: datagodOrders.packagePrice,
      status: datagodOrders.status,
      paymentReference: datagodOrders.paymentReference,
      shopId: datagodOrders.shopId,
      shopMarkup: datagodOrders.shopMarkup,
      paymentConfirmed: datagodOrders.paymentConfirmed,
      createdAt: datagodOrders.createdAt,
      updatedAt: datagodOrders.updatedAt,
    }).from(datagodOrders)
      .where(eq(datagodOrders.shopId, shopId))
      .orderBy(desc(datagodOrders.createdAt)) as unknown as DatagodOrder[];
  }

  async getShopAtOrders(shopId: number): Promise<AtOrder[]> {
    return await db.select().from(atOrders)
      .where(eq(atOrders.shopId, shopId))
      .orderBy(desc(atOrders.createdAt));
  }

  async getShopTelecelOrders(shopId: number): Promise<TelecelOrder[]> {
    return await db.select().from(telecelOrders)
      .where(eq(telecelOrders.shopId, shopId))
      .orderBy(desc(telecelOrders.createdAt));
  }

  // Get shop stats
  async getShopStats(shopId: number): Promise<{
    totalOrders: number;
    totalEarnings: number;
    availableBalance: number;
    pendingWithdrawals: number;
  }> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      return { totalOrders: 0, totalEarnings: 0, availableBalance: 0, pendingWithdrawals: 0 };
    }

    const fastnetCount = await db.select({ count: sql<number>`count(*)` })
      .from(fastnetOrders).where(eq(fastnetOrders.shopId, shopId));
    const datagodCount = await db.select({ count: sql<number>`count(*)` })
      .from(datagodOrders).where(eq(datagodOrders.shopId, shopId));
    const atCount = await db.select({ count: sql<number>`count(*)` })
      .from(atOrders).where(eq(atOrders.shopId, shopId));
    const telecelCount = await db.select({ count: sql<number>`count(*)` })
      .from(telecelOrders).where(eq(telecelOrders.shopId, shopId));

    const pendingWithdrawals = await db.select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(withdrawals)
      .where(and(
        eq(withdrawals.shopId, shopId),
        eq(withdrawals.status, "pending")
      ));

    const totalOrders = 
      Number(fastnetCount[0]?.count || 0) + 
      Number(datagodCount[0]?.count || 0) + 
      Number(atCount[0]?.count || 0) + 
      Number(telecelCount[0]?.count || 0);

    return {
      totalOrders,
      totalEarnings: shop.totalEarnings,
      availableBalance: shop.availableBalance,
      pendingWithdrawals: Number(pendingWithdrawals[0]?.sum || 0)
    };
  }

  // Get shop with user info
  async getShopWithUser(shopId: number): Promise<{ shop: Shop; user: ShopUser } | null> {
    const shop = await this.getShopById(shopId);
    if (!shop) return null;
    const user = await this.getShopUserById(shop.userId);
    if (!user) return null;
    return { shop, user };
  }
}

export const storage = new Storage();
