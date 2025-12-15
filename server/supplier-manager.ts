/**
 * Supplier Manager - Central routing for multi-supplier fulfillment
 * Routes orders to the active supplier (DataXpress, Hubnet, or DataKazina)
 */

import * as dataxpress from "./dataxpress.js";
import * as hubnet from "./hubnet.js";
import * as dakazina from "./dakazina.js";
import { storage } from "./storage.js";

export type SupplierName = "dataxpress" | "hubnet" | "dakazina";

/**
 * Get the currently active supplier from settings
 */
async function getActiveSupplier(): Promise<SupplierName> {
  try {
    // Check fastnetActiveSupplier first (used by admin settings)
    const setting = await storage.getSetting("fastnetActiveSupplier");
    if (setting && (setting.value === "dataxpress" || setting.value === "hubnet" || setting.value === "dakazina")) {
      return setting.value as SupplierName;
    }
    // Fallback to legacy activeSupplier key
    const legacySetting = await storage.getSetting("activeSupplier");
    if (legacySetting && (legacySetting.value === "dataxpress" || legacySetting.value === "hubnet" || legacySetting.value === "dakazina")) {
      return legacySetting.value as SupplierName;
    }
    // Default to dataxpress if no setting found
    return "dataxpress";
  } catch (error) {
    console.error("Failed to get active supplier, defaulting to dataxpress:", error);
    return "dataxpress";
  }
}

/**
 * Purchase a data bundle using the specified supplier or active supplier
 * @param phoneNumber Customer phone number
 * @param dataAmount Package size (e.g., "5GB")
 * @param price Wholesale cost
 * @param orderReference Order reference
 * @param supplier Optional: specific supplier to use (defaults to active supplier)
 */
export async function purchaseDataBundle(
  phoneNumber: string,
  dataAmount: string,
  price: number,
  orderReference: string,
  supplier?: SupplierName
): Promise<{ success: boolean; message: string; data?: any; supplier: SupplierName }> {
  const targetSupplier = supplier || await getActiveSupplier();
  
  console.log(`📡 Using ${targetSupplier.toUpperCase()} for order ${orderReference}`);

  let result;
  if (targetSupplier === "hubnet") {
    result = await hubnet.purchaseDataBundle(phoneNumber, dataAmount, price, orderReference);
  } else if (targetSupplier === "dakazina") {
    result = await dakazina.purchaseDataBundle(phoneNumber, dataAmount, price, orderReference);
  } else {
    result = await dataxpress.purchaseDataBundle(phoneNumber, dataAmount, price, orderReference);
  }

  return {
    ...result,
    supplier: targetSupplier,
  };
}

/**
 * Get wallet balance from a specific supplier
 */
export async function getWalletBalance(
  supplier: SupplierName
): Promise<{
  success: boolean;
  balance?: string;
  currency?: string;
  message?: string;
}> {
  if (supplier === "hubnet") {
    return await hubnet.getWalletBalance();
  } else if (supplier === "dakazina") {
    return await dakazina.getWalletBalance();
  } else {
    return await dataxpress.getWalletBalance();
  }
}

/**
 * Get cost price from a specific supplier
 */
export async function getCostPrice(
  supplier: SupplierName,
  dataAmount: string
): Promise<{ success: boolean; costPrice?: number; message?: string }> {
  if (supplier === "hubnet") {
    return await hubnet.getCostPrice(dataAmount);
  } else if (supplier === "dakazina") {
    return await dakazina.getCostPrice(dataAmount);
  } else {
    return await dataxpress.getCostPrice(dataAmount);
  }
}

/**
 * Get the currently active supplier name
 */
export async function getActiveSupplierName(): Promise<SupplierName> {
  return await getActiveSupplier();
}

/**
 * Set the active supplier
 */
export async function setActiveSupplier(supplier: SupplierName): Promise<void> {
  // Update both keys for consistency
  await storage.upsertSetting("fastnetActiveSupplier", supplier);
  await storage.upsertSetting("activeSupplier", supplier);
  console.log(`✅ Active supplier changed to: ${supplier.toUpperCase()}`);
}

/**
 * Check order/transaction status from a specific supplier
 * @param supplier The supplier to query
 * @param reference The order reference or transaction ID
 */
export async function checkOrderStatus(
  supplier: SupplierName,
  reference: string
): Promise<{ success: boolean; status?: string; message?: string; data?: any; supplier: SupplierName }> {
  console.log(`🔍 Checking order status from ${supplier.toUpperCase()} for reference: ${reference}`);

  let result;
  if (supplier === "hubnet") {
    result = await hubnet.checkTransactionStatus(reference);
  } else if (supplier === "dakazina") {
    result = await dakazina.checkTransactionStatus(reference);
  } else {
    result = await dataxpress.checkOrderStatus(reference);
  }

  return {
    ...result,
    supplier,
  };
}
