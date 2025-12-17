import { Express } from "express";
import { createServer, Server } from "http";
import { storage } from "./storage.js";
import { isAuthenticated, isAdmin, login } from "./auth.js";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import * as supplierManager from "./supplier-manager.js";

const PgStore = pgSession(session);

const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Vercel/production environments
  app.set("trust proxy", 1);

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
      const { whatsappLink, datagodEnabled, fastnetEnabled, atEnabled, telecelEnabled, afaEnabled, afaLink, datagodTransactionCharge, fastnetTransactionCharge, atTransactionCharge, telecelTransactionCharge, fastnetActiveSupplier, atActiveSupplier, telecelActiveSupplier } = req.body;

      const updated = await storage.updateSettings({
        whatsappLink,
        datagodEnabled,
        fastnetEnabled,
        atEnabled,
        telecelEnabled,
        afaEnabled,
        afaLink,
        datagodTransactionCharge,
        fastnetTransactionCharge,
        atTransactionCharge,
        telecelTransactionCharge,
        fastnetActiveSupplier,
        atActiveSupplier,
        telecelActiveSupplier,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
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

      // Create order record in database FIRST with status PAID
      const order = await storage.createFastnetOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 Order ${order.shortId} created for ${phoneNumber} - ${dataAmount}`);

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
      const order = await storage.getFastnetOrderByShortId(shortId);
      
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
      const { shortId, customerPhone, packageName, packagePrice, status, paymentReference } = req.body;
      
      if (!customerPhone || !packageName || !packagePrice) {
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

      res.json({ success: true, order });
    } catch (error: any) {
      console.error("Error creating DataGod order:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get DataGod Order Status (Public - for customers to check their order)
  app.get("/api/datagod/orders/status/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      const order = await storage.getDatagodOrderByShortId(shortId);
      
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
      res.json(packages);
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

      const order = await storage.createAtOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 AT Order ${order.shortId} created for ${phoneNumber} - ${dataAmount}`);

      let fulfillmentResult;
      try {
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          orderReference,
          "codecraft",
          "at_ishare"
        );

        if (fulfillmentResult.success) {
          await storage.updateAtOrderStatus(
            order.id, 
            "PROCESSING", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {})
          );
        } else {
          await storage.updateAtOrderStatus(
            order.id, 
            "PAID",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error("AT Fulfillment error:", fulfillError);
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
      const orders = await storage.getAtOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching AT orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
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

      const order = await storage.createTelecelOrder({
        shortId: orderReference,
        customerPhone: phoneNumber,
        packageDetails: dataAmount,
        packagePrice: typeof price === 'string' ? parseInt(price) : price,
        status: "PROCESSING",
        paymentReference: reference || null,
      });

      console.log(`📝 TELECEL Order ${order.shortId} created for ${phoneNumber} - ${dataAmount}`);

      let fulfillmentResult;
      try {
        fulfillmentResult = await supplierManager.purchaseDataBundle(
          phoneNumber,
          dataAmount,
          price,
          orderReference,
          "codecraft",
          "telecel"
        );

        if (fulfillmentResult.success) {
          await storage.updateTelecelOrderStatus(
            order.id, 
            "PROCESSING", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {})
          );
        } else {
          await storage.updateTelecelOrderStatus(
            order.id, 
            "PAID",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error("TELECEL Fulfillment error:", fulfillError);
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
      const orders = await storage.getTelecelOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching TELECEL orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
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
