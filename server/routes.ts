import { Express } from "express";
import { createServer, Server } from "http";
import { storage } from "./storage.js";
import { isAuthenticated, isAdmin, login } from "./auth.js";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as supplierManager from "./supplier-manager.js";
import * as polling from "./polling.js";
import * as codecraft from "./codecraft.js";
import * as moolre from "./moolre.js";
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

  /**
   * Moolre Payment Webhook Handler
   * Called by Moolre after payment attempt (success, pending, or failure)
   * Response format:
   * {
   *   transactionid: string,
   *   status: "TR000" | "TR099" | "TP14" | other code,
   *   externalref: string (order reference),
   *   amount: number,
   *   payer: string,
   *   message: string,
   *   secret: string (webhook secret to verify)
   * }
   */
  app.post("/api/moolre/webhook", async (req: any, res) => {
    try {
      console.log("📥 [MOOLRE WEBHOOK] Received:", JSON.stringify(req.body, null, 2));

      // Moolre webhook has nested data structure
      const { code, message: topMessage, data } = req.body;
      
      // Extract fields from data object (Moolre's actual payload structure)
      const transactionid = data?.transactionid;
      const externalref = data?.externalref;
      const secret = data?.secret;
      const txstatus = data?.txstatus;
      const payer = data?.payer; // Payer's phone number for SMS marketing
      const message = topMessage || data?.message;

      // Verify webhook secret
      if (!moolre.verifyWebhookSecret(secret)) {
        console.warn("⚠️ [MOOLRE WEBHOOK] Invalid webhook secret. Received:", secret);
        return res.status(401).json({ error: "Invalid webhook secret" });
      }

      if (!externalref) {
        console.warn("⚠️ [MOOLRE WEBHOOK] Missing externalref (order reference)");
        return res.status(400).json({ error: "Missing externalref" });
      }

      console.log(`📊 [MOOLRE WEBHOOK] Order: ${externalref}, Transaction: ${transactionid}, Code: ${code}, TxStatus: ${txstatus}`);

      // Determine if this is a successful payment
      // Moolre success: code="P01" and txstatus=1, OR legacy codes TR000/0
      const paymentSuccessful = (code === "P01" && txstatus === 1) || code === "TR000" || code === "0";

      if (!paymentSuccessful) {
        // Payment not successful yet
        console.log(`📊 [MOOLRE WEBHOOK] Payment not confirmed (code: ${code}, txstatus: ${txstatus})`);
        return res.status(200).json({ ok: true, externalref, message: "Payment not yet confirmed" });
      }

      console.log(`✅ [MOOLRE WEBHOOK] Payment confirmed for order: ${externalref}`);

      // Save payer's phone for SMS marketing (same as Paystack)
      if (payer && payer.length > 0) {
        try {
          // Format phone number (Moolre sends as 233XXXXXXXXX, convert to 0XXXXXXXXX)
          let paymentPhone = String(payer).trim();
          if (paymentPhone.startsWith("233")) {
            paymentPhone = "0" + paymentPhone.substring(3);
          }
          
          console.log(`📱 Payment phone from Moolre: ${paymentPhone}`);
          const existingPhones = await storage.getSetting("paymentPhones");
          const phoneSet = new Set(existingPhones ? JSON.parse(existingPhones.value) : []);
          phoneSet.add(paymentPhone);
          await storage.upsertSetting("paymentPhones", JSON.stringify(Array.from(phoneSet)));
          console.log(`✅ Payment phone saved for SMS marketing: ${paymentPhone}`);
        } catch (phoneError) {
          console.error("Error saving payment phone:", phoneError);
        }
      }

      // Payment successful - find ALL orders with this reference and trigger fulfillment
      let updated = false;

      // Check FastNet orders - find ALL matching orders (bulk orders share same reference)
      const fastnetOrders = await storage.getFastnetOrders();
      const matchingFastnetOrders = fastnetOrders.filter(o => 
        (o.shortId === externalref || o.paymentReference === externalref) && o.status === "PENDING"
      );
      
      for (const fastnetOrder of matchingFastnetOrders) {
        console.log(`🚀 [MOOLRE WEBHOOK] Triggering FastNet fulfillment for order ${fastnetOrder.shortId} (ID: ${fastnetOrder.id})`);
        await storage.updateFastnetOrderStatus(fastnetOrder.id, "PAID", transactionid, message);
        
        // Trigger supplier fulfillment
        try {
          const fulfillmentResult = await supplierManager.purchaseDataBundle(
            fastnetOrder.customerPhone,
            fastnetOrder.packageDetails,
            fastnetOrder.packagePrice,
            fastnetOrder.shortId
          );
          if (fulfillmentResult.success) {
            await storage.updateFastnetOrderStatus(fastnetOrder.id, "PROCESSING", fulfillmentResult.supplier, JSON.stringify(fulfillmentResult.data || {}));
            polling.scheduleStatusCheck(fastnetOrder.id, fastnetOrder.shortId, "fastnet", 10000);
            console.log(`✅ [MOOLRE WEBHOOK] FastNet order ${fastnetOrder.shortId} sent to supplier`);
          } else {
            console.error(`❌ [MOOLRE WEBHOOK] FastNet fulfillment failed for ${fastnetOrder.shortId}:`, fulfillmentResult.message);
          }
        } catch (err) {
          console.error(`❌ [MOOLRE WEBHOOK] FastNet fulfillment error for ${fastnetOrder.shortId}:`, err);
        }
        updated = true;
      }

      // Check AT orders - find ALL matching orders
      const atOrders = await storage.getAtOrders();
      const matchingAtOrders = atOrders.filter(o => 
        (o.shortId === externalref || o.paymentReference === externalref) && o.status === "PENDING"
      );
      
      for (const atOrder of matchingAtOrders) {
        console.log(`🚀 [MOOLRE WEBHOOK] Triggering AT fulfillment for order ${atOrder.shortId} (ID: ${atOrder.id})`);
        await storage.updateAtOrderStatus(atOrder.id, "PAID", transactionid, message);
        
        // Trigger supplier fulfillment
        try {
          const fulfillmentResult = await supplierManager.purchaseDataBundle(
            atOrder.customerPhone,
            atOrder.packageDetails,
            atOrder.packagePrice,
            atOrder.shortId,
            "codecraft",
            "at_ishare"
          );
          if (fulfillmentResult.success) {
            const supplierRef = fulfillmentResult.data?.reference_id || null;
            await storage.updateAtOrderStatus(atOrder.id, "PROCESSING", fulfillmentResult.supplier, JSON.stringify(fulfillmentResult.data || {}), supplierRef);
            console.log(`✅ [MOOLRE WEBHOOK] AT order ${atOrder.shortId} sent to supplier`);
          } else {
            console.error(`❌ [MOOLRE WEBHOOK] AT fulfillment failed for ${atOrder.shortId}:`, fulfillmentResult.message);
          }
        } catch (err) {
          console.error(`❌ [MOOLRE WEBHOOK] AT fulfillment error for ${atOrder.shortId}:`, err);
        }
        updated = true;
      }

      // Check Telecel orders - find ALL matching orders
      const telecelOrders = await storage.getTelecelOrders();
      const matchingTelecelOrders = telecelOrders.filter(o => 
        (o.shortId === externalref || o.paymentReference === externalref) && o.status === "PENDING"
      );
      
      for (const telecelOrder of matchingTelecelOrders) {
        console.log(`🚀 [MOOLRE WEBHOOK] Triggering Telecel fulfillment for order ${telecelOrder.shortId} (ID: ${telecelOrder.id})`);
        await storage.updateTelecelOrderStatus(telecelOrder.id, "PAID", transactionid, message);
        
        // Trigger supplier fulfillment
        try {
          const fulfillmentResult = await supplierManager.purchaseDataBundle(
            telecelOrder.customerPhone,
            telecelOrder.packageDetails,
            telecelOrder.packagePrice,
            telecelOrder.shortId,
            "codecraft",
            "telecel"
          );
          if (fulfillmentResult.success) {
            const supplierRef = fulfillmentResult.data?.reference_id || null;
            await storage.updateTelecelOrderStatus(telecelOrder.id, "PROCESSING", fulfillmentResult.supplier, JSON.stringify(fulfillmentResult.data || {}), supplierRef);
            console.log(`✅ [MOOLRE WEBHOOK] Telecel order ${telecelOrder.shortId} sent to supplier`);
          } else {
            console.error(`❌ [MOOLRE WEBHOOK] Telecel fulfillment failed for ${telecelOrder.shortId}:`, fulfillmentResult.message);
          }
        } catch (err) {
          console.error(`❌ [MOOLRE WEBHOOK] Telecel fulfillment error for ${telecelOrder.shortId}:`, err);
        }
        updated = true;
      }

      // Check DataGod orders - find ALL matching orders (manual fulfillment - just update status)
      const datagodOrders = await storage.getDatagodOrders();
      const matchingDatagodOrders = datagodOrders.filter(o => 
        (o.shortId === externalref || o.paymentReference === externalref) && o.status === "PENDING"
      );
      
      for (const datagodOrder of matchingDatagodOrders) {
        console.log(`✅ [MOOLRE WEBHOOK] Updating DataGod order ${datagodOrder.shortId} to PAID`);
        await storage.updateDatagodOrderStatus(datagodOrder.id, "PAID");
        updated = true;
      }

      if (updated) {
        console.log(`✅ [MOOLRE WEBHOOK] Order ${externalref} processed successfully`);
        return res.status(200).json({ ok: true, externalref, message: "Order processed" });
      } else {
        console.warn(`⚠️ [MOOLRE WEBHOOK] Order ${externalref} not found or already processed`);
        return res.status(200).json({ ok: true, externalref, message: "Order not found or already processed" });
      }
    } catch (error) {
      console.error("❌ [MOOLRE WEBHOOK] Error:", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Moolre payment initiation endpoint
  app.post("/api/moolre/initiate", async (req: any, res) => {
    try {
      const { phone, amount, orderReference, network, otp } = req.body;

      if (!phone || !amount || !orderReference) {
        return res.status(400).json({ error: "Missing required fields: phone, amount, orderReference" });
      }

      console.log(`💳 [MOOLRE INITIATE] Phone: ${phone}, Amount: ${amount}, Ref: ${orderReference}, Network: ${network}, OTP: ${otp ? 'PROVIDED' : 'NONE'}`);

      // Call Moolre API to initiate payment (with optional OTP for verification)
      const result = await moolre.initiatePayment(phone, amount, orderReference, network || "mtn", otp);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("❌ [MOOLRE INITIATE] Error:", error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Payment initiation failed" 
      });
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
      const { whatsappLink, datagodEnabled, fastnetEnabled, atEnabled, telecelEnabled, afaEnabled, afaLink, announcementText, announcementLink, announcementSeverity, announcementActive, datagodTransactionCharge, fastnetTransactionCharge, atTransactionCharge, telecelTransactionCharge, fastnetActiveSupplier, atActiveSupplier, telecelActiveSupplier, smsEnabled, smsNotificationPhones, activePaymentGateway, christmasThemeEnabled } = req.body;
      
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
        activePaymentGateway,
        christmasThemeEnabled,
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
      const { phoneNumber, dataAmount, price, reference, gateway } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a UNIQUE shortId for each order, but keep the payment reference the same for bulk orders
      const uniqueShortId = `FN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
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

      // For Moolre, create as PENDING (payment not yet confirmed)
      // For Paystack or direct, create as PROCESSING (payment already confirmed)
      const initialStatus = gateway === 'moolre' ? "PENDING" : "PROCESSING";

      // Create order record in database with appropriate status
      // Each order gets unique shortId, but shares paymentReference for bulk orders
      const order = await storage.createFastnetOrder({
        shortId: uniqueShortId,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: roundedPrice,
        status: initialStatus,
        paymentReference: reference || null,
      });

      console.log(`📝 Order ${order.shortId} created for ${phoneNumber} - ${dataAmount}`);

      // For Moolre payments, don't fulfill yet - wait for webhook to confirm payment
      if (gateway === 'moolre') {
        console.log(`⏳ Moolre payment - order ${order.shortId} created as PENDING, awaiting payment confirmation`);
        return res.json({
          success: true,
          message: "Order created, awaiting payment confirmation",
          orderId: order.shortId,
          status: "PENDING",
        });
      }

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

      // Try to fulfill with supplier (Paystack - payment already confirmed)
      let fulfillmentResult;
      try {
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          uniqueShortId
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

  // Sync historical payment phones from Paystack and database orders (Admin only)
  app.post("/api/payment-phones/sync-history", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get existing phones before sync
      const existingSetting = await storage.getSetting("paymentPhones");
      const existingPhones = existingSetting ? JSON.parse(existingSetting.value) : [];
      const existingSet = new Set<string>(existingPhones);
      const previousCount = existingSet.size;
      
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      const paystackPhones = new Set<string>();
      const moolrePhones = new Set<string>();
      
      let paystackTransactions = 0;
      let paystackPages = 0;
      const detailedLog: string[] = [];
      let firstPageData: any = null;

      // ============ SYNC FROM PAYSTACK API ============
      if (paystackSecret) {
        console.log("🔄 Syncing payment phones from Paystack API...");
        detailedLog.push("=== PAYSTACK API SYNC ===");
        
        let page = 1;
        let hasMore = true;
        const batchSize = 50;
        const maxRetries = 3;

        while (hasMore) {
          let retryCount = 0;
          let pageSuccess = false;

          while (retryCount < maxRetries && !pageSuccess) {
            try {
              const url = `https://api.paystack.co/transaction?perPage=${batchSize}&page=${page}&status=success`;
              console.log(`📄 Fetching Paystack page ${page}...`);
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);
              
              const response = await fetch(url, {
                headers: { Authorization: `Bearer ${paystackSecret}` },
                signal: controller.signal,
              });

              clearTimeout(timeoutId);
              
              if (!response.ok) {
                if (response.status === 504 && retryCount < maxRetries - 1) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                }
                break;
              }

              const data = await response.json();
              
              if (page === 1) {
                firstPageData = {
                  dataLength: data.data?.length || 0,
                  pagination: data.meta?.pagination,
                };
              }

              if (!data.data || data.data.length === 0) {
                hasMore = false;
                pageSuccess = true;
                break;
              }

              // Extract phone numbers
              for (const transaction of data.data) {
                let foundPhone: string | null = null;
                
                // Check WireNet metadata first
                if (transaction.metadata?.wirenet?.items) {
                  for (const item of transaction.metadata.wirenet.items) {
                    if (item.phoneNumber) {
                      foundPhone = item.phoneNumber;
                      break;
                    }
                  }
                }
                
                // Fallback to standard Paystack fields
                if (!foundPhone) {
                  foundPhone = transaction.customer?.phone || 
                               transaction.metadata?.phone || 
                               transaction.authorization?.phone;
                }
                
                if (foundPhone) {
                  const phoneStr = String(foundPhone).trim();
                  if (phoneStr.length > 0 && phoneStr !== "null") {
                    paystackPhones.add(phoneStr);
                  }
                }
              }

              paystackTransactions += data.data.length;
              paystackPages++;
              
              if (data.meta?.pagination?.has_more) {
                page++;
              } else {
                hasMore = false;
              }
              
              pageSuccess = true;
            } catch (pageError) {
              if (retryCount < maxRetries - 1) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              break;
            }
          }

          if (!pageSuccess) break;
        }
        
        detailedLog.push(`Paystack: ${paystackTransactions} transactions, ${paystackPhones.size} phones`);
        console.log(`✅ Paystack sync: ${paystackTransactions} transactions, ${paystackPhones.size} phones`);
      } else {
        detailedLog.push("Paystack: SKIPPED (not configured)");
      }

      // ============ SYNC FROM DATABASE ORDERS (captures Moolre payments) ============
      console.log("🔄 Syncing payment phones from database orders (Moolre + others)...");
      detailedLog.push("=== DATABASE ORDERS SYNC ===");
      
      let dbOrdersCount = 0;
      
      // Get phones from FastNet orders
      const fastnetOrders = await storage.getFastnetOrders();
      for (const order of fastnetOrders) {
        if (order.customerPhone) {
          let phone = String(order.customerPhone).trim();
          if (phone.startsWith("233")) phone = "0" + phone.substring(3);
          if (phone.length > 0) {
            moolrePhones.add(phone);
            dbOrdersCount++;
          }
        }
      }
      
      // Get phones from AT orders
      const atOrders = await storage.getAtOrders();
      for (const order of atOrders) {
        if (order.customerPhone) {
          let phone = String(order.customerPhone).trim();
          if (phone.startsWith("233")) phone = "0" + phone.substring(3);
          if (phone.length > 0) {
            moolrePhones.add(phone);
            dbOrdersCount++;
          }
        }
      }
      
      // Get phones from Telecel orders
      const telecelOrders = await storage.getTelecelOrders();
      for (const order of telecelOrders) {
        if (order.customerPhone) {
          let phone = String(order.customerPhone).trim();
          if (phone.startsWith("233")) phone = "0" + phone.substring(3);
          if (phone.length > 0) {
            moolrePhones.add(phone);
            dbOrdersCount++;
          }
        }
      }
      
      // Get phones from DataGod orders
      const datagodOrders = await storage.getDatagodOrders();
      for (const order of datagodOrders) {
        if (order.customerPhone) {
          let phone = String(order.customerPhone).trim();
          if (phone.startsWith("233")) phone = "0" + phone.substring(3);
          if (phone.length > 0) {
            moolrePhones.add(phone);
            dbOrdersCount++;
          }
        }
      }
      
      detailedLog.push(`Database: ${dbOrdersCount} orders, ${moolrePhones.size} unique phones`);
      console.log(`✅ Database sync: ${dbOrdersCount} orders, ${moolrePhones.size} unique phones`);

      // ============ MERGE ALL PHONES ============
      for (const phone of paystackPhones) existingSet.add(phone);
      for (const phone of moolrePhones) existingSet.add(phone);
      
      const newCount = existingSet.size - previousCount;

      // Update the setting with merged list
      await storage.upsertSetting("paymentPhones", JSON.stringify(Array.from(existingSet)));

      console.log("📋 SYNC SUMMARY:");
      console.log(`   Paystack phones: ${paystackPhones.size}`);
      console.log(`   Database phones: ${moolrePhones.size}`);
      console.log(`   Phones before sync: ${previousCount}`);
      console.log(`   Phones after sync: ${existingSet.size}`);
      console.log(`   New phones added: ${newCount}`);

      res.json({
        success: true,
        message: `Synced from Paystack (${paystackTransactions} txns) and database (${dbOrdersCount} orders)`,
        totalPhones: existingSet.size,
        newPhonesAdded: newCount,
        previousCount,
        paystackPhones: paystackPhones.size,
        databasePhones: moolrePhones.size,
        totalTransactionsFetched: paystackTransactions,
        totalPagesFetched: paystackPages,
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
      const { phoneNumber, dataAmount, price, reference, gateway } = req.body;
      
      console.log("📝 DataGod purchase request:", { phoneNumber, dataAmount, price, reference, gateway });
      
      if (!phoneNumber || !dataAmount || !price) {
        console.error("❌ Missing required fields:", { phoneNumber, dataAmount, price });
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a UNIQUE shortId for each order
      const uniqueShortId = `DG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // For Moolre, create as PENDING (webhook will update to PAID)
      // For Paystack, create as PAID (payment already confirmed before this call)
      const initialStatus = gateway === 'moolre' ? "PENDING" : "PAID";
      
      const order = await storage.createDatagodOrder({
        shortId: uniqueShortId,
        customerPhone: phoneNumber,
        packageName: dataAmount,
        packagePrice: typeof price === 'string' ? parseFloat(price) : price,
        status: initialStatus,
        paymentReference: reference || null,
      });

      console.log(`✅ DataGod order created via purchase (${initialStatus}):`, order);

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
      const { phoneNumber, dataAmount, price, reference, gateway } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a UNIQUE shortId for each order
      const uniqueShortId = `AT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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

      // For Moolre, create as PENDING (payment not yet confirmed)
      // For Paystack or direct, create as PROCESSING (payment already confirmed)
      const initialStatus = gateway === 'moolre' ? "PENDING" : "PROCESSING";

      const order = await storage.createAtOrder({
        shortId: uniqueShortId,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: initialStatus,
        paymentReference: reference || null,
      });

      console.log(`📝 AT Order ${order.shortId} created with ID ${order.id} for ${phoneNumber} - ${dataAmount}`);

      // For Moolre payments, don't fulfill yet - wait for webhook to confirm payment
      if (gateway === 'moolre') {
        console.log(`⏳ Moolre payment - AT order ${order.shortId} created as PENDING, awaiting payment confirmation`);
        return res.json({
          success: true,
          message: "Order created, awaiting payment confirmation",
          orderId: order.shortId,
          status: "PENDING",
        });
      }

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

      // Paystack - payment already confirmed, proceed to fulfill
      let fulfillmentResult;
      try {
        console.log(`🔄 Starting AT fulfillment for order ${order.id}...`);
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          uniqueShortId,
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
      const { phoneNumber, dataAmount, price, reference, gateway } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a UNIQUE shortId for each order
      const uniqueShortId = `TC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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

      // For Moolre, create as PENDING (payment not yet confirmed)
      // For Paystack or direct, create as PROCESSING (payment already confirmed)
      const initialStatus = gateway === 'moolre' ? "PENDING" : "PROCESSING";

      const order = await storage.createTelecelOrder({
        shortId: uniqueShortId,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: initialStatus,
        paymentReference: reference || null,
      });

      console.log(`📝 TELECEL Order ${order.shortId} created with ID ${order.id} for ${phoneNumber} - ${dataAmount}`);

      // For Moolre payments, don't fulfill yet - wait for webhook to confirm payment
      if (gateway === 'moolre') {
        console.log(`⏳ Moolre payment - Telecel order ${order.shortId} created as PENDING, awaiting payment confirmation`);
        return res.json({
          success: true,
          message: "Order created, awaiting payment confirmation",
          orderId: order.shortId,
          status: "PENDING",
        });
      }

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

      // Paystack - payment already confirmed, proceed to fulfill
      let fulfillmentResult;
      try {
        console.log(`🔄 Starting Telecel fulfillment for order ${order.id}...`);
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          uniqueShortId,
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

  // ============ SHOP SYSTEM ROUTES ============

  // User authentication middleware (separate from admin)
  const isUserAuthenticated = (req: any, res: any, next: any) => {
    if (req.session?.shopUser) {
      req.shopUser = req.session.shopUser;
      return next();
    }
    res.status(401).json({ message: "Please login to continue" });
  };

  // User signup
  app.post("/api/user/signup", async (req, res) => {
    try {
      // Check if registration is open
      const registrationOpen = await storage.getSetting("shopRegistrationOpen");
      if (registrationOpen?.value === "false") {
        return res.status(403).json({ message: "Shop registration is currently closed" });
      }

      const { email, password, name, phone, shopName, shopSlug } = req.body;

      if (!email || !password || !name || !phone) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check if user already exists
      let existingUser;
      try {
        existingUser = await storage.getShopUserByEmail(email);
      } catch (dbError: any) {
        // If shop_users table doesn't exist, the shop system isn't set up
        if (dbError.code === '42703' || dbError.code === '42P01') {
          console.error("Shop system tables not found. Run the migration: drizzle/0004_add_shop_system.sql");
          return res.status(503).json({ message: "Shop registration is not available yet. Please try again later." });
        }
        throw dbError;
      }
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Validate shop slug
      if (!shopName || !shopSlug) {
        return res.status(400).json({ message: "Shop name and slug are required" });
      }

      const slugRegex = /^[a-z0-9-]+$/;
      const normalizedSlug = shopSlug.toLowerCase().trim();
      if (!slugRegex.test(normalizedSlug)) {
        return res.status(400).json({ message: "Shop slug can only contain lowercase letters, numbers, and hyphens" });
      }

      if (normalizedSlug.length < 3 || normalizedSlug.length > 30) {
        return res.status(400).json({ message: "Shop slug must be 3-30 characters" });
      }

      // Check if slug already taken
      const existingShop = await storage.getShopBySlug(normalizedSlug);
      if (existingShop) {
        return res.status(400).json({ message: "Shop URL is already taken" });
      }

      // Reserved slugs
      const reservedSlugs = ["admin", "api", "shop", "dashboard", "login", "signup", "settings", "fastnet", "datagod", "at", "telecel"];
      if (reservedSlugs.includes(normalizedSlug)) {
        return res.status(400).json({ message: "This shop URL is reserved" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create shop user
      const user = await storage.createShopUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        phone,
        status: "active"
      });

      // Create shop
      const shop = await storage.createShop({
        userId: user.id,
        shopName,
        slug: normalizedSlug,
        status: "pending"
      });

      res.status(201).json({
        message: "Account created successfully! Your shop is pending approval.",
        user: { id: user.id, email: user.email, name: user.name },
        shop: { id: shop.id, shopName: shop.shopName, slug: shop.slug, status: shop.status }
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // User login
  app.post("/api/user/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      let user;
      try {
        user = await storage.getShopUserByEmail(email.toLowerCase());
      } catch (dbError: any) {
        console.error("Database error during login:", dbError);
        if (dbError.code === '42P01' || dbError.code === '42703') {
          return res.status(503).json({ message: "Shop system not available. Please contact support." });
        }
        throw dbError;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.status === "suspended") {
        return res.status(403).json({ message: "Your account has been suspended" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get user's shop
      let shop = null;
      try {
        shop = await storage.getShopByUserId(user.id);
      } catch (shopError: any) {
        console.error("Error fetching shop:", shopError);
        // Continue without shop if tables don't exist
      }

      (req.session as any).shopUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        shopId: shop?.id,
        shopSlug: shop?.slug,
        shopStatus: shop?.status
      };

      res.json({
        message: "Login successful",
        user: { id: user.id, email: user.email, name: user.name },
        shop: shop ? { id: shop.id, shopName: shop.shopName, slug: shop.slug, status: shop.status } : null
      });
    } catch (error) {
      console.error("User login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // User logout
  app.post("/api/user/logout", (req, res) => {
    delete (req.session as any).shopUser;
    res.json({ message: "Logged out successfully" });
  });

  // Get current user
  app.get("/api/user/me", isUserAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getShopUserById(req.shopUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let shop = null;
      let stats = null;
      
      try {
        shop = await storage.getShopByUserId(user.id);
        stats = shop ? await storage.getShopStats(shop.id) : null;
      } catch (err: any) {
        // Tables might not exist yet
        if (err.code !== '42P01' && err.code !== '42703') {
          throw err;
        }
      }

      res.json({
        user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
        shop: shop ? {
          id: shop.id,
          shopName: shop.shopName,
          slug: shop.slug,
          description: shop.description,
          logo: shop.logo,
          status: shop.status,
          totalEarnings: shop.totalEarnings,
          availableBalance: shop.availableBalance
        } : null,
        stats
      });
    } catch (error: any) {
      console.error("Get user error:", error);
      // Handle missing tables gracefully
      if (error.code === '42P01' || error.code === '42703') {
        return res.status(503).json({ message: "Shop system not yet configured" });
      }
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // Update shop details
  app.put("/api/shop/settings", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const { shopName, description, logo } = req.body;
      const updates: any = {};
      if (shopName) updates.shopName = shopName;
      if (description !== undefined) updates.description = description;
      if (logo !== undefined) updates.logo = logo;

      const updated = await storage.updateShop(shop.id, updates);
      res.json({ message: "Shop updated", shop: updated });
    } catch (error) {
      console.error("Update shop error:", error);
      res.status(500).json({ message: "Failed to update shop" });
    }
  });

  // Get shop packages with markups (for shop owner)
  app.get("/api/shop/packages", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        // Return empty packages if shop not found
        return res.json({ datagod: [], at: [], telecel: [] });
      }

      // Get all base packages
      const datagodPackages = await storage.getDatagodPackages();
      const atPackages = await storage.getAtPackages();
      const telecelPackages = await storage.getTelecelPackages();

      // Get shop's configurations (may fail if table doesn't exist)
      let configs: any[] = [];
      try {
        configs = await storage.getShopPackageConfigs(shop.id);
      } catch (configErr: any) {
        console.log("Shop package configs not available:", configErr.code);
      }
      const configMap = new Map(configs.map(c => [`${c.serviceType}-${c.packageId}`, c]));

      const packagesWithMarkups = {
        datagod: datagodPackages.map(p => ({
          id: p.id,
          name: p.packageName,
          basePrice: p.priceGHS,
          serviceType: "datagod",
          config: configMap.get(`datagod-${p.id}`) || { markupAmount: 0, isEnabled: true }
        })),
        at: atPackages.map(p => ({
          id: p.id,
          name: p.dataAmount,
          basePrice: p.price,
          serviceType: "at",
          config: configMap.get(`at-${p.id}`) || { markupAmount: 0, isEnabled: true }
        })),
        telecel: telecelPackages.map(p => ({
          id: p.id,
          name: p.dataAmount,
          basePrice: p.price,
          serviceType: "telecel",
          config: configMap.get(`telecel-${p.id}`) || { markupAmount: 0, isEnabled: true }
        }))
      };

      res.json(packagesWithMarkups);
    } catch (error: any) {
      console.error("Get shop packages error:", error);
      // Return empty packages on any error
      res.json({ datagod: [], at: [], telecel: [] });
    }
  });

  // Update shop package config (markup and visibility)
  app.put("/api/shop/packages", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const { serviceType, packageId, markupAmount, isEnabled } = req.body;

      if (!serviceType || !packageId) {
        return res.status(400).json({ message: "Service type and package ID are required" });
      }

      const config = await storage.upsertShopPackageConfig({
        shopId: shop.id,
        serviceType,
        packageId: parseInt(packageId, 10), // Ensure packageId is integer
        markupAmount: markupAmount || 0,
        isEnabled: isEnabled !== false
      });

      res.json({ message: "Package config updated", config });
    } catch (error) {
      console.error("Update package config error:", error);
      res.status(500).json({ message: "Failed to update package config" });
    }
  });

  // Bulk update shop package configs
  app.put("/api/shop/packages/bulk", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const { configs } = req.body;
      if (!Array.isArray(configs)) {
        return res.status(400).json({ message: "Configs must be an array" });
      }

      const results = [];
      for (const c of configs) {
        const config = await storage.upsertShopPackageConfig({
          shopId: shop.id,
          serviceType: c.serviceType,
          packageId: parseInt(c.packageId, 10), // Ensure packageId is integer
          markupAmount: c.markupAmount || 0,
          isEnabled: c.isEnabled !== false
        });
        results.push(config);
      }

      res.json({ message: "Package configs updated", configs: results });
    } catch (error) {
      console.error("Bulk update package config error:", error);
      res.status(500).json({ message: "Failed to update package configs" });
    }
  });

  // Get shop orders
  app.get("/api/shop/orders", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.json({ orders: [], total: 0 });
      }

      let allOrders: any[] = [];
      
      try {
        const [datagod, fastnet, at, telecel] = await Promise.all([
          storage.getShopDatagodOrders(shop.id).catch(() => []),
          storage.getShopFastnetOrders(shop.id).catch(() => []),
          storage.getShopAtOrders(shop.id).catch(() => []),
          storage.getShopTelecelOrders(shop.id).catch(() => [])
        ]);

        // Combine and sort by date
        allOrders = [
          ...datagod.map(o => ({ ...o, service: "datagod" })),
          ...fastnet.map(o => ({ ...o, service: "fastnet" })),
          ...at.map(o => ({ ...o, service: "at" })),
          ...telecel.map(o => ({ ...o, service: "telecel" }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (orderErr: any) {
        console.log("Error fetching shop orders:", orderErr.code);
      }

      res.json({ orders: allOrders, total: allOrders.length });
    } catch (error: any) {
      console.error("Get shop orders error:", error);
      res.json({ orders: [], total: 0 });
    }
  });

  // Get shop stats
  app.get("/api/shop/stats", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.json({ totalOrders: 0, totalEarnings: 0, availableBalance: 0, pendingWithdrawals: 0 });
      }

      try {
        const stats = await storage.getShopStats(shop.id);
        res.json(stats);
      } catch (statsError: any) {
        // If columns don't exist yet, return defaults
        if (statsError.code === '42703' || statsError.code === '42P01') {
          return res.json({
            totalOrders: 0,
            totalEarnings: shop.totalEarnings || 0,
            availableBalance: shop.availableBalance || 0,
            pendingWithdrawals: 0
          });
        }
        throw statsError;
      }
    } catch (error: any) {
      console.error("Get shop stats error:", error);
      if (error.code === '42703' || error.code === '42P01') {
        return res.json({ totalOrders: 0, totalEarnings: 0, availableBalance: 0, pendingWithdrawals: 0 });
      }
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Request withdrawal
  app.post("/api/withdrawals/request", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      if (shop.status !== "approved") {
        return res.status(403).json({ message: "Your shop must be approved to request withdrawals" });
      }

      const { amount, bankName, accountNumber, accountName } = req.body;

      if (!amount || !bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Get withdrawal settings
      const settings = await storage.getSettings();
      const minWithdrawal = parseFloat((settings as any).minWithdrawalAmount || "10");
      const withdrawalFee = parseFloat((settings as any).withdrawalFee || "0");

      if (amount < minWithdrawal) {
        return res.status(400).json({ message: `Minimum withdrawal amount is GHS ${minWithdrawal}` });
      }

      if (amount > shop.availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const netAmount = amount - withdrawalFee;

      const withdrawal = await storage.createWithdrawal({
        shopId: shop.id,
        amount,
        fee: withdrawalFee,
        netAmount,
        bankName,
        accountNumber,
        accountName,
        status: "pending"
      });

      // Deduct from available balance (still in total earnings)
      await storage.deductShopBalance(shop.id, amount);

      res.status(201).json({
        message: "Withdrawal request submitted",
        withdrawal
      });
    } catch (error) {
      console.error("Withdrawal request error:", error);
      res.status(500).json({ message: "Failed to request withdrawal" });
    }
  });

  // Get withdrawal history
  app.get("/api/withdrawals", isUserAuthenticated, async (req: any, res) => {
    try {
      const shop = await storage.getShopByUserId(req.shopUser.id);
      if (!shop) {
        return res.json({ withdrawals: [] });
      }

      let withdrawals: any[] = [];
      try {
        withdrawals = await storage.getWithdrawalsByShop(shop.id);
      } catch (wErr: any) {
        console.log("Error fetching withdrawals:", wErr.code);
      }
      
      res.json({ withdrawals });
    } catch (error: any) {
      console.error("Get withdrawals error:", error);
      res.json({ withdrawals: [] });
    }
  });

  // ============ PUBLIC SHOP STOREFRONT ROUTES ============

  // Get shop by slug (public)
  app.get("/api/shop/:slug", async (req, res) => {
    try {
      const shop = await storage.getShopBySlug(req.params.slug);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      if (shop.status !== "approved") {
        return res.status(404).json({ message: "Shop not available" });
      }

      res.json({
        id: shop.id,
        shopName: shop.shopName,
        slug: shop.slug,
        description: shop.description,
        logo: shop.logo
      });
    } catch (error) {
      console.error("Get shop error:", error);
      res.status(500).json({ message: "Failed to get shop" });
    }
  });

  // Get shop packages (public - for storefront)
  app.get("/api/shop/:slug/packages", async (req, res) => {
    try {
      const shop = await storage.getShopBySlug(req.params.slug);
      if (!shop || shop.status !== "approved") {
        return res.status(404).json({ message: "Shop not found" });
      }

      const service = req.query.service as string;

      // Get shop's package configs (may fail if table doesn't exist)
      let configs: any[] = [];
      try {
        if (service) {
          configs = await storage.getShopPackageConfigsByService(shop.id, service);
        } else {
          configs = await storage.getShopPackageConfigs(shop.id);
        }
      } catch (configErr: any) {
        console.log("Shop package configs not available:", configErr.code);
        // Continue with empty configs - will use base prices
      }

      // Get base packages and apply markups
      const result: any = {};

      if (!service || service === "fastnet") {
        // FastNet uses the same packages structure - get from settings or use DataGod as base
        // For now, return empty array since FastNet doesn't have separate package table
        result.fastnet = [];
      }

      if (!service || service === "datagod") {
        const packages = await storage.getDatagodPackages();
        result.datagod = packages
          .filter(p => p.isEnabled)
          .map(p => {
            const config = configs.find(c => c.serviceType === "datagod" && c.packageId === p.id);
            if (config && !config.isEnabled) return null;
            return {
              id: p.id,
              packageName: p.packageName,
              dataValueGB: p.dataValueGB,
              basePrice: p.priceGHS,
              price: p.priceGHS + (config?.markupAmount || 0),
              markup: config?.markupAmount || 0
            };
          })
          .filter(Boolean);
      }

      if (!service || service === "at") {
        const packages = await storage.getAtPackages();
        result.at = packages
          .filter(p => p.isEnabled)
          .map(p => {
            const config = configs.find(c => c.serviceType === "at" && c.packageId === p.id);
            if (config && !config.isEnabled) return null;
            return {
              id: p.id,
              dataAmount: p.dataAmount,
              deliveryTime: p.deliveryTime,
              basePrice: p.price,
              price: p.price + (config?.markupAmount || 0),
              markup: config?.markupAmount || 0
            };
          })
          .filter(Boolean);
      }

      if (!service || service === "telecel") {
        const packages = await storage.getTelecelPackages();
        result.telecel = packages
          .filter(p => p.isEnabled)
          .map(p => {
            const config = configs.find(c => c.serviceType === "telecel" && c.packageId === p.id);
            if (config && !config.isEnabled) return null;
            return {
              id: p.id,
              dataAmount: p.dataAmount,
              deliveryTime: p.deliveryTime,
              basePrice: p.price,
              price: p.price + (config?.markupAmount || 0),
              markup: config?.markupAmount || 0
            };
          })
          .filter(Boolean);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Get shop packages error:", error);
      // Return empty result instead of 500 error
      const service = req.query.service as string;
      const emptyResult: any = {};
      if (!service || service === "fastnet") emptyResult.fastnet = [];
      if (!service || service === "datagod") emptyResult.datagod = [];
      if (!service || service === "at") emptyResult.at = [];
      if (!service || service === "telecel") emptyResult.telecel = [];
      res.json(emptyResult);
    }
  });

  // ============ ADMIN SHOP MANAGEMENT ROUTES ============

  // Get all shops (admin)
  app.get("/api/admin/shops", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const status = req.query.status as string;
      let shopsList;
      
      if (status) {
        shopsList = await storage.getShopsByStatus(status);
      } else {
        shopsList = await storage.getAllShops();
      }

      // Enrich with user info and stats
      const enrichedShops = await Promise.all(shopsList.map(async (shop) => {
        const user = await storage.getShopUserById(shop.userId);
        const stats = await storage.getShopStats(shop.id);
        return {
          ...shop,
          owner: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
          stats
        };
      }));

      res.json({ shops: enrichedShops });
    } catch (error: any) {
      console.error("Get shops error:", error);
      // Return empty array if tables don't exist yet
      if (error.code === '42P01' || error.code === '42703') {
        return res.json({ shops: [] });
      }
      res.status(500).json({ message: "Failed to get shops" });
    }
  });

  // Get shop details (admin)
  app.get("/api/admin/shops/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      const data = await storage.getShopWithUser(shopId);
      
      if (!data) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const stats = await storage.getShopStats(shopId);
      const withdrawals = await storage.getWithdrawalsByShop(shopId);

      res.json({
        shop: data.shop,
        owner: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          status: data.user.status
        },
        stats,
        withdrawals
      });
    } catch (error) {
      console.error("Get shop details error:", error);
      res.status(500).json({ message: "Failed to get shop details" });
    }
  });

  // Approve shop (admin)
  app.put("/api/admin/shops/:id/approve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      const shop = await storage.updateShop(shopId, { status: "approved" });
      
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json({ message: "Shop approved", shop });
    } catch (error) {
      console.error("Approve shop error:", error);
      res.status(500).json({ message: "Failed to approve shop" });
    }
  });

  // Ban shop (admin)
  app.put("/api/admin/shops/:id/ban", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      const shop = await storage.updateShop(shopId, { status: "banned" });
      
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json({ message: "Shop banned", shop });
    } catch (error) {
      console.error("Ban shop error:", error);
      res.status(500).json({ message: "Failed to ban shop" });
    }
  });

  // Suspend user (admin)
  app.put("/api/admin/users/:id/suspend", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.updateShopUser(userId, { status: "suspended" });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User suspended", user });
    } catch (error) {
      console.error("Suspend user error:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  // Get all withdrawals (admin)
  app.get("/api/admin/withdrawals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const status = req.query.status as string;
      let withdrawalsList;
      
      if (status) {
        withdrawalsList = await storage.getWithdrawalsByStatus(status);
      } else {
        withdrawalsList = await storage.getAllWithdrawals();
      }

      // Enrich with shop info
      const enrichedWithdrawals = await Promise.all(withdrawalsList.map(async (w) => {
        const shop = await storage.getShopById(w.shopId);
        const user = shop ? await storage.getShopUserById(shop.userId) : null;
        return {
          ...w,
          shop: shop ? { id: shop.id, shopName: shop.shopName, slug: shop.slug } : null,
          owner: user ? { name: user.name, email: user.email, phone: user.phone } : null
        };
      }));

      res.json({ withdrawals: enrichedWithdrawals });
    } catch (error: any) {
      console.error("Get withdrawals error:", error);
      // Return empty array if tables don't exist yet
      if (error.code === '42P01' || error.code === '42703') {
        return res.json({ withdrawals: [] });
      }
      res.status(500).json({ message: "Failed to get withdrawals" });
    }
  });

  // Update withdrawal status (admin)
  app.put("/api/admin/withdrawals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      const { status, adminNote } = req.body;

      if (!["pending", "processing", "completed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updates: any = { status };
      if (adminNote !== undefined) updates.adminNote = adminNote;
      if (status === "completed") updates.processedAt = new Date();

      // If rejecting, refund the amount back to shop balance
      if (status === "rejected") {
        const withdrawal = await storage.getWithdrawalById(withdrawalId);
        if (withdrawal && withdrawal.status === "pending") {
          await storage.updateShopBalance(withdrawal.shopId, withdrawal.amount);
        }
      }

      const withdrawal = await storage.updateWithdrawal(withdrawalId, updates);
      
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      res.json({ message: `Withdrawal ${status}`, withdrawal });
    } catch (error) {
      console.error("Update withdrawal error:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });

  // Update shop settings (admin) - min withdrawal, fees, registration status
  app.put("/api/admin/shop-settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { minWithdrawalAmount, withdrawalFee, shopRegistrationOpen } = req.body;

      if (minWithdrawalAmount !== undefined) {
        await storage.upsertSetting("minWithdrawalAmount", String(minWithdrawalAmount));
      }
      if (withdrawalFee !== undefined) {
        await storage.upsertSetting("withdrawalFee", String(withdrawalFee));
      }
      if (shopRegistrationOpen !== undefined) {
        await storage.upsertSetting("shopRegistrationOpen", String(shopRegistrationOpen));
      }

      res.json({ message: "Shop settings updated" });
    } catch (error) {
      console.error("Update shop settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Get shop settings (admin)
  app.get("/api/admin/shop-settings", async (req, res) => {
    try {
      const minWithdrawal = await storage.getSetting("minWithdrawalAmount");
      const withdrawalFee = await storage.getSetting("withdrawalFee");
      const registrationOpen = await storage.getSetting("shopRegistrationOpen");

      res.json({
        minWithdrawalAmount: parseFloat(minWithdrawal?.value || "10"),
        withdrawalFee: parseFloat(withdrawalFee?.value || "0"),
        shopRegistrationOpen: registrationOpen?.value !== "false" // Default to true
      });
    } catch (error) {
      console.error("Get shop settings error:", error);
      res.status(500).json({ message: "Failed to get settings" });
    }
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
