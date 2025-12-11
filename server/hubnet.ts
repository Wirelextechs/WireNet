/**
 * Hubnet API Integration
 * https://console.hubnet.app/live/api/context/business/transaction
 * Authentication: token: Bearer {token}
 * Rate Limit: 5 requests per minute
 */

const HUBNET_BASE_URL = "https://console.hubnet.app/live/api/context/business/transaction";
const API_KEY = process.env.HUBNET_API_KEY;

if (!API_KEY) {
  console.warn("⚠️  HUBNET_API_KEY not set - Hubnet fulfillment will be disabled");
}

/**
 * Extract package size number from data amount string
 * Hubnet expects volume in MEGABYTES using decimal conversion (1GB = 1000MB)
 * 
 * @param dataAmount - Package size like "1GB", "5GB", "10GB"
 * @returns Volume in megabytes (e.g., "5GB" → "5000")
 */
function extractVolumeInMB(dataAmount: string): string {
  const match = dataAmount.match(/^(\d+)GB$/);
  if (!match) {
    throw new Error(`Invalid data amount format: ${dataAmount}`);
  }
  const gb = parseInt(match[1]);
  return (gb * 1000).toString(); // Convert GB to MB (decimal: 1GB = 1000MB)
}

interface HubnetTransactionRequest {
  phone: string; // 10 digits, national format (e.g., 0241234567)
  volume: string; // In megabytes (e.g., "2000" for 2GB)
  reference: string; // 6-25 characters unique reference
  referrer?: string; // Optional 10 digits
  webhook?: string; // Optional webhook URL
}

interface HubnetResponse {
  status: boolean;
  reason: string;
  code: string;
  message: string;
  transaction_id?: string;
  payment_id?: string;
  reference?: string;
  data?: any;
}

interface HubnetBalanceResponse {
  status: boolean;
  balance: string;
  currency: string;
}

/**
 * Purchase a data bundle via Hubnet MTN service
 * @param phoneNumber - Customer's phone number (10 digits)
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
      message: "Hubnet API key not configured",
    };
  }

  try {
    // Hubnet expects volume in megabytes (e.g., 2000 for 2GB)
    const volumeInMB = extractVolumeInMB(dataAmount);

    const requestBody: HubnetTransactionRequest = {
      phone: phoneNumber,
      volume: volumeInMB,
      reference: orderReference,
    };

    console.log(`📡 Sending data order to Hubnet:`, {
      phone: phoneNumber,
      dataAmount: dataAmount,
      volumeInMB: volumeInMB,
      supplierCost: price,
      ref: orderReference,
    });

    // Hubnet endpoint: {network}-new-transaction where network is "mtn" for MTN
    const response = await fetch(`${HUBNET_BASE_URL}/mtn-new-transaction`, {
      method: "POST",
      headers: {
        "token": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: HubnetResponse = await response.json();

    if (!response.ok) {
      console.error(`❌ Hubnet API error:`, result);
      return {
        success: false,
        message: result.reason || `API request failed with status ${response.status}`,
      };
    }

    // Hubnet returns code "0000" for successful transaction initialization
    if (result.status && result.code === "0000") {
      console.log(`✅ Hubnet order successful:`, result);
      return {
        success: true,
        message: result.reason || result.message,
        data: {
          transaction_id: result.transaction_id,
          payment_id: result.payment_id,
          reference: result.reference,
        },
      };
    } else {
      console.error(`❌ Hubnet order failed:`, result.reason || result.message);
      return {
        success: false,
        message: result.reason || result.message,
      };
    }
  } catch (error) {
    console.error(`❌ Hubnet API error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get wallet balance from Hubnet
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
      message: "Hubnet API key not configured",
    };
  }

  try {
    const response = await fetch(`${HUBNET_BASE_URL}/check_balance`, {
      method: "GET",
      headers: {
        "token": `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to fetch wallet balance: ${response.status}`,
      };
    }

    const result: any = await response.json();

    // Hubnet returns: { status: "success", data: { wallet_balance: 51.352 } }
    if (result.status === "success" && result.data?.wallet_balance !== undefined) {
      return {
        success: true,
        balance: String(result.data.wallet_balance),
        currency: "GHS", // Hubnet operates in Ghana (GHS)
      };
    } else {
      return {
        success: false,
        message: result.message || "Failed to retrieve balance",
      };
    }
  } catch (error) {
    console.error(`❌ Failed to fetch Hubnet balance:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get cost price for a data package from Hubnet
 * Note: Hubnet doesn't have a dedicated pricing API endpoint
 * This is a placeholder - actual pricing would need to be configured manually
 * or obtained from Hubnet support
 */
export async function getCostPrice(
  dataAmount: string
): Promise<{ success: boolean; costPrice?: number; message?: string }> {
  // Hubnet doesn't provide a real-time pricing API like DataXpress
  // For now, return a placeholder response
  return {
    success: false,
    message: "Hubnet does not provide automated cost price API. Please configure pricing manually.",
  };
}
