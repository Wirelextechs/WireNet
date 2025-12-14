import { Express } from "express";
import { createServer, Server } from "http";
import { storage } from "./storage";
import { isAuthenticated, isAdmin, login } from "./auth";
import session from "express-session";
import MemoryStore from "memorystore";
import * as supplierManager from "./supplier-manager";

const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      store: new MemoryStoreSession({
        checkPeriod: 86400000,
      }),
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await login(username, password);

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
      const { whatsappLink, datagodEnabled, fastnetEnabled } = req.body;

      const updated = await storage.updateSettings({
        whatsappLink,
        datagodEnabled,
        fastnetEnabled,
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
        status: "PAID",
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
        if (fulfillmentResult.success) {
          await storage.updateFastnetOrderStatus(
            order.id, 
            "FULFILLED", 
            fulfillmentResult.supplier,
            JSON.stringify(fulfillmentResult.data || {})
          );
        } else {
          await storage.updateFastnetOrderStatus(
            order.id, 
            "PROCESSING",
            fulfillmentResult.supplier,
            fulfillmentResult.message
          );
        }
      } catch (fulfillError: any) {
        console.error("Fulfillment error (order still created):", fulfillError);
        await storage.updateFastnetOrderStatus(
          order.id, 
          "PROCESSING",
          undefined,
          fulfillError.message
        );
        fulfillmentResult = { success: false, message: fulfillError.message };
      }

      // Always return success since order was created (payment was successful)
      res.json({ 
        success: true, 
        message: fulfillmentResult.success ? "Order fulfilled successfully" : "Order created, fulfillment pending",
        orderId: order.shortId,
        fulfilled: fulfillmentResult.success,
        data: fulfillmentResult 
      });
    } catch (error: any) {
      console.error("FastNet purchase error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
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

  // Set Active Supplier (Admin only)
  app.post("/api/fastnet/supplier", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { supplier } = req.body;
      if (supplier !== "dataxpress" && supplier !== "hubnet" && supplier !== "dakazina") {
        return res.status(400).json({ message: "Invalid supplier" });
      }
      
      await supplierManager.setActiveSupplier(supplier);
      res.json({ success: true, message: `Active supplier set to ${supplier}` });
    } catch (error) {
      console.error("Error setting supplier:", error);
      res.status(500).json({ message: "Failed to set supplier" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const server = createServer(app);
  return server;
}
