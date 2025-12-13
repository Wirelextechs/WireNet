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

  // Purchase Data Bundle
  app.post("/api/fastnet/purchase", async (req, res) => {
    console.log("🚀 [API] Received purchase request");
    try {
      console.log("📦 [API] Request body:", JSON.stringify(req.body, null, 2));
      const { phoneNumber, dataAmount, price } = req.body;
      
      if (!phoneNumber || !dataAmount || !price) {
        console.error("❌ [API] Missing required fields:", { phoneNumber, dataAmount, price });
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate a unique reference
      const orderReference = `FN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      console.log(`🆔 [API] Generated order reference: ${orderReference}`);

      // Call supplier manager to fulfill order
      console.log("🔄 [API] Calling supplier manager...");
      const result = await supplierManager.purchaseDataBundle(
        phoneNumber,
        dataAmount,
        price,
        orderReference
      );
      console.log("✅ [API] Supplier manager result:", JSON.stringify(result, null, 2));

      if (result.success) {
        res.json({ success: true, message: "Order fulfilled successfully", data: result });
      } else {
        console.error(`❌ [API] Order fulfillment failed: ${result.message}`);
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      console.error("🔥 [API] FastNet purchase CRITICAL error:", error);
      // Ensure we return JSON even on crash
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get Wallet Balances (Admin only)
  app.get("/api/fastnet/balances", async (req, res) => {
    try {
      console.log("💰 [API] Fetching wallet balances...");
      const [dataxpress, hubnet, dakazina] = await Promise.all([
        supplierManager.getWalletBalance("dataxpress"),
        supplierManager.getWalletBalance("hubnet"),
        supplierManager.getWalletBalance("dakazina")
      ]);
      
      console.log("💰 [API] Balances fetched:", { dataxpress, hubnet, dakazina });

      res.json({
        dataxpress,
        hubnet,
        dakazina
      });
    } catch (error) {
      console.error("🔥 [API] Error fetching balances:", error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });

  // Set Active Supplier (Admin only)
  app.post("/api/fastnet/supplier", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { supplier } = req.body;
      console.log(`🔄 [API] Setting active supplier to: ${supplier}`);
      
      if (supplier !== "dataxpress" && supplier !== "hubnet" && supplier !== "dakazina") {
        return res.status(400).json({ message: "Invalid supplier" });
      }
      
      await supplierManager.setActiveSupplier(supplier);
      res.json({ success: true, message: `Active supplier set to ${supplier}` });
    } catch (error) {
      console.error("🔥 [API] Error setting supplier:", error);
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
