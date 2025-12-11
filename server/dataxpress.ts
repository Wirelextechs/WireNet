/**
 * DataXpress API Integration
 * https://www.dataxpress.shop/api-dev
 */

const DATAXPRESS_BASE_URL = "https://www.dataxpress.shop";
const API_KEY = process.env.DATAXPRESS_API_KEY;

if (!API_KEY) {
  console.warn("⚠️  DATAXPRESS_API_KEY not set - order fulfillment will be disabled");
}

// Map our package sizes to DataXpress volumeInMB
// DataXpress expects volume in MB (e.g., 1024 for 1GB)
function parseDataAmount(dataAmount: string): number {
  const match = dataAmount.match(/^(\d+)GB$/);
  if (!match) {
    throw new Error(`Invalid data amount format: ${dataAmount}`);
  }
  return parseInt(match[1]) * 1024; // Convert GB to MB
}

/**
 * Extract package size number from data amount string
 * Note: DataXpress API has confusing naming - their "volumeInMB" field
 * actually expects the package SIZE NUMBER, not actual megabytes!
 * Example: "5GB" → 5 (not 5120)
 * 
 * @param dataAmount - Package size like "1GB", "5GB", "10GB"
 * @returns Package number (e.g., 5 for "5GB")
 */
function extractPackageSize(dataAmount: string): number {
  const match = dataAmount.match(/^(\d+)GB$/);
  if (!match) {
    throw new Error(`Invalid data amount format: ${dataAmount}`);
  }
  return parseInt(match[1]); // Return just the number (e.g., "5GB" → 5)
}

interface DataXpressOrderRequest {
  ref: string;
  phone: string;
  volumeInMB: number;
  amount: number;
  networkType: "mtn" | "telecel" | "tigo" | "airteltigo";
}

interface DataXpressResponse {
  status: "success" | "error";
  message: string;
  data?: any;
}

interface WalletBalanceData {
  balance: string;
  currency: string;
  wallet_id: number;
  user_id: number;
  last_transaction_at: string;
}

/**
 * Purchase a data bundle via DataXpress
 * @param phoneNumber - Customer's phone number
 * @param dataAmount - Package size like "5GB"
 * @param price - Supplier cost (wholesale price, NOT customer price)
 * @param orderReference - Unique order reference
 */
export async function purchaseDataBundle(
  phoneNumber: string,
  dataAmount: string,
  price: number,
  orderReference: string
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!API_KEY) {
    return {
      success: false,
      message: "DataXpress API key not configured",
    };
  }

  try {
    // DataXpress API naming is confusing: "volumeInMB" expects package SIZE number
    // e.g., for "5GB" package, send volumeInMB: 5 (not 5120)
    const packageSize = extractPackageSize(dataAmount);

    const requestBody: DataXpressOrderRequest = {
      ref: orderReference,
      phone: phoneNumber,
      volumeInMB: packageSize, // Send package number (e.g., 5 for "5GB")
      amount: price, // Supplier cost (wholesale price)
      networkType: "mtn", // Currently only supporting MTN
    };

    console.log(`📡 Sending data order to DataXpress:`, {
      phone: phoneNumber,
      dataAmount: dataAmount,
      packageSize: packageSize,
      supplierCost: price,
      ref: orderReference,
    });

    const response = await fetch(`${DATAXPRESS_BASE_URL}/api/buy-data`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: DataXpressResponse = await response.json();

    if (!response.ok) {
      console.error(`❌ DataXpress API error:`, result);
      return {
        success: false,
        message: result.message || `API request failed with status ${response.status}`,
      };
    }

    if (result.status === "success") {
      console.log(`✅ DataXpress order successful:`, result.data);
      return {
        success: true,
        message: result.message,
        data: result.data,
      };
    } else {
      console.error(`❌ DataXpress order failed:`, result.message);
      return {
        success: false,
        message: result.message,
      };
    }
  } catch (error) {
    console.error(`❌ DataXpress API error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check DataXpress wallet balance
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
      message: "DataXpress API key not configured",
    };
  }

  try {
    const response = await fetch(`${DATAXPRESS_BASE_URL}/api/wallet-balance`, {
      method: "GET",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
    });

    const result: DataXpressResponse = await response.json();

    if (!response.ok || result.status !== "success") {
      return {
        success: false,
        message: result.message || "Failed to fetch wallet balance",
      };
    }

    const walletData = result.data as WalletBalanceData;
    return {
      success: true,
      balance: walletData.balance,
      currency: walletData.currency,
    };
  } catch (error) {
    console.error(`❌ Failed to fetch wallet balance:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check order status on DataXpress
 */
export async function checkOrderStatus(
  orderReference: string
): Promise<{ success: boolean; status?: string; message?: string; data?: any }> {
  if (!API_KEY) {
    return {
      success: false,
      message: "DataXpress API key not configured",
    };
  }

  try {
    const response = await fetch(
      `${DATAXPRESS_BASE_URL}/api/order-status/${orderReference}`,
      {
        method: "GET",
        headers: {
          "X-API-KEY": API_KEY,
        },
      }
    );

    const result: DataXpressResponse = await response.json();

    if (!response.ok || result.status !== "success") {
      return {
        success: false,
        message: result.message || "Failed to check order status",
      };
    }

    return {
      success: true,
      status: result.data?.status,
      data: result.data,
    };
  } catch (error) {
    console.error(`❌ Failed to check order status:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get real-time cost price from DataXpress for a specific data volume
 */
export async function getCostPrice(
  dataAmount: string
): Promise<{ success: boolean; costPrice?: number; message?: string }> {
  if (!API_KEY) {
    return {
      success: false,
      message: "DataXpress API key not configured",
    };
  }

  try {
    // DataXpress API naming is confusing: "volumeInMB" expects package SIZE number
    // e.g., for "5GB" package, send volumeInMB: 5 (not 5120)
    const packageSize = extractPackageSize(dataAmount);

    const response = await fetch(`${DATAXPRESS_BASE_URL}/api/get-cost-price`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        volumeInMB: packageSize, // Send package number (e.g., 5 for "5GB")
        networkType: "mtn",
      }),
    });

    const result: any = await response.json();

    if (!response.ok || result.status !== "success") {
      return {
        success: false,
        message: result.message || "Failed to fetch cost price",
      };
    }

    // DataXpress returns cost_price at the root level (not in data object)
    const costPrice = result.cost_price;
    
    if (costPrice === undefined) {
      return {
        success: false,
        message: "Cost price not found in response",
      };
    }

    return {
      success: true,
      costPrice: parseFloat(costPrice),
    };
  } catch (error) {
    console.error(`❌ Failed to fetch cost price:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
