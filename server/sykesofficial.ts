/**
 * SykesOfficial API Integration
 * https://sykesofficial.net
 * 
 * Used for FastNet orders and DataGod auto-fulfillment
 */

const SYKESOFFICIAL_BASE_URL = "https://sykesofficial.net";
const API_KEY = process.env.SYKESOFFICIAL_API_KEY;

if (!API_KEY) {
  console.warn("⚠️  SYKESOFFICIAL_API_KEY not set - SykesOfficial order fulfillment will be disabled");
}

/**
 * Extract package size in GB from data amount string
 * @param dataAmount - Package size like "1GB", "5GB", "10GB"
 * @returns Size in GB (e.g., 5 for "5GB")
 */
function extractPackageSizeGB(dataAmount: string): number {
  const match = dataAmount.match(/^(\d+)GB$/i);
  if (!match) {
    throw new Error(`Invalid data amount format: ${dataAmount}`);
  }
  return parseInt(match[1]);
}

/**
 * Normalize phone number to format accepted by SykesNet API
 * Accepts: 0241234567, 241234567, 233241234567
 * Removes: +, spaces, dashes
 */
function normalizePhoneNumber(phone: string): string {
  // Remove any + prefix, spaces, or dashes
  let cleaned = phone.replace(/[+\s-]/g, "");
  
  // If it starts with 233 (country code), keep as is
  if (cleaned.startsWith("233")) {
    return cleaned;
  }
  
  // If it's 9 digits, add leading 0
  if (cleaned.length === 9) {
    return "0" + cleaned;
  }
  
  // Return as-is (should be 10 digits starting with 0)
  return cleaned;
}

interface SykesOrderRequest {
  recipient_phone: string;
  network: "MTN" | "Telecel" | "AirtelTigo";
  size_gb: number;
}

interface SykesResponse {
  success: boolean;
  order_id?: number;
  message: string;
}

interface SykesBalanceResponse {
  success: boolean;
  balance?: number;
  message?: string;
}

/**
 * Purchase a data bundle via SykesOfficial
 * @param phoneNumber - Customer's phone number
 * @param dataAmount - Package size like "5GB" OR numeric GB value
 * @param price - Supplier cost (for logging purposes)
 * @param orderReference - Unique order reference
 * @param sizeGB - Optional: direct GB value (overrides dataAmount parsing)
 */
export async function purchaseDataBundle(
  phoneNumber: string,
  dataAmount: string,
  price: number,
  orderReference: string,
  sizeGB?: number
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!API_KEY) {
    return {
      success: false,
      message: "SykesOfficial API key not configured",
    };
  }

  try {
    // Use provided sizeGB or extract from dataAmount string
    const packageSizeGB = sizeGB ?? extractPackageSizeGB(dataAmount);
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const requestBody: SykesOrderRequest = {
      recipient_phone: normalizedPhone,
      network: "MTN",
      size_gb: packageSizeGB,
    };

    console.log(`📡 Sending data order to SykesOfficial:`, {
      phone: normalizedPhone,
      dataAmount: dataAmount,
      size_gb: packageSizeGB,
      supplierCost: price,
      ref: orderReference,
    });

    const response = await fetch(`${SYKESOFFICIAL_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: SykesResponse = await response.json();

    if (!response.ok) {
      console.error(`❌ SykesOfficial API error (HTTP ${response.status}):`, result);
      return {
        success: false,
        message: result.message || `API request failed with status ${response.status}`,
      };
    }

    if (result.success) {
      console.log(`✅ SykesOfficial order successful:`, {
        order_id: result.order_id,
        message: result.message,
      });
      return {
        success: true,
        message: result.message,
        data: {
          order_id: result.order_id,
          supplier_reference: String(result.order_id),
        },
      };
    } else {
      console.error(`❌ SykesOfficial order failed:`, result.message);
      return {
        success: false,
        message: result.message,
      };
    }
  } catch (error) {
    console.error(`❌ SykesOfficial API error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check SykesOfficial wallet balance
 */
export async function getWalletBalance(): Promise<{
  success: boolean;
  balance?: string;
  currency?: string;
  message?: string;
}> {
  if (!API_KEY) {
    return {
      success: false,
      message: "SykesOfficial API key not configured",
    };
  }

  try {
    const response = await fetch(`${SYKESOFFICIAL_BASE_URL}/api/balance`, {
      method: "GET",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
    });

    const result: SykesBalanceResponse = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        message: result.message || "Failed to fetch wallet balance",
      };
    }

    return {
      success: true,
      balance: result.balance !== undefined ? String(result.balance) : "0",
      currency: "GHS",
    };
  } catch (error) {
    console.error(`❌ Failed to fetch SykesOfficial wallet balance:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get order history from SykesOfficial
 * @param limit - Number of orders to return (default: 20)
 * @param offset - Number of orders to skip (default: 0)
 */
export async function getOrderHistory(
  limit: number = 20,
  offset: number = 0
): Promise<{ success: boolean; orders?: any[]; message?: string }> {
  if (!API_KEY) {
    return {
      success: false,
      message: "SykesOfficial API key not configured",
    };
  }

  try {
    const response = await fetch(
      `${SYKESOFFICIAL_BASE_URL}/api/orders?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: {
          "X-API-KEY": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        message: result.message || "Failed to fetch order history",
      };
    }

    return {
      success: true,
      orders: result.orders || [],
    };
  } catch (error) {
    console.error(`❌ Failed to fetch SykesOfficial order history:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get cost price for a data package
 * Note: SykesNet doesn't have a dedicated cost price endpoint,
 * so this returns a placeholder. Actual pricing should be configured in admin.
 */
export async function getCostPrice(
  _dataAmount: string
): Promise<{ success: boolean; costPrice?: number; message?: string }> {
  // SykesNet doesn't expose a cost price API
  // This function exists for interface compatibility with other suppliers
  return {
    success: false,
    message: "SykesOfficial does not provide a cost price API. Configure prices manually in admin.",
  };
}
