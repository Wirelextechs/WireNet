import { Express } from "express";
import { createServer, Server } from "http";
import { storage } from "./storage.js";
import { isAuthenticated, isAdmin, login } from "./auth.js";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import crypto from "crypto";
import * as supplierManager from "./supplier-manager.js";
import * as polling from "./polling.js";
import * as codecraft from "./codecraft.js";
import { sendOrderNotification, checkSMSBalance } from "./sms.js";

const PgStore = pgSession(session);

const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Vercel/production environments
  app.set("trust proxy", 1);

  // Version/health helper (useful for verifying deployments)
  app.get("/api/version", (req, res) => {
    res.json({
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      sha:
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_GITHUB_COMMIT_SHA ||
        process.env.GIT_COMMIT_SHA ||
        "unknown",
      time: new Date().toISOString(),
    });
  });

  // Paystack webhook (used to recover/create orders even if client callback fails)
  app.post("/api/paystack/webhook", async (req: any, res) => {
    try {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        console.error("PAYSTACK_SECRET_KEY is not set; cannot verify webhook");
        return res.status(500).send("Webhook not configured");
      }

      const signature = req.headers["x-paystack-signature"] as string | undefined;
      const rawBody: Buffer | undefined = req.rawBody;
      if (!signature || !rawBody) {
        return res.status(400).send("Missing signature or raw body");
      }

      const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
      if (computed !== signature) {
        return res.status(400).send("Invalid signature");
      }

      const event = req.body?.event;
      if (event !== "charge.success") {
        return res.status(200).json({ ok: true, ignored: true, event });
      }

      const reference: string | undefined = req.body?.data?.reference;
      if (!reference) {
        return res.status(200).json({ ok: true, ignored: true, reason: "missing_reference" });
      }

      // Extract payment phone number from Paystack webhook
      // Try multiple locations: metadata.wirenet.items[].phoneNumber (our custom field) first, then customer.phone
      let paymentPhone = "";
      
      const metadata = req.body?.data?.metadata;
      const wirenetMeta = metadata?.wirenet;
      const items: any[] | undefined = wirenetMeta?.items;
      
      // First try to get phone from our custom metadata
      if (Array.isArray(items) && items.length > 0 && items[0].phoneNumber) {
        paymentPhone = String(items[0].phoneNumber || "").trim();
      }
      
      // Fallback to standard Paystack customer phone
      if (!paymentPhone) {
        paymentPhone = String(req.body?.data?.customer?.phone || "").trim();
      }
      
      if (paymentPhone && paymentPhone.length > 0) {
        console.log(`📱 Payment phone from Paystack: ${paymentPhone}`);
        // Store payment phone in settings if it's new (for SMS marketing lists)
        try {
          const existingPhones = await storage.getSetting("paymentPhones");
          const phoneSet = new Set(existingPhones ? JSON.parse(existingPhones.value) : []);
          phoneSet.add(paymentPhone);
          await storage.upsertSetting("paymentPhones", JSON.stringify(Array.from(phoneSet)));
          console.log(`✅ Payment phone saved for SMS marketing: ${paymentPhone}`);
        } catch (phoneError) {
          console.error("Error saving payment phone:", phoneError);
        }
      }

      const service: string | undefined = wirenetMeta?.service;

      if (!service || !Array.isArray(items) || items.length === 0) {
        console.warn("Paystack webhook missing wirenet metadata; cannot recover orders", { reference, service });
        return res.status(200).json({ ok: true, ignored: true, reason: "missing_metadata" });
      }

      let created = 0;

      for (let index = 0; index < items.length; index++) {
        const item = items[index] || {};
        const phoneNumber = String(item.phoneNumber || "");
        const email = item.email ? String(item.email) : undefined;

        if (service === "fastnet") {
          const dataAmount = String(item.dataAmount || "");
          const price = Math.round(Number(item.price)); // Round to nearest integer
          if (!phoneNumber || !dataAmount || !Number.isFinite(price)) continue;

          const existing = await storage.findFastnetOrderByPaymentAndItem({
            paymentReference: reference,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
          });
          if (existing) continue;

          const shortId = `${reference}-${index + 1}`;
          const newOrder = await storage.createFastnetOrder({
            shortId,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
            status: "PROCESSING",
            paymentReference: reference,
          });
          created++;

          // Immediately push to supplier (don't await - process in background)
          (async () => {
            try {
              console.log(`🚀 [WEBHOOK] Immediately pushing FastNet order ${shortId} to supplier...`);
              const result = await supplierManager.purchaseDataBundle(
                phoneNumber,
                dataAmount,
                price,
                shortId,
                undefined, // Use active supplier
                "mtn" // Default network
              );
              
              if (result.success) {
                console.log(`✅ [WEBHOOK] FastNet order ${shortId} pushed successfully to ${result.supplier}`);
                await storage.updateFastnetOrderStatus(newOrder.id, "PROCESSING", result.supplier, result.message);
                // Schedule status check after 10 seconds
                polling.scheduleStatusCheck(newOrder.id, shortId, "fastnet", 10000);
              } else {
                console.log(`❌ [WEBHOOK] FastNet order ${shortId} failed: ${result.message}`);
                await storage.updateFastnetOrderStatus(newOrder.id, "FAILED", result.supplier, result.message);
              }
            } catch (err) {
              console.error(`❌ [WEBHOOK] Error pushing FastNet order ${shortId}:`, err);
              await storage.updateFastnetOrderStatus(newOrder.id, "FAILED", "unknown", String(err));
            }
          })();
        }

        if (service === "at") {
          const dataAmount = String(item.dataAmount || "");
          const price = Math.round(Number(item.price)); // Round to nearest integer
          if (!phoneNumber || !dataAmount || !Number.isFinite(price)) continue;

          const existing = await storage.findAtOrderByPaymentAndItem({
            paymentReference: reference,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
          });
          if (existing) continue;

          const shortId = `${reference}-${index + 1}`;
          const newOrder = await storage.createAtOrder({
            shortId,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
            status: "PROCESSING",
            paymentReference: reference,
          });
          created++;

          // Immediately push to CodeCraft (AT orders ALWAYS use CodeCraft)
          (async () => {
            try {
              console.log(`🚀 [WEBHOOK] Pushing AT order ${shortId} to CodeCraft...`);
              const result = await codecraft.purchaseDataBundle(
                phoneNumber,
                dataAmount.toUpperCase(), // CodeCraft needs uppercase like "2GB"
                price,
                shortId,
                "at" // AT network
              );
              
              if (result.success) {
                console.log(`✅ [WEBHOOK] AT order ${shortId} pushed to CodeCraft`);
                await storage.updateAtOrderStatus(newOrder.id, "PROCESSING", "codecraft", result.message);
                // Schedule status check after 10 seconds
                polling.scheduleStatusCheck(newOrder.id, shortId, "at", 10000);
              } else {
                console.log(`❌ [WEBHOOK] AT order ${shortId} failed: ${result.message}`);
                await storage.updateAtOrderStatus(newOrder.id, "FAILED", "codecraft", result.message);
              }
            } catch (err) {
              console.error(`❌ [WEBHOOK] Error pushing AT order ${shortId}:`, err);
              await storage.updateAtOrderStatus(newOrder.id, "FAILED", "codecraft", String(err));
            }
          })();
        }

        if (service === "telecel") {
          const dataAmount = String(item.dataAmount || "");
          const price = Math.round(Number(item.price)); // Round to nearest integer
          if (!phoneNumber || !dataAmount || !Number.isFinite(price)) continue;

          const existing = await storage.findTelecelOrderByPaymentAndItem({
            paymentReference: reference,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
          });
          if (existing) continue;

          const shortId = `${reference}-${index + 1}`;
          const newOrder = await storage.createTelecelOrder({
            shortId,
            customerPhone: phoneNumber,
            packageDetails: dataAmount,
            packagePrice: price,
            status: "PROCESSING",
            paymentReference: reference,
          });
          created++;

          // Immediately push to CodeCraft (Telecel orders ALWAYS use CodeCraft)
          (async () => {
            try {
              console.log(`🚀 [WEBHOOK] Pushing Telecel order ${shortId} to CodeCraft...`);
              const result = await codecraft.purchaseDataBundle(
                phoneNumber,
                dataAmount.toUpperCase(), // CodeCraft needs uppercase like "5GB"
                price,
                shortId,
                "telecel" // Telecel network
              );
              
              if (result.success) {
                console.log(`✅ [WEBHOOK] Telecel order ${shortId} pushed to CodeCraft`);
                await storage.updateTelecelOrderStatus(newOrder.id, "PROCESSING", "codecraft", result.message);
                // Schedule status check after 10 seconds
                polling.scheduleStatusCheck(newOrder.id, shortId, "telecel", 10000);
              } else {
                console.log(`❌ [WEBHOOK] Telecel order ${shortId} failed: ${result.message}`);
                await storage.updateTelecelOrderStatus(newOrder.id, "FAILED", "codecraft", result.message);
              }
            } catch (err) {
              console.error(`❌ [WEBHOOK] Error pushing Telecel order ${shortId}:`, err);
              await storage.updateTelecelOrderStatus(newOrder.id, "FAILED", "codecraft", String(err));
            }
          })();
        }

        if (service === "datagod") {
          const packageName = String(item.packageName || "");
          const price = Number(item.price);
          if (!phoneNumber || !packageName || !Number.isFinite(price)) continue;

          const existing = await storage.findDatagodOrderByPaymentAndItem({
            paymentReference: reference,
            customerPhone: phoneNumber,
            packageName,
            packagePrice: price,
          });
          if (existing) continue;

          const shortId = `${reference}-${index + 1}`;
          await storage.createDatagodOrder({
            shortId,
            customerPhone: phoneNumber,
            packageName,
            packagePrice: price,
            status: "PAID",
            paymentReference: reference,
          });
          created++;
        }
      }

      return res.status(200).json({ ok: true, reference, created });
    } catch (error) {
      console.error("Paystack webhook error:", error);
      return res.status(500).send("Webhook error");
    }
  });

  /**
   * CodeCraft Callback Webhook
   * Receives real-time status updates from CodeCraft Network
   * Configure this URL in CodeCraft dashboard: https://wirenet.vercel.app/api/codecraft/callback
   * 
   * Expected payload from CodeCraft:
   * {
   *   reference_id: string,
   *   status: "Successful" | "Failed" | "Pending",
   *   message?: string,
   *   network?: string
   * }
   */
  app.post("/api/codecraft/callback", async (req: any, res) => {
    try {
      console.log("📥 [CODECRAFT CALLBACK] Received:", JSON.stringify(req.body, null, 2));

      const { reference_id, status, message, network, order_status } = req.body;

      if (!reference_id) {
        console.warn("⚠️ [CODECRAFT CALLBACK] Missing reference_id");
        return res.status(400).json({ error: "Missing reference_id" });
      }

      // Determine the final status
      const statusText = (order_status || status || "").toString().toLowerCase();
      let newStatus: "FULFILLED" | "FAILED" | "PROCESSING" = "PROCESSING";

      if (statusText.includes("successful") || statusText.includes("delivered") || 
          statusText.includes("completed") || statusText.includes("credited")) {
        newStatus = "FULFILLED";
      } else if (statusText.includes("failed") || statusText.includes("rejected") || 
                 statusText.includes("error") || statusText.includes("cancelled")) {
        newStatus = "FAILED";
      }

      console.log(`📊 [CODECRAFT CALLBACK] Reference: ${reference_id}, Status: ${statusText} → ${newStatus}`);

      // Try to find and update the order in each table
      let updated = false;

      // Check FastNet orders (FastNet doesn't have supplierReference column)
      const fastnetOrders = await storage.getFastnetOrders();
      const fastnetOrder = fastnetOrders.find(o => o.shortId === reference_id);
      if (fastnetOrder && newStatus !== "PROCESSING") {
        console.log(`✅ [CODECRAFT CALLBACK] Updating FastNet order ${fastnetOrder.shortId}: ${fastnetOrder.status} → ${newStatus}`);
        await storage.updateFastnetOrderStatus(fastnetOrder.id, newStatus, undefined, message || statusText);
        updated = true;
      }

      // Check AT orders
      const atOrders = await storage.getAtOrders();
      const atOrder = atOrders.find(o => o.shortId === reference_id || o.supplierReference === reference_id);
      if (atOrder && newStatus !== "PROCESSING") {
        console.log(`✅ [CODECRAFT CALLBACK] Updating AT order ${atOrder.shortId}: ${atOrder.status} → ${newStatus}`);
        await storage.updateAtOrderStatus(atOrder.id, newStatus, undefined, message || statusText);
        updated = true;
      }

      // Check Telecel orders
      const telecelOrders = await storage.getTelecelOrders();
      const telecelOrder = telecelOrders.find(o => o.shortId === reference_id || o.supplierReference === reference_id);
      if (telecelOrder && newStatus !== "PROCESSING") {
        console.log(`✅ [CODECRAFT CALLBACK] Updating Telecel order ${telecelOrder.shortId}: ${telecelOrder.status} → ${newStatus}`);
        await storage.updateTelecelOrderStatus(telecelOrder.id, newStatus, undefined, message || statusText);
        updated = true;
      }

      if (updated) {
        console.log(`✅ [CODECRAFT CALLBACK] Order ${reference_id} updated to ${newStatus}`);
        return res.status(200).json({ ok: true, reference_id, newStatus });
      } else {
        console.warn(`⚠️ [CODECRAFT CALLBACK] Order ${reference_id} not found or no status change`);
        return res.status(200).json({ ok: true, reference_id, message: "Order not found or no change needed" });
      }
    } catch (error) {
      console.error("❌ [CODECRAFT CALLBACK] Error:", error);
      return res.status(500).json({ error: "Callback processing failed" });
    }
  });

  // Session middleware with PostgreSQL store
  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
      },
    })
  );

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await login(email, password);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      (req.session as any).user = user;

      res.json({
        message: "Login successful",
        user,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("📥 Settings update request body:", JSON.stringify(req.body, null, 2));
      const { whatsappLink, datagodEnabled, fastnetEnabled, atEnabled, telecelEnabled, afaEnabled, afaLink, announcementText, announcementLink, announcementSeverity, announcementActive, datagodTransactionCharge, fastnetTransactionCharge, atTransactionCharge, telecelTransactionCharge, fastnetActiveSupplier, atActiveSupplier, telecelActiveSupplier, smsEnabled, smsNotificationPhones } = req.body;
      
      console.log("📱 smsNotificationPhones received:", smsNotificationPhones, "Type:", typeof smsNotificationPhones, "IsArray:", Array.isArray(smsNotificationPhones));

      const updated = await storage.updateSettings({
        whatsappLink,
        datagodEnabled,
        fastnetEnabled,
        atEnabled,
        telecelEnabled,
        afaEnabled,
        afaLink,
        announcementText,
        announcementLink,
        announcementSeverity,
        announcementActive,
        datagodTransactionCharge,
        fastnetTransactionCharge,
        atTransactionCharge,
        telecelTransactionCharge,
        fastnetActiveSupplier,
        atActiveSupplier,
        telecelActiveSupplier,
        smsEnabled,
        smsNotificationPhones,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Check SMS balance (Admin only)
  app.get("/api/sms/balance", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await checkSMSBalance();
      res.json(result);
    } catch (error) {
      console.error("Error checking SMS balance:", error);
      res.status(500).json({ success: false, message: "Failed to check SMS balance" });
    }
  });

  // Test SMS sending (Admin only)
  app.post("/api/sms/test", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { phones } = req.body;
      if (!phones || (Array.isArray(phones) && phones.length === 0)) {
        return res.status(400).json({ success: false, message: "Phone number(s) required" });
      }
      
      const result = await sendOrderNotification(
        phones,
        "TEST",
        "TEST-123",
        "0244000000",
        "Test Package"
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Test SMS error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to send test SMS" });
    }
  });

  // Manual trigger for order polling (Admin only - for testing/debugging)
  app.post("/api/admin/trigger-polling", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("🔄 Manual polling trigger requested by admin");
      await polling.pollOrderStatuses();
      res.json({ success: true, message: "Order polling triggered successfully. Check server logs for details." });
    } catch (error) {
      console.error("Error triggering polling:", error);
      res.status(500).json({ success: false, message: "Failed to trigger polling", error: String(error) });
    }
  });

  // --- FastNet Order Fulfillment Routes ---

  // Get all FastNet orders (Admin only)
  app.get("/api/fastnet/orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orders = await storage.getFastnetOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Update order status (Admin only)
  app.patch("/api/fastnet/orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updated = await storage.updateFastnetOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Purchase Data Bundle
  app.post("/api/fastnet/purchase", async (req, res) => {
    try {
      const { phoneNumber, dataAmount, price, reference } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a unique reference if not provided
      const orderReference = reference || `FN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Round price to integer (handle decimal prices like 5.1)
      const roundedPrice = Math.round(Number(price));

      // Check if THIS EXACT order already exists (prevent duplicates from same webhook/transaction)
      // Only block if: same payment reference AND same phone AND same package
      // This prevents duplicate webhook calls from creating multiple orders, but allows
      // legitimate repeat purchases with different payment references
      if (reference) {
        const existingOrder = await storage.findFastnetOrderByPaymentAndItem({
          paymentReference: reference,
          customerPhone: phoneNumber,
          packageDetails: dataAmount,
          packagePrice: roundedPrice,
        });
        if (existingOrder) {
          console.log(`⚠️ FastNet Order for ${phoneNumber}/${dataAmount} already exists with ref ${reference}, skipping duplicate`);
          return res.status(409).json({ 
            message: "Order already exists",
            orderId: existingOrder.shortId,
            status: existingOrder.status
          });
        }
      }

      // Create order record in database FIRST with status PAID
      const order = await storage.createFastnetOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: roundedPrice,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 Order ${order.shortId} created for ${phoneNumber} - ${dataAmount}`);

      // Send SMS notification (don't await - fire and forget)
      storage.getSettings().then(settings => {
        if (settings?.smsEnabled && settings?.smsNotificationPhones && settings.smsNotificationPhones.length > 0) {
          sendOrderNotification(
            settings.smsNotificationPhones,
            "FastNet",
            order.shortId,
            phoneNumber,
            dataAmount
          ).catch(err => console.error("SMS notification error:", err));
        }
      });

      // Try to fulfill with supplier
      let fulfillmentResult;
      try {
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          orderReference
        );

        // Update order with fulfillment result
        // Note: API success means order was ACCEPTED, not DELIVERED
        // Orders start as PROCESSING - use "Refresh Status" to check for FULFILLED
        if (fulfillmentResult.success) {
          await storage.updateFastnetOrderStatus(
            order.id, 
            "PROCESSING", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {})
          );
          // Schedule status check after 10 seconds
          polling.scheduleStatusCheck(order.id, order.shortId, "fastnet", 10000);
        } else {
          await storage.updateFastnetOrderStatus(
            order.id, 
            "PAID",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error("Fulfillment error (order still created):", fulfillError);
        // Fulfillment threw an error - no supplier accepted the order
        await storage.updateFastnetOrderStatus(
          order.id, 
          "PAID",
          undefined,
          fulfillError.message
        );
        fulfillmentResult = { success: false, message: fulfillError.message };
      }

      // Return response based on fulfillment result
      // Note: Order record is always created (payment was successful), but fulfillment may have failed
      res.json({ 
        success: fulfillmentResult.success,
        message: fulfillmentResult.success 
          ? "Order submitted to supplier successfully" 
          : `Order created but fulfillment failed: ${fulfillmentResult.message}`,
        orderId: order.shortId,
        status: fulfillmentResult.success ? "PROCESSING" : "PAID",
        data: fulfillmentResult 
      });
    } catch (error: any) {
      console.error("FastNet purchase error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Get FastNet Order Status (Public - for customers to check their order)
  app.get("/api/fastnet/orders/status/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      // Try finding by shortId first, then by paymentReference
      let order = await storage.getFastnetOrderByShortId(shortId);
      
      if (!order) {
        // Try searching by payment reference
        order = await storage.getFastnetOrderByPaymentReference(shortId);
      }
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({
        shortId: order.shortId,
        status: order.status,
        packageDetails: order.packageDetails,
        createdAt: order.createdAt,
      });
    } catch (error) {
      console.error("Error fetching order status:", error);
      res.status(500).json({ message: "Failed to fetch order status" });
    }
  });

  // Get Payment Phones for SMS Marketing (Admin only)
  app.get("/api/payment-phones", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const setting = await storage.getSetting("paymentPhones");
      const phones = setting ? JSON.parse(setting.value) : [];
      res.json({ phones, count: phones.length });
    } catch (error) {
      console.error("Error retrieving payment phones:", error);
      res.json({ phones: [], count: 0 });
    }
  });

  // Sync historical payment phones from Paystack (Admin only)
  app.post("/api/payment-phones/sync-history", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      console.log("🔍 Checking Paystack config...");
      console.log(`   Secret key exists: ${!!paystackSecret}`);
      
      if (!paystackSecret) {
        return res.status(500).json({ success: false, message: "Paystack not configured", debug: "PAYSTACK_SECRET_KEY is not set" });
      }

      // Fetch all transactions from Paystack (from account creation, all-time)
      console.log("🔄 Syncing all historical payment phones from Paystack...");
      const phones: Set<string> = new Set();
      let page = 1;
      let hasMore = true;
      let totalProcessed = 0;
      let totalPages = 0;
      const detailedLog: string[] = [];
      let firstPageData: any = null;
      const batchSize = 50; // Smaller batch size to avoid timeouts
      const maxRetries = 3;

      while (hasMore) {
        let retryCount = 0;
        let pageSuccess = false;

        while (retryCount < maxRetries && !pageSuccess) {
          try {
            // Get all success transactions with smaller batch size
            const url = `https://api.paystack.co/transaction?perPage=${batchSize}&page=${page}&status=success`;
            console.log(`📄 Fetching page ${page} (attempt ${retryCount + 1}/${maxRetries}): ${url}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${paystackSecret}`,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            console.log(`   Response status: ${response.status}`);
            
            const responseText = await response.text();
            console.log(`   Response length: ${responseText.length} bytes`);
            
            if (!response.ok) {
              if (response.status === 504 && retryCount < maxRetries - 1) {
                console.warn(`⚠️ Request timeout (504), retrying... (${retryCount + 1}/${maxRetries})`);
                detailedLog.push(`Page ${page}: Attempt ${retryCount + 1} - Timeout, retrying`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                continue;
              }
              console.error("❌ Paystack API error:", response.status, responseText.substring(0, 500));
              detailedLog.push(`Page ${page}: ERROR ${response.status} - ${responseText.substring(0, 200)}`);
              pageSuccess = false;
              break;
            }

            let data;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              console.error("❌ Failed to parse Paystack response:", parseError);
              detailedLog.push(`Page ${page}: PARSE_ERROR - Invalid JSON`);
              pageSuccess = false;
              break;
            }

            // Store first page response for debugging
            if (page === 1) {
              firstPageData = {
                status: data.status,
                message: data.message,
                dataLength: data.data?.length || 0,
                metaExists: !!data.meta,
                pagination: data.meta?.pagination,
                firstTransaction: data.data?.[0] ? {
                  id: data.data[0].id,
                  amount: data.data[0].amount,
                  customer: data.data[0].customer,
                  metadata: data.data[0].metadata,
                  authorization: data.data[0].authorization,
                  paidAt: data.data[0].paidAt,
                  createdAt: data.data[0].createdAt,
                  // Log ALL keys in first transaction for debugging
                  allKeys: Object.keys(data.data[0]),
                } : null,
              };
              console.log("📋 First transaction full structure:", JSON.stringify(firstPageData, null, 2));
            }

            console.log(`   Data array length: ${data.data?.length || 0}`);
            console.log(`   Status: ${data.status}, Message: ${data.message}`);
            
            if (!data.data || data.data.length === 0) {
              console.log(`✅ Reached end of transactions at page ${page}`);
              detailedLog.push(`Page ${page}: END - no more data`);
              hasMore = false;
              pageSuccess = true;
              break;
            }

            // Extract phone numbers from each transaction
            let phonesOnThisPage = 0;
            const phoneFieldsChecked: string[] = [];
            
            for (let txIdx = 0; txIdx < data.data.length; txIdx++) {
              const transaction = data.data[txIdx];
              let foundPhone: string | null = null;
              
              // First check WireNet metadata (custom items array with phoneNumber)
              if (transaction.metadata?.wirenet?.items && Array.isArray(transaction.metadata.wirenet.items)) {
                for (const item of transaction.metadata.wirenet.items) {
                  if (item.phoneNumber) {
                    foundPhone = item.phoneNumber;
                    if (txIdx < 3) phoneFieldsChecked.push(`tx${txIdx}: metadata.wirenet.items[].phoneNumber`);
                    break;
                  }
                }
              }
              
              // Fallback to standard Paystack fields if not found in metadata
              if (!foundPhone) {
                if (transaction.customer?.phone) {
                  foundPhone = transaction.customer.phone;
                  if (txIdx < 3) phoneFieldsChecked.push(`tx${txIdx}: customer.phone`);
                } else if (transaction.metadata?.phone) {
                  foundPhone = transaction.metadata.phone;
                  if (txIdx < 3) phoneFieldsChecked.push(`tx${txIdx}: metadata.phone`);
                } else if (transaction.authorization?.phone) {
                  foundPhone = transaction.authorization.phone;
                  if (txIdx < 3) phoneFieldsChecked.push(`tx${txIdx}: authorization.phone`);
                }
              }
              
              if (foundPhone) {
                const phoneStr = String(foundPhone).trim();
                if (phoneStr.length > 0 && phoneStr !== "null") {
                  phones.add(phoneStr);
                  phonesOnThisPage++;
                }
              }
            }
            
            if (page === 1 && phoneFieldsChecked.length > 0) {
              console.log(`📱 Phone fields found: ${phoneFieldsChecked.join(", ")}`);
            }

            totalProcessed += data.data.length;
            totalPages++;
            console.log(`📊 Page ${page}: ${data.data.length} transactions, ${phonesOnThisPage} new phones on this page, ${phones.size} unique total`);
            detailedLog.push(`Page ${page}: ${data.data.length} txns, ${phonesOnThisPage} phones, ${phones.size} unique`);

            // Check if there are more pages
            if (data.meta?.pagination?.has_more) {
              page++;
            } else {
              console.log(`✅ Pagination complete: has_more = false`);
              detailedLog.push(`Pagination complete at page ${page}`);
              hasMore = false;
            }
            
            pageSuccess = true;
          } catch (pageError) {
            if (pageError instanceof Error && pageError.name === 'AbortError') {
              console.warn(`⚠️ Request timeout on page ${page}, attempt ${retryCount + 1}`);
              if (retryCount < maxRetries - 1) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                continue;
              }
            }
            console.error(`Error fetching page ${page}:`, pageError);
            detailedLog.push(`Page ${page}: EXCEPTION - ${String(pageError)}`);
            pageSuccess = false;
            break;
          }
        }

        if (!pageSuccess) {
          console.log("⚠️ Failed to fetch page after retries, stopping sync");
          break;
        }
      }

      // Get existing phones before sync
      const existingSetting = await storage.getSetting("paymentPhones");
      const existingPhones = existingSetting ? JSON.parse(existingSetting.value) : [];
      const existingSet = new Set(existingPhones);
      const previousCount = existingSet.size;
      
      // Merge new phones
      for (const phone of phones) {
        existingSet.add(phone);
      }
      
      const newCount = existingSet.size - previousCount;

      // Update the setting with merged list
      await storage.upsertSetting("paymentPhones", JSON.stringify(Array.from(existingSet)));

      console.log("📋 SYNC SUMMARY:");
      console.log(`   Total transactions fetched: ${totalProcessed}`);
      console.log(`   Total pages processed: ${totalPages}`);
      console.log(`   Unique phones found in Paystack: ${phones.size}`);
      console.log(`   Phones before sync: ${previousCount}`);
      console.log(`   Phones after sync: ${existingSet.size}`);
      console.log(`   New phones added: ${newCount}`);

      res.json({
        success: totalProcessed > 0,
        message: totalProcessed > 0 
          ? `Synced ${totalProcessed} historical transactions from ${totalPages} pages`
          : `Sync incomplete: Fetched ${totalProcessed} transactions from ${totalPages} pages (API timeouts - may need to try again)`,
        totalPhones: existingSet.size,
        newPhonesAdded: newCount,
        previousCount,
        totalTransactionsFetched: totalProcessed,
        totalPagesFetched: totalPages,
        uniquePhonesInPaystack: phones.size,
        batchSize,
        firstPageData,
        detailedLog,
        phones: Array.from(existingSet),
      });
    } catch (error) {
      console.error("Error syncing payment phones:", error);
      res.status(500).json({ success: false, message: "Failed to sync payment phones", error: String(error) });
    }
  });

  // Clear/Reset Payment Phones List (Admin only)
  app.post("/api/payment-phones/clear", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.upsertSetting("paymentPhones", JSON.stringify([]));
      res.json({ success: true, message: "Payment phones list cleared" });
    } catch (error) {
      console.error("Error clearing payment phones:", error);
      res.status(500).json({ success: false, message: "Failed to clear payment phones" });
    }
  });

  // Get Wallet Balances (Admin only)
  app.get("/api/fastnet/balances", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [dataxpress, hubnet, dakazina] = await Promise.all([
        supplierManager.getWalletBalance("dataxpress"),
        supplierManager.getWalletBalance("hubnet"),
        supplierManager.getWalletBalance("dakazina")
      ]);

      res.json({
        dataxpress,
        hubnet,
        dakazina
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });

  // Get Active Supplier (Admin only)
  app.get("/api/fastnet/supplier", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const supplier = await supplierManager.getActiveSupplierName();
      res.json({ supplier });
    } catch (error) {
      console.error("Error getting supplier:", error);
      res.status(500).json({ message: "Failed to get supplier" });
    }
  });

  // Set Active Supplier (Admin only)
  app.post("/api/fastnet/supplier", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { supplier } = req.body;
      if (supplier !== "dataxpress" && supplier !== "hubnet" && supplier !== "dakazina") {
        return res.status(400).json({ message: "Invalid supplier" });
      }
      
      await supplierManager.setActiveSupplier(supplier);
      res.json({ success: true, supplier, message: `Active supplier set to ${supplier}` });
    } catch (error) {
      console.error("Error setting supplier:", error);
      res.status(500).json({ message: "Failed to set supplier" });
    }
  });

  // Check Order Status from Supplier (Admin only)
  app.post("/api/fastnet/orders/:id/check-status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the order to find its supplier and reference
      const orders = await storage.getFastnetOrders();
      const order = orders.find(o => o.id === id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order has a supplier assigned
      const supplier = order.supplierUsed as "dataxpress" | "hubnet" | "dakazina";
      if (!supplier) {
        return res.status(400).json({ message: "Order has no supplier assigned" });
      }

      // Hubnet does not support polling - status updates come via webhook
      if (supplier === "hubnet") {
        return res.json({
          success: false,
          supplierStatus: null,
          message: "Hubnet does not support status polling. Status updates are received via webhook.",
          supplier: "hubnet",
        });
      }

      // Get reference for status check
      // DataKazina uses their transaction_id, DataXpress uses our order reference
      let statusReference = order.shortId;
      console.log(`📋 Order ${order.shortId} - Supplier: ${supplier}, supplierResponse: ${order.supplierResponse}`);
      
      if (supplier === "dakazina") {
        if (order.supplierResponse) {
          try {
            const responseData = JSON.parse(order.supplierResponse);
            console.log(`📋 Parsed supplierResponse:`, responseData);
            
            // Try multiple possible locations for transaction_id
            const txnId = responseData.transaction_id || 
                          responseData.data?.transaction_id || 
                          responseData.transactionId;
            
            if (txnId) {
              statusReference = txnId;
              console.log(`✅ Using DataKazina transaction_id: ${statusReference}`);
            } else {
              console.log(`⚠️ No transaction_id found in supplierResponse, using shortId`);
            }
          } catch (e) {
            console.log(`❌ Failed to parse supplierResponse: ${e}`);
          }
        } else {
          console.log(`⚠️ No supplierResponse stored for DataKazina order ${order.shortId}`);
        }
      }
      
      const statusResult = await supplierManager.checkOrderStatus(supplier, statusReference);
      
      // If we got a successful status, update the order in our database
      if (statusResult.success && statusResult.status) {
        const normalizedStatus = normalizeSupplierStatus(statusResult.status);
        if (normalizedStatus !== order.status) {
          await storage.updateFastnetOrderStatus(id, normalizedStatus, supplier, JSON.stringify(statusResult.data || {}));
        }
      }

      res.json({
        success: statusResult.success,
        supplierStatus: statusResult.status,
        message: statusResult.message,
        data: statusResult.data,
        supplier: statusResult.supplier,
      });
    } catch (error: any) {
      console.error("Error checking order status:", error);
      res.status(500).json({ message: error.message || "Failed to check order status" });
    }
  });

  // Bulk refresh order statuses (Admin only)
  app.post("/api/fastnet/orders/refresh-all-statuses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orders = await storage.getFastnetOrders();
      
      // Filter to orders that have a supplier and need status update
      // Skip Hubnet orders as it doesn't support polling (uses webhooks instead)
      // Include FAILED orders too in case they were fulfilled but status wasn't updated
      const processingOrders = orders.filter(o => 
        o.supplierUsed && 
        o.supplierUsed !== "hubnet" && 
        (o.status === "PROCESSING" || o.status === "PAID" || o.status === "PAID")
      );

      const results = [];
      
      for (const order of processingOrders) {
        try {
          const supplier = order.supplierUsed as "dataxpress" | "hubnet" | "dakazina";
          
          // Get reference for status check - DataKazina uses transaction_id
          let statusReference = order.shortId;
          console.log(`📋 Order ${order.shortId} - Supplier: ${supplier}, supplierResponse: ${order.supplierResponse}`);
          
          if (supplier === "dakazina") {
            if (order.supplierResponse) {
              try {
                const responseData = JSON.parse(order.supplierResponse);
                console.log(`📋 Parsed supplierResponse:`, responseData);
                
                // Try multiple possible locations for transaction_id
                const txnId = responseData.transaction_id || 
                              responseData.data?.transaction_id || 
                              responseData.transactionId;
                
                if (txnId) {
                  statusReference = txnId;
                  console.log(`✅ Using DataKazina transaction_id: ${statusReference}`);
                } else {
                  console.log(`⚠️ No transaction_id found in supplierResponse, using shortId`);
                }
              } catch (e) {
                console.log(`❌ Failed to parse supplierResponse: ${e}`);
              }
            } else {
              console.log(`⚠️ No supplierResponse stored for DataKazina order ${order.shortId}`);
            }
          }
          
          const statusResult = await supplierManager.checkOrderStatus(supplier, statusReference);
          
          let normalizedStatus = order.status;
          let wasUpdated = false;
          
          if (statusResult.success && statusResult.status) {
            normalizedStatus = normalizeSupplierStatus(statusResult.status);
            console.log(`📊 Order ${order.shortId}: Supplier says "${statusResult.status}" -> normalized to "${normalizedStatus}", current status: "${order.status}"`);
            
            if (normalizedStatus !== order.status) {
              console.log(`🔄 Updating order ${order.shortId} from ${order.status} to ${normalizedStatus}`);
              await storage.updateFastnetOrderStatus(order.id, normalizedStatus, supplier, JSON.stringify(statusResult.data || {}));
              wasUpdated = true;
            } else {
              console.log(`⏸️ Order ${order.shortId} already has status ${order.status}, no update needed`);
            }
          }
          
          results.push({
            orderId: order.id,
            shortId: order.shortId,
            success: statusResult.success,
            previousStatus: order.status,
            supplierStatus: statusResult.status,
            normalizedStatus: normalizedStatus,
            wasUpdated: wasUpdated,
          });
        } catch (err: any) {
          results.push({
            orderId: order.id,
            shortId: order.shortId,
            success: false,
            error: err.message,
          });
        }
      }

      res.json({
        message: `Refreshed ${results.length} orders`,
        results,
      });
    } catch (error: any) {
      console.error("Error refreshing order statuses:", error);
      res.status(500).json({ message: error.message || "Failed to refresh order statuses" });
    }
  });

  // ============================================
  // DataGod API Endpoints
  // ============================================

  // Get DataGod Orders (Admin only)
  app.get("/api/datagod/orders", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const orders = await storage.getDatagodOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching DataGod orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Create DataGod Order
  app.post("/api/datagod/orders", async (req, res) => {
    try {
      const { shortId, customerPhone, customerEmail, packageName, packagePrice, status, paymentReference } = req.body;
      
      console.log("📝 DataGod order creation request:", { shortId, customerPhone, customerEmail, packageName, packagePrice, status, paymentReference });
      
      if (!customerPhone || !packageName || !packagePrice) {
        console.error("❌ Missing required fields:", { customerPhone, packageName, packagePrice });
        return res.status(400).json({ message: "Missing required fields" });
      }

      const orderReference = shortId || `DG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const order = await storage.createDatagodOrder({
        shortId: orderReference,
        customerPhone,
        packageName,
        packagePrice: parseFloat(packagePrice),
        status: status || "PAID",
        paymentReference: paymentReference || null,
      });

      console.log("✅ DataGod order created:", order);
      res.json({ success: true, order });
    } catch (error: any) {
      console.error("❌ Error creating DataGod order:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DataGod Purchase endpoint (for storefront)
  app.post("/api/datagod/purchase", async (req, res) => {
    try {
      const { phoneNumber, dataAmount, price, reference } = req.body;
      
      console.log("📝 DataGod purchase request:", { phoneNumber, dataAmount, price, reference });
      
      if (!phoneNumber || !dataAmount || !price) {
        console.error("❌ Missing required fields:", { phoneNumber, dataAmount, price });
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Use Paystack reference as shortId so customers can track their order
      const orderReference = reference || `DG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const order = await storage.createDatagodOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageName: dataAmount,
        packagePrice: typeof price === 'string' ? parseFloat(price) : price,
        status: "PAID",
        paymentReference: reference || null,
      });

      console.log("✅ DataGod order created via purchase:", order);

      // Send SMS notification (don't await - fire and forget)
      storage.getSettings().then(settings => {
        if (settings?.smsEnabled && settings?.smsNotificationPhones && settings.smsNotificationPhones.length > 0) {
          sendOrderNotification(
            settings.smsNotificationPhones,
            "DataGod",
            order.shortId,
            phoneNumber,
            dataAmount
          ).catch(err => console.error("SMS notification error:", err));
        }
      });

      res.json({ success: true, shortId: order.shortId, order });
    } catch (error: any) {
      console.error("❌ Error creating DataGod order:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get DataGod Order Status (Public - for customers to check their order)
  app.get("/api/datagod/orders/status/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      // Try finding by shortId first, then by paymentReference
      let order = await storage.getDatagodOrderByShortId(shortId);
      
      if (!order) {
        // Try searching by payment reference
        order = await storage.getDatagodOrderByPaymentReference(shortId);
      }
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({
        shortId: order.shortId,
        status: order.status,
        packageName: order.packageName,
        createdAt: order.createdAt,
      });
    } catch (error) {
      console.error("Error fetching order status:", error);
      res.status(500).json({ message: "Failed to fetch order status" });
    }
  });

  // Update DataGod Order Status (Admin only)
  app.patch("/api/datagod/orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updated = await storage.updateDatagodOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating DataGod order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Get DataGod Packages (Public - for storefront)
  app.get("/api/datagod/packages", async (_req, res) => {
    try {
      const packages = await storage.getEnabledDatagodPackages();
      // Transform to frontend expected format
      const transformedPackages = packages.map(pkg => ({
        id: pkg.id.toString(),
        dataAmount: `${pkg.dataValueGB}GB`,
        price: pkg.priceGHS,
        deliveryTime: "1-24 hours",
        isEnabled: pkg.isEnabled,
      }));
      res.json(transformedPackages);
    } catch (error) {
      console.error("Error fetching DataGod packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Get All DataGod Packages (Admin only - includes disabled)
  app.get("/api/datagod/packages/all", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const packages = await storage.getDatagodPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching DataGod packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Create DataGod Package (Admin only)
  app.post("/api/datagod/packages", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { packageName, dataValueGB, priceGHS, isEnabled } = req.body;

      if (!packageName || !dataValueGB || !priceGHS) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const pkg = await storage.createDatagodPackage({
        packageName,
        dataValueGB: parseFloat(dataValueGB),
        priceGHS: parseFloat(priceGHS),
        isEnabled: isEnabled !== false,
      });

      res.json(pkg);
    } catch (error) {
      console.error("Error creating DataGod package:", error);
      res.status(500).json({ message: "Failed to create package" });
    }
  });

  // Update DataGod Package (Admin only)
  app.patch("/api/datagod/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const updated = await storage.updateDatagodPackage(id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating DataGod package:", error);
      res.status(500).json({ message: "Failed to update package" });
    }
  });

  // Delete DataGod Package (Admin only)
  app.delete("/api/datagod/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteDatagodPackage(id);

      if (!deleted) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting DataGod package:", error);
      res.status(500).json({ message: "Failed to delete package" });
    }
  });

  // --- AT ISHARE Order Routes ---
  
  // Purchase AT data
  app.post("/api/at/purchase", async (req, res) => {
    try {
      const { phoneNumber, dataAmount, price, reference } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const orderReference = reference || `AT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Check if THIS EXACT order already exists (prevent duplicates from webhook for bulk orders)
      if (reference) {
        const existingOrder = await storage.findAtOrderByPaymentAndItem({
          paymentReference: reference,
          customerPhone: phoneNumber,
          packageDetails: dataAmount,
          packagePrice: typeof price === 'string' ? parseInt(price) : price,
        });
        if (existingOrder) {
          console.log(`⚠️ AT Order for ${phoneNumber}/${dataAmount} already exists with ref ${reference}, skipping duplicate`);
          return res.status(409).json({ 
            message: "Order already exists",
            orderId: existingOrder.shortId,
            status: existingOrder.status
          });
        }
      }

      const order = await storage.createAtOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 AT Order ${order.shortId} created with ID ${order.id} for ${phoneNumber} - ${dataAmount}`);

      // Send SMS notification (don't await - fire and forget)
      storage.getSettings().then(settings => {
        if (settings?.smsEnabled && settings?.smsNotificationPhones && settings.smsNotificationPhones.length > 0) {
          sendOrderNotification(
            settings.smsNotificationPhones,
            "AT iShare",
            order.shortId,
            phoneNumber,
            dataAmount
          ).catch(err => console.error("SMS notification error:", err));
        }
      });

      let fulfillmentResult;
      try {
        console.log(`🔄 Starting AT fulfillment for order ${order.id}...`);
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          orderReference,
          "codecraft",
          "at_ishare"
        );
        console.log(`📤 Fulfillment result:`, fulfillmentResult);

        if (fulfillmentResult.success) {
          // Extract supplier reference from Code Craft response
          const supplierRef = fulfillmentResult.data?.reference_id || null;
          
          console.log(`✅ Updating order ${order.id} status to PROCESSING with supplier ref:`, supplierRef);
          await storage.updateAtOrderStatus(
            order.id, 
            "PROCESSING", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {}),
            supplierRef
          );
          
          if (supplierRef) {
            console.log(`✅ AT Order ${order.shortId} fulfilled with supplier reference: ${supplierRef}`);
          }
        } else {
          console.log(`⚠️ Fulfillment failed, updating order ${order.id} to PAID`);
          await storage.updateAtOrderStatus(
            order.id, 
            "PAID",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error(`❌ AT Fulfillment error for order ${order.id}:`, fulfillError);
        await storage.updateAtOrderStatus(
          order.id, 
          "PAID",
          undefined,
          fulfillError.message
        );
        fulfillmentResult = { success: false, message: fulfillError.message };
      }

      res.json({ 
        success: fulfillmentResult.success,
        message: fulfillmentResult.success 
          ? "AT order submitted successfully" 
          : `Order created but fulfillment failed: ${fulfillmentResult.message}`,
        orderId: order.shortId,
        status: fulfillmentResult.success ? "PROCESSING" : "PAID",
      });
    } catch (error: any) {
      console.error("AT purchase error:", error);
      res.status(500).json({ message: error.message || "Failed to create order" });
    }
  });

  // Get AT order status
  app.get("/api/at/orders/status/:shortId", async (req, res) => {
    try {
      const order = await storage.getAtOrderByShortId(req.params.shortId);
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error) {
      console.error("Error fetching AT order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Admin: Get all AT orders
  app.get("/api/at/orders", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      console.log("📋 Fetching all AT orders...");
      const orders = await storage.getAtOrders();
      console.log(`📋 Retrieved ${orders.length} AT orders:`, orders);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching AT orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Admin: Refresh single AT order status
  app.post("/api/at/orders/:id/refresh", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await polling.checkSingleOrderStatus("at", req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error refreshing AT order status:", error);
      res.status(500).json({ success: false, message: "Failed to refresh order status" });
    }
  });

  // Admin: Manually update AT order status
  app.patch("/api/at/orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updated = await storage.updateAtOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      console.log(`📝 AT order ${id} manually updated to ${status}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating AT order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Admin: Refresh all AT orders (AT only, not all categories)
  app.post("/api/at/orders/refresh/all", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      await polling.pollAtOrders();
      res.json({ success: true, message: "AT orders status updated" });
    } catch (error) {
      console.error("Error refreshing AT orders:", error);
      res.status(500).json({ success: false, message: "Failed to refresh orders" });
    }
  });

  // Public: Get AT packages (for storefront)
  app.get("/api/at/packages/public", async (_req, res) => {
    try {
      const packages = await storage.getAtPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching AT packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Admin: Create AT package
  app.post("/api/at/packages", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { dataAmount, price, deliveryTime } = req.body;
      
      if (!dataAmount || !price || !deliveryTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const pkg = await storage.createAtPackage({
        dataAmount,
        price: parseFloat(price as string),
        deliveryTime,
        isEnabled: true,
      });

      res.json(pkg);
    } catch (error) {
      console.error("Error creating AT package:", error);
      res.status(500).json({ message: "Failed to create package" });
    }
  });

  // Admin: Get AT packages
  app.get("/api/at/packages", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const packages = await storage.getAtPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching AT packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Admin: Update AT package
  app.patch("/api/at/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const updated = await storage.updateAtPackage(id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating AT package:", error);
      res.status(500).json({ message: "Failed to update package" });
    }
  });

  // Admin: Delete AT package
  app.delete("/api/at/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAtPackage(id);

      if (!deleted) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting AT package:", error);
      res.status(500).json({ message: "Failed to delete package" });
    }
  });

  // --- TELECEL Order Routes ---
  
  // Purchase TELECEL data
  app.post("/api/telecel/purchase", async (req, res) => {
    try {
      const { phoneNumber, dataAmount, price, reference } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const orderReference = reference || `TC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Check if THIS EXACT order already exists (prevent duplicates from webhook for bulk orders)
      if (reference) {
        const existingOrder = await storage.findTelecelOrderByPaymentAndItem({
          paymentReference: reference,
          customerPhone: phoneNumber,
          packageDetails: dataAmount,
          packagePrice: typeof price === 'string' ? parseInt(price) : price,
        });
        if (existingOrder) {
          console.log(`⚠️ Telecel Order for ${phoneNumber}/${dataAmount} already exists with ref ${reference}, skipping duplicate`);
          return res.status(409).json({ 
            message: "Order already exists",
            orderId: existingOrder.shortId,
            status: existingOrder.status
          });
        }
      }

      const order = await storage.createTelecelOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 TELECEL Order ${order.shortId} created with ID ${order.id} for ${phoneNumber} - ${dataAmount}`);

      // Send SMS notification (don't await - fire and forget)
      storage.getSettings().then(settings => {
        if (settings?.smsEnabled && settings?.smsNotificationPhones && settings.smsNotificationPhones.length > 0) {
          sendOrderNotification(
            settings.smsNotificationPhones,
            "Telecel",
            order.shortId,
            phoneNumber,
            dataAmount
          ).catch(err => console.error("SMS notification error:", err));
        }
      });

      let fulfillmentResult;
      try {
        console.log(`🔄 Starting Telecel fulfillment for order ${order.id}...`);
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          orderReference,
          "codecraft",
          "telecel"
        );
        console.log(`📤 Fulfillment result:`, fulfillmentResult);

        if (fulfillmentResult.success) {
          // Extract supplier reference from Code Craft response
          const supplierRef = fulfillmentResult.data?.reference_id || null;
          
          console.log(`✅ Updating order ${order.id} status to PROCESSING with supplier ref:`, supplierRef);
          await storage.updateTelecelOrderStatus(
            order.id, 
            "PROCESSING", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {}),
            supplierRef
          );
          
          if (supplierRef) {
            console.log(`✅ TELECEL Order ${order.shortId} fulfilled with supplier reference: ${supplierRef}`);
          }
        } else {
          console.log(`⚠️ Fulfillment failed, updating order ${order.id} to PAID`);
          await storage.updateTelecelOrderStatus(
            order.id, 
            "PAID",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error(`❌ TELECEL Fulfillment error for order ${order.id}:`, fulfillError);
        await storage.updateTelecelOrderStatus(
          order.id, 
          "PAID",
          undefined,
          fulfillError.message
        );
        fulfillmentResult = { success: false, message: fulfillError.message };
      }

      res.json({ 
        success: fulfillmentResult.success,
        message: fulfillmentResult.success 
          ? "TELECEL order submitted successfully" 
          : `Order created but fulfillment failed: ${fulfillmentResult.message}`,
        orderId: order.shortId,
        status: fulfillmentResult.success ? "PROCESSING" : "PAID",
      });
    } catch (error: any) {
      console.error("TELECEL purchase error:", error);
      res.status(500).json({ message: error.message || "Failed to create order" });
    }
  });

  // Get TELECEL order status
  app.get("/api/telecel/orders/status/:shortId", async (req, res) => {
    try {
      const order = await storage.getTelecelOrderByShortId(req.params.shortId);
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error) {
      console.error("Error fetching TELECEL order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Admin: Get all TELECEL orders
  app.get("/api/telecel/orders", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      console.log("📋 Fetching all Telecel orders...");
      const orders = await storage.getTelecelOrders();
      console.log(`📋 Retrieved ${orders.length} Telecel orders:`, orders);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching TELECEL orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Admin: Refresh single TELECEL order status
  app.post("/api/telecel/orders/:id/refresh", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await polling.checkSingleOrderStatus("telecel", req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error refreshing TELECEL order status:", error);
      res.status(500).json({ success: false, message: "Failed to refresh order status" });
    }
  });

  // Admin: Manually update TELECEL order status
  app.patch("/api/telecel/orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updated = await storage.updateTelecelOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      console.log(`📝 Telecel order ${id} manually updated to ${status}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating Telecel order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Admin: Refresh all TELECEL orders (Telecel only, not all categories)
  app.post("/api/telecel/orders/refresh/all", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      await polling.pollTelecelOrders();
      res.json({ success: true, message: "Telecel orders status updated" });
    } catch (error) {
      console.error("Error refreshing TELECEL orders:", error);
      res.status(500).json({ success: false, message: "Failed to refresh orders" });
    }
  });

  // Public: Get TELECEL packages (for storefront)
  app.get("/api/telecel/packages/public", async (_req, res) => {
    try {
      const packages = await storage.getTelecelPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching TELECEL packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Admin: Create TELECEL package
  app.post("/api/telecel/packages", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { dataAmount, price, deliveryTime } = req.body;
      
      if (!dataAmount || !price || !deliveryTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const pkg = await storage.createTelecelPackage({
        dataAmount,
        price: parseFloat(price as string),
        deliveryTime,
        isEnabled: true,
      });

      res.json(pkg);
    } catch (error) {
      console.error("Error creating TELECEL package:", error);
      res.status(500).json({ message: "Failed to create package" });
    }
  });

  // Admin: Get TELECEL packages
  app.get("/api/telecel/packages", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const packages = await storage.getTelecelPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching TELECEL packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Admin: Update TELECEL package
  app.patch("/api/telecel/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const updated = await storage.updateTelecelPackage(id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating TELECEL package:", error);
      res.status(500).json({ message: "Failed to update package" });
    }
  });

  // Admin: Delete TELECEL package
  app.delete("/api/telecel/packages/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTelecelPackage(id);

      if (!deleted) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting TELECEL package:", error);
      res.status(500).json({ message: "Failed to delete package" });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const server = createServer(app);
  return server;
}

/**
 * Normalize supplier status to our internal status format
 */
function normalizeSupplierStatus(supplierStatus: string): string {
  const status = supplierStatus.toLowerCase().trim();
  
  console.log(`🔄 Normalizing supplier status: "${supplierStatus}" -> "${status}"`);
  
  // Success/completed statuses -> FULFILLED
  if (status === "success" || status === "completed" || status === "delivered" || 
      status === "fulfilled" || status === "sent" || status === "done" || 
      status === "successful" || status === "approved" || status === "1") {
    console.log(`✅ Status "${status}" normalized to FULFILLED`);
    return "FULFILLED";
  }
  
  // Accepted/pending/placed statuses -> PAID (order accepted but not yet processing)
  if (status === "accepted" || status === "pending" || status === "placed") {
    console.log(`💳 Status "${status}" normalized to PAID`);
    return "PAID";
  }
  
  // Processing statuses -> PROCESSING
  if (status === "processing" || status === "queued" ||
      status === "initiated" || status === "waiting" || status === "0") {
    console.log(`⏳ Status "${status}" normalized to PROCESSING`);
    return "PROCESSING";
  }
  
  // Failed statuses -> FAILED
  // NOTE: We do NOT normalize "error" to FAILED because some suppliers return "error" messages even when the transaction is accepted.
  if (status === "failed" || status === "rejected" ||
      status === "cancelled" || status === "canceled" || status === "declined" || status === "2") {
    console.log(`❌ Status "${status}" normalized to FAILED`);
    return "PAID";
  }
  
  console.log(`⚠️ Unknown status "${status}" - defaulting to PROCESSING`);
  return "PROCESSING"; // Default to processing for unknown statuses
}
