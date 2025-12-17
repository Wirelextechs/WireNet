/**
 * Background Order Status Polling Service
 * Automatically checks PROCESSING orders against Code Craft every 10 minutes
 */

import { storage } from "./storage.js";
import * as supplierManager from "./supplier-manager.js";

const POLLING_INTERVAL = 10 * 60 * 1000; // 10 minutes
let pollingActive = false;

export async function startStatusPolling() {
  if (pollingActive) return;
  
  pollingActive = true;
  console.log("🔄 Order status polling started (interval: 10 minutes)");

  // Run immediately on startup
  await pollOrderStatuses();

  // Then run periodically
  setInterval(pollOrderStatuses, POLLING_INTERVAL);
}

export async function pollOrderStatuses() {
  try {
    console.log("🔍 Starting automatic order status check...");
    
    // Check AT orders
    await checkCategoryOrders("at");
    
    // Check TELECEL orders
    await checkCategoryOrders("telecel");
    
    console.log("✅ Order status check completed");
  } catch (error) {
    console.error("❌ Error during order status polling:", error);
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
        const supplierRef = order.supplierReference || order.supplier_reference;
        
        if (!supplierRef) {
          console.warn(`⚠️  Order ${order.shortId} has no supplier reference, skipping`);
          continue;
        }

        console.log(`🔍 Checking order ${order.shortId} with reference ${supplierRef}...`);
        
        const statusResult = await supplierManager.checkOrderStatus(category, supplierRef);

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
    
    const supplierRef = order.supplierReference || order.supplier_reference;
    
    if (!supplierRef) {
      return { success: false, message: "Order has no supplier reference" };
    }

    console.log(`🔍 Manual status check for order ${order.shortId}...`);
    
    const statusResult = await supplierManager.checkOrderStatus(category, supplierRef);

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
