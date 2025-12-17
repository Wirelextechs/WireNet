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
    // Check AT orders
    await checkCategoryOrders("at");
    
    // Check TELECEL orders
    await checkCategoryOrders("telecel");
  } catch (error) {
    console.error("❌ Error during order status polling:", error);
  }
}

async function checkCategoryOrders(category: "at" | "telecel") {
  try {
    const tableName = category === "at" ? "at_orders" : "telecel_orders";
    
    // Get all PROCESSING orders
    const { rows: orders } = await storage.db.query(
      `SELECT id, short_id, supplier_reference FROM ${tableName} WHERE status = $1 ORDER BY created_at DESC LIMIT 50`,
      ["PROCESSING"]
    );

    if (orders.length === 0) return;

    console.log(`📋 Checking ${orders.length} PROCESSING ${category.toUpperCase()} orders...`);

    for (const order of orders) {
      try {
        const statusResult = await supplierManager.checkOrderStatus(category, order.supplier_reference);

        if (statusResult.success && statusResult.status) {
          const newStatus = normalizeStatus(statusResult.status);
          
          if (newStatus !== "PROCESSING") {
            console.log(`✅ Order ${order.short_id}: ${statusResult.status} → updating to ${newStatus}`);
            
            await storage.db.query(
              `UPDATE ${tableName} SET status = $1, updated_at = NOW() WHERE id = $2`,
              [newStatus, order.id]
            );
          }
        }
      } catch (err) {
        console.error(`Error checking order ${order.short_id}:`, err);
      }
    }
  } catch (error) {
    console.error(`Error checking ${category} orders:`, error);
  }
}

function normalizeStatus(coderaftStatus: string): "FULFILLED" | "PROCESSING" | "FAILED" {
  const status = coderaftStatus.toLowerCase();
  
  if (status.includes("delivered") || status.includes("successful") || status.includes("fulfilled")) {
    return "FULFILLED";
  } else if (status.includes("failed") || status.includes("error")) {
    return "FAILED";
  }
  
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
    const tableName = category === "at" ? "at_orders" : "telecel_orders";
    
    const { rows } = await storage.db.query(
      `SELECT id, short_id, supplier_reference, status FROM ${tableName} WHERE id = $1`,
      [orderId]
    );

    if (rows.length === 0) {
      return { success: false, message: "Order not found" };
    }

    const order = rows[0];
    
    console.log(`🔍 Manual status check for order ${order.short_id}...`);
    
    const statusResult = await supplierManager.checkOrderStatus(category, order.supplier_reference);

    if (statusResult.success && statusResult.status) {
      const newStatus = normalizeStatus(statusResult.status);
      
      if (newStatus !== order.status) {
        await storage.db.query(
          `UPDATE ${tableName} SET status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, orderId]
        );
        
        console.log(`✅ Order ${order.short_id}: Updated from ${order.status} to ${newStatus}`);
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
