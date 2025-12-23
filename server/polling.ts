/**
 * Background Order Status Polling Service
 * - Fast polling (2 min) for recent orders (< 30 min old)
 * - Standard polling (10 min) for older orders
 * - Immediate status check after pushing to supplier
 */

import { storage } from "./storage.js";
import * as codecraft from "./codecraft.js";
import * as supplierManager from "./supplier-manager.js";

const FAST_POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes for recent orders
const STANDARD_POLLING_INTERVAL = 10 * 60 * 1000; // 10 minutes for older orders
const RECENT_ORDER_THRESHOLD = 30 * 60 * 1000; // Orders < 30 min are "recent"
let pollingActive = false;

export async function startStatusPolling() {
  if (pollingActive) return;
  
  pollingActive = true;
  console.log("🔄 Order status polling started (fast: 2min, standard: 10min)");

  // Run immediately on startup
  await pollOrderStatuses();

  // Fast polling for recent orders (every 2 minutes)
  setInterval(async () => {
    console.log("⚡ Fast polling for recent orders...");
    await pollRecentOrders();
  }, FAST_POLLING_INTERVAL);

  // Standard polling for all orders (every 10 minutes)
  setInterval(pollOrderStatuses, STANDARD_POLLING_INTERVAL);
}

/**
 * Poll only recent orders (created in last 30 minutes)
 */
async function pollRecentOrders() {
  const cutoffTime = new Date(Date.now() - RECENT_ORDER_THRESHOLD);
  
  try {
    // Check FastNet recent orders
    const fastnetOrders = await storage.getFastnetOrders();
    const recentFastnet = fastnetOrders.filter(o => 
      o.status === "PROCESSING" && new Date(o.createdAt) > cutoffTime
    );
    
    if (recentFastnet.length > 0) {
      console.log(`⚡ [FASTNET] Checking ${recentFastnet.length} recent orders...`);
      for (const order of recentFastnet) {
        await checkAndUpdateOrderStatus(order, "fastnet");
      }
    }

    // Check AT recent orders
    const atOrders = await storage.getAtOrders();
    const recentAt = atOrders.filter(o => 
      o.status === "PROCESSING" && new Date(o.createdAt) > cutoffTime
    );
    
    if (recentAt.length > 0) {
      console.log(`⚡ [AT] Checking ${recentAt.length} recent orders...`);
      for (const order of recentAt) {
        await checkAndUpdateOrderStatus(order, "at");
      }
    }

    // Check Telecel recent orders
    const telecelOrders = await storage.getTelecelOrders();
    const recentTelecel = telecelOrders.filter(o => 
      o.status === "PROCESSING" && new Date(o.createdAt) > cutoffTime
    );
    
    if (recentTelecel.length > 0) {
      console.log(`⚡ [TELECEL] Checking ${recentTelecel.length} recent orders...`);
      for (const order of recentTelecel) {
        await checkAndUpdateOrderStatus(order, "telecel");
      }
    }
  } catch (error) {
    console.error("❌ Error in fast polling:", error);
  }
}

/**
 * Check order status from CodeCraft and update if changed
 */
async function checkAndUpdateOrderStatus(
  order: any, 
  category: "fastnet" | "at" | "telecel"
): Promise<boolean> {
  const referenceId = order.supplierReference || order.shortId;
  
  if (!referenceId) {
    console.log(`⚠️ [${category.toUpperCase()}] Order ${order.shortId} has no reference, skipping status check`);
    return false;
  }

  try {
    const network = category === "at" ? "at_ishare" : category === "telecel" ? "telecel" : "mtn";
    console.log(`🔍 [${category.toUpperCase()}] Checking status for ${order.shortId} (ref: ${referenceId})...`);
    
    const statusResult = await codecraft.checkOrderStatus(referenceId, network);

    if (statusResult.success && statusResult.status) {
      const newStatus = normalizeStatus(statusResult.status);
      
      console.log(`📊 [${category.toUpperCase()}] Order ${order.shortId}: "${statusResult.status}" → ${newStatus}`);

      if (newStatus !== "PROCESSING" && newStatus !== order.status) {
        console.log(`✅ [${category.toUpperCase()}] Updating order ${order.shortId}: ${order.status} → ${newStatus}`);
        
        if (category === "fastnet") {
          await storage.updateFastnetOrderStatus(order.id, newStatus);
        } else if (category === "at") {
          await storage.updateAtOrderStatus(order.id, newStatus);
        } else {
          await storage.updateTelecelOrderStatus(order.id, newStatus);
        }
        return true;
      }
    }
  } catch (err) {
    console.error(`❌ [${category.toUpperCase()}] Error checking order ${order.shortId}:`, err);
  }
  return false;
}

/**
 * Schedule a delayed status check for an order
 * Called after successfully pushing an order to supplier
 */
export function scheduleStatusCheck(
  orderId: number,
  shortId: string, 
  category: "fastnet" | "at" | "telecel",
  delayMs: number = 10000 // Default 10 seconds
) {
  console.log(`⏰ [${category.toUpperCase()}] Scheduling status check for ${shortId} in ${delayMs/1000}s...`);
  
  setTimeout(async () => {
    try {
      console.log(`⏰ [${category.toUpperCase()}] Running scheduled status check for ${shortId}...`);
      
      // Fetch fresh order data
      let order;
      if (category === "fastnet") {
        const orders = await storage.getFastnetOrders();
        order = orders.find(o => o.id === orderId);
      } else if (category === "at") {
        const orders = await storage.getAtOrders();
        order = orders.find(o => o.id === orderId);
      } else {
        const orders = await storage.getTelecelOrders();
        order = orders.find(o => o.id === orderId);
      }

      if (order && order.status === "PROCESSING") {
        const updated = await checkAndUpdateOrderStatus(order, category);
        
        // If still processing, schedule another check in 30 seconds
        if (!updated) {
          console.log(`⏰ [${category.toUpperCase()}] Order ${shortId} still processing, will check again in 30s...`);
          scheduleStatusCheck(orderId, shortId, category, 30000);
        }
      } else if (order) {
        console.log(`✅ [${category.toUpperCase()}] Order ${shortId} already ${order.status}, no check needed`);
      }
    } catch (err) {
      console.error(`❌ [${category.toUpperCase()}] Scheduled check error for ${shortId}:`, err);
    }
  }, delayMs);
}

export async function pollOrderStatuses() {
  try {
    console.log("🔍 Starting automatic order status check...");
    
    // Process FASTNET orders first (push them to supplier)
    await processFastnetOrders();
    
    // Process AT and Telecel orders (push and check status)
    await processAtOrders();
    await processTelecelOrders();
    
    console.log("✅ Order status check completed");
  } catch (error) {
    console.error("❌ Error during order status polling:", error);
  }
}

/**
 * Poll only FastNet orders (for FastNet refresh button)
 */
export async function pollFastnetOrders() {
  try {
    console.log("🔍 [FASTNET] Starting FastNet order status check...");
    await processFastnetOrders();
    console.log("✅ [FASTNET] FastNet order status check completed");
  } catch (error) {
    console.error("❌ [FASTNET] Error:", error);
  }
}

/**
 * Poll only AT orders (for AT refresh button)
 */
export async function pollAtOrders() {
  try {
    console.log("🔍 [AT] Starting AT order status check...");
    await processAtOrders();
    console.log("✅ [AT] AT order status check completed");
  } catch (error) {
    console.error("❌ [AT] Error:", error);
  }
}

/**
 * Poll only Telecel orders (for Telecel refresh button)
 */
export async function pollTelecelOrders() {
  try {
    console.log("🔍 [TELECEL] Starting Telecel order status check...");
    await processTelecelOrders();
    console.log("✅ [TELECEL] Telecel order status check completed");
  } catch (error) {
    console.error("❌ [TELECEL] Error:", error);
  }
}

async function processFastnetOrders() {
  try {
    console.log("🔄 [FASTNET] Starting to process FastNet orders...");
    
    // Get all FASTNET orders with PROCESSING status
    const allOrders = await storage.getFastnetOrders();
    console.log(`🔄 [FASTNET] Retrieved ${allOrders.length} total FastNet orders from DB`);
    
    const processingOrders = allOrders.filter(o => o.status === "PROCESSING");
    console.log(`🔄 [FASTNET] Found ${processingOrders.length} PROCESSING orders`);

    if (processingOrders.length === 0) {
      console.log("ℹ️  [FASTNET] No PROCESSING FASTNET orders to process");
      return;
    }

    console.log(`📋 [FASTNET] Processing ${processingOrders.length} FASTNET PROCESSING orders...`);

    for (const order of processingOrders) {
      try {
        console.log(`📤 [FASTNET] Processing order: ID=${order.id}, ShortID=${order.shortId}, Phone=${order.customerPhone}, Package=${order.packageDetails}, Price=${order.packagePrice}, Status=${order.status}`);
        
        // Push order to the active supplier
        console.log(`📤 [FASTNET] Calling supplierManager.purchaseDataBundle for ${order.shortId}...`);
        const purchaseResult = await supplierManager.purchaseDataBundle(
          order.customerPhone,
          order.packageDetails,
          order.packagePrice,
          order.shortId,
          undefined, // Use active supplier
          "mtn" // Default network for fastnet
        );

        console.log(`📤 [FASTNET] Supplier result for ${order.shortId}: success=${purchaseResult.success}, supplier=${purchaseResult.supplier}, message=${purchaseResult.message}`);

        if (purchaseResult.success) {
          console.log(`✅ [FASTNET] Order ${order.shortId} successfully pushed to ${purchaseResult.supplier}`);
          
          // Update order status to PAID (pushed to supplier)
          console.log(`💾 [FASTNET] Updating DB: order ${order.id} status=PAID, supplier=${purchaseResult.supplier}`);
          const updateResult = await storage.updateFastnetOrderStatus(
            order.id,
            "PAID",
            purchaseResult.supplier,
            purchaseResult.message
          );
          console.log(`💾 [FASTNET] DB Update result: ${updateResult ? 'SUCCESS' : 'FAILED'}`);
        } else {
          console.error(`❌ [FASTNET] Order ${order.shortId} failed: ${purchaseResult.message}`);
          
          // Update with error status
          console.log(`💾 [FASTNET] Updating DB: order ${order.id} status=FAILED, supplier=${purchaseResult.supplier}`);
          const updateResult = await storage.updateFastnetOrderStatus(
            order.id,
            "FAILED",
            purchaseResult.supplier,
            purchaseResult.message
          );
          console.log(`💾 [FASTNET] DB Update result: ${updateResult ? 'SUCCESS' : 'FAILED'}`);
        }
      } catch (err) {
        console.error(`❌ [FASTNET] Exception processing order ${order.shortId}:`, err);
        
        // Update with error
        try {
          console.log(`💾 [FASTNET] Updating DB: order ${order.id} status=FAILED due to exception`);
          const updateResult = await storage.updateFastnetOrderStatus(
            order.id,
            "FAILED",
            "unknown",
            String(err)
          );
          console.log(`💾 [FASTNET] DB Update result: ${updateResult ? 'SUCCESS' : 'FAILED'}`);
        } catch (updateErr) {
          console.error(`💾 [FASTNET] Failed to update order status in DB:`, updateErr);
        }
      }
    }
    console.log("✅ [FASTNET] Finished processing FastNet orders");
  } catch (error) {
    console.error("❌ [FASTNET] Error processing FASTNET orders:", error);
  }
}

/**
 * Process AT orders - push to supplier if not pushed, check status if pushed
 */
async function processAtOrders() {
  try {
    console.log("🔄 [AT] Starting to process AT orders...");
    
    const allOrders = await storage.getAtOrders();
    const processingOrders = allOrders.filter(o => o.status === "PROCESSING");
    
    if (processingOrders.length === 0) {
      console.log("ℹ️  [AT] No PROCESSING orders to process");
      return;
    }
    
    console.log(`📋 [AT] Processing ${processingOrders.length} orders...`);
    
    for (const order of processingOrders) {
      try {
        // If order hasn't been pushed to supplier yet, push it now
        // AT orders ALWAYS use CodeCraft (not the active supplier)
        if (!order.supplierReference && !order.supplierUsed) {
          console.log(`📤 [AT] Pushing order ${order.shortId} to CodeCraft...`);
          
          // Use CodeCraft directly for AT orders
          const result = await codecraft.purchaseDataBundle(
            order.customerPhone,
            order.packageDetails.toUpperCase(), // CodeCraft needs uppercase like "2GB"
            order.packagePrice,
            order.shortId,
            "at" // AT network
          );
          
          if (result.success) {
            console.log(`✅ [AT] Order ${order.shortId} pushed to CodeCraft`);
            await storage.updateAtOrderStatus(order.id, "PROCESSING", "codecraft", result.message);
            // Schedule status check
            scheduleStatusCheck(order.id, order.shortId, "at", 10000);
          } else {
            console.log(`❌ [AT] Order ${order.shortId} failed: ${result.message}`);
            await storage.updateAtOrderStatus(order.id, "FAILED", "codecraft", result.message);
          }
        } 
        // If order has been pushed, check its status
        else if (order.supplierUsed === "codecraft") {
          console.log(`🔍 [AT] Checking status for order ${order.shortId}...`);
          
          const statusResult = await codecraft.checkOrderStatus(order.shortId, "at_ishare");
          
          if (statusResult.success && statusResult.status) {
            const newStatus = normalizeStatus(statusResult.status);
            
            if (newStatus !== "PROCESSING" && newStatus !== order.status) {
              console.log(`✅ [AT] Order ${order.shortId}: ${order.status} → ${newStatus}`);
              await storage.updateAtOrderStatus(order.id, newStatus);
            }
          }
        }
      } catch (err) {
        console.error(`❌ [AT] Error processing order ${order.shortId}:`, err);
      }
    }
    
    console.log("✅ [AT] Finished processing AT orders");
  } catch (error) {
    console.error("❌ [AT] Error:", error);
  }
}

/**
 * Process Telecel orders - push to supplier if not pushed, check status if pushed
 */
async function processTelecelOrders() {
  try {
    console.log("🔄 [TELECEL] Starting to process Telecel orders...");
    
    const allOrders = await storage.getTelecelOrders();
    const processingOrders = allOrders.filter(o => o.status === "PROCESSING");
    
    if (processingOrders.length === 0) {
      console.log("ℹ️  [TELECEL] No PROCESSING orders to process");
      return;
    }
    
    console.log(`📋 [TELECEL] Processing ${processingOrders.length} orders...`);
    
    for (const order of processingOrders) {
      try {
        // If order hasn't been pushed to supplier yet, push it now
        // Telecel orders ALWAYS use CodeCraft (not the active supplier)
        if (!order.supplierReference && !order.supplierUsed) {
          console.log(`📤 [TELECEL] Pushing order ${order.shortId} to CodeCraft...`);
          
          // Use CodeCraft directly for Telecel orders
          const result = await codecraft.purchaseDataBundle(
            order.customerPhone,
            order.packageDetails.toUpperCase(), // CodeCraft needs uppercase like "5GB"
            order.packagePrice,
            order.shortId,
            "telecel" // Telecel network
          );
          
          if (result.success) {
            console.log(`✅ [TELECEL] Order ${order.shortId} pushed to CodeCraft`);
            await storage.updateTelecelOrderStatus(order.id, "PROCESSING", "codecraft", result.message);
            // Schedule status check
            scheduleStatusCheck(order.id, order.shortId, "telecel", 10000);
          } else {
            console.log(`❌ [TELECEL] Order ${order.shortId} failed: ${result.message}`);
            await storage.updateTelecelOrderStatus(order.id, "FAILED", "codecraft", result.message);
          }
        } 
        // If order has been pushed, check its status
        else if (order.supplierUsed === "codecraft") {
          console.log(`🔍 [TELECEL] Checking status for order ${order.shortId}...`);
          
          const statusResult = await codecraft.checkOrderStatus(order.shortId, "telecel");
          
          if (statusResult.success && statusResult.status) {
            const newStatus = normalizeStatus(statusResult.status);
            
            if (newStatus !== "PROCESSING" && newStatus !== order.status) {
              console.log(`✅ [TELECEL] Order ${order.shortId}: ${order.status} → ${newStatus}`);
              await storage.updateTelecelOrderStatus(order.id, newStatus);
            }
          }
        }
      } catch (err) {
        console.error(`❌ [TELECEL] Error processing order ${order.shortId}:`, err);
      }
    }
    
    console.log("✅ [TELECEL] Finished processing Telecel orders");
  } catch (error) {
    console.error("❌ [TELECEL] Error:", error);
  }
}

async function checkCategoryOrders(category: "at" | "telecel") {
  try {
    // Get all orders for this category
    const allOrders = category === "at" 
      ? await storage.getAtOrders() 
      : await storage.getTelecelOrders();

    // Filter for PROCESSING orders only
    const processingOrders = allOrders.filter(o => o.status === "PROCESSING");

    if (processingOrders.length === 0) {
      console.log(`ℹ️  No PROCESSING ${category.toUpperCase()} orders to check`);
      return;
    }

    console.log(`📋 Checking ${processingOrders.length} PROCESSING ${category.toUpperCase()} orders...`);

    for (const order of processingOrders) {
      try {
        const supplierRef = order.supplierReference || null;
        
        if (!supplierRef) {
          console.warn(`⚠️  Order ${order.shortId} has no supplier reference, skipping`);
          continue;
        }

        console.log(`🔍 Checking order ${order.shortId} with reference ${supplierRef}...`);
        
        const network = category === "at" ? "at_ishare" : "telecel";
        const statusResult = await codecraft.checkOrderStatus(supplierRef, network);

        if (statusResult.success && statusResult.status) {
          const newStatus = normalizeStatus(statusResult.status);
          
          console.log(`📊 Order ${order.shortId}: Code Craft status = "${statusResult.status}" (type: ${typeof statusResult.status}) → normalized = ${newStatus}`);
          console.log(`📋 Current order status in DB: ${order.status}`);
          
          if (newStatus !== "PROCESSING") {
            console.log(`✅ Updating order ${order.shortId}: ${order.status} → ${newStatus}`);
            
            // Update using storage methods
            if (category === "at") {
              await storage.updateAtOrderStatus(order.id, newStatus);
            } else {
              await storage.updateTelecelOrderStatus(order.id, newStatus);
            }
          } else {
            console.log(`⏳ Order ${order.shortId} still PROCESSING - status didn't map to FULFILLED/FAILED`);
          }
        } else {
          console.warn(`⚠️  Failed to get status for order ${order.shortId}: ${statusResult.message}`);
        }
      } catch (err) {
        console.error(`❌ Error checking order ${order.shortId}:`, err);
      }
    }
  } catch (error) {
    console.error(`❌ Error checking ${category} orders:`, error);
  }
}

function normalizeStatus(coderaftStatus: string | number): "FULFILLED" | "PROCESSING" | "FAILED" {
  // Convert to string if it's a number
  const statusStr = String(coderaftStatus).toLowerCase().trim();
  
  console.log(`🔍 Normalizing status: "${coderaftStatus}" (type: ${typeof coderaftStatus}, normalized: "${statusStr}")`);
  
  // FULFILLED statuses - based on Code Craft API documentation
  // API returns: "Successful", "Crediting successful", "Data successfully delivered"
  if (statusStr.includes("successful") ||     // "Successful" or "Crediting successful"
      statusStr.includes("delivered") ||      // "Data successfully delivered"
      statusStr.includes("completed") ||      // "Completed"
      statusStr.includes("fulfilled") ||      // "Fulfilled"
      statusStr.includes("credited") ||       // "Credited"
      statusStr === "1" ||                    // Numeric code: 1 = Fulfilled
      statusStr === "200") {                  // HTTP 200 = Success
    console.log(`✅ Mapped to FULFILLED`);
    return "FULFILLED";
  } 
  // FAILED statuses - based on Code Craft documentation
  // API code 100, 101, 102, 103, 500, 555 = failures
  else if (statusStr.includes("failed") || 
           statusStr.includes("error") || 
           statusStr.includes("cancelled") ||
           statusStr.includes("cancel") ||
           statusStr.includes("out of stock") ||
           statusStr.includes("low wallet") ||
           statusStr.includes("not found") ||
           statusStr === "0" ||                // Numeric code: 0 = Failed
           statusStr === "100" ||              // Low wallet balance
           statusStr === "101" ||              // Out of stock
           statusStr === "102" ||              // Agent not found
           statusStr === "103" ||              // Price not found
           statusStr === "500" ||              // Different error messages
           statusStr === "555") {              // Network not found
    console.log(`❌ Mapped to FAILED`);
    return "FAILED";
  }
  
  console.log(`⏳ Mapped to PROCESSING (unknown status)`);
  return "PROCESSING";
}

/**
 * Manual status check for a single order
 */
export async function checkSingleOrderStatus(
  category: "at" | "telecel",
  orderId: string
): Promise<{ success: boolean; message: string; newStatus?: string }> {
  try {
    // Get the order
    const order = category === "at"
      ? await storage.getAtOrderById(parseInt(orderId))
      : await storage.getTelecelOrderById(parseInt(orderId));

    if (!order) {
      return { success: false, message: "Order not found" };
    }
    
    const supplierRef = order.supplierReference || null;
    
    if (!supplierRef) {
      return { success: false, message: "Order has no supplier reference" };
    }

    console.log(`🔍 Manual status check for order ${order.shortId}...`);
    
    const network = category === "at" ? "at_ishare" : "telecel";
    const statusResult = await codecraft.checkOrderStatus(supplierRef, network);

    if (statusResult.success && statusResult.status) {
      const newStatus = normalizeStatus(statusResult.status);
      
      console.log(`📊 Order ${order.shortId}: ${order.status} → ${newStatus}`);
      
      if (newStatus !== order.status) {
        if (category === "at") {
          await storage.updateAtOrderStatus(order.id, newStatus);
        } else {
          await storage.updateTelecelOrderStatus(order.id, newStatus);
        }
        
        console.log(`✅ Order ${order.shortId}: Updated to ${newStatus}`);
        return {
          success: true,
          message: `Order updated to ${newStatus}`,
          newStatus
        };
      } else {
        return {
          success: true,
          message: `Order status: ${newStatus}`,
          newStatus
        };
      }
    } else {
      return {
        success: false,
        message: statusResult.message || "Failed to fetch status from supplier"
      };
    }
  } catch (error) {
    console.error("Error checking order status:", error);
    return {
      success: false,
      message: "Error checking order status"
    };
  }
}
