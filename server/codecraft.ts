/**
 * Code Craft Network API Integration
 * Supports: MTN, AT ISHARE, TELECEL
 * https://api.codecraftnetwork.com
 */

const CODECRAFT_BASE_URL = "https://api.codecraftnetwork.com/api";
const API_KEY = process.env.CODECRAFT_API_KEY;

console.log(`🔑 Code Craft API Key Status: ${API_KEY ? '✅ SET' : '❌ NOT SET'}`);
if (!API_KEY) {
  console.warn("⚠️  CODECRAFT_API_KEY not set - Code Craft order fulfillment will be disabled");
  console.warn("Please set CODECRAFT_API_KEY environment variable on Vercel");
}

interface CodeCraftOrderRequest {
  agent_api: string;
  recipient_number: string;
  network: "MTN" | "AT" | "TELECEL";
  gig: string;
  reference_id: string;
}

interface CodeCraftResponse {
  status: string;
  message: string;
  http_code?: number;
}

interface CodeCraftStatusResponse {
  status: string;
  code: number;
  order_details?: {
    beneficiary: string;
    gig: string;
    network: string;
    price: string;
    order_time: string;
    order_date: string;
    order_status: string;
  };
  message?: string;
}

/**
 * Map network names to Code Craft format
 */
function mapNetworkName(network: string): "MTN" | "AT" | "TELECEL" {
  const networkMap: Record<string, "MTN" | "AT" | "TELECEL"> = {
    mtn: "MTN",
    at: "AT",
    at_ishare: "AT",
    telecel: "TELECEL",
  };
  
  const mapped = networkMap[network.toLowerCase()];
  if (!mapped) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return mapped;
}

/**
 * Extract gig amount from data amount string
 * Code Craft expects gig numbers (e.g., "1", "2", "5", "10")
 * Maps our "1GB", "5GB" format to their gig format (case-insensitive)
 */
function extractGigAmount(dataAmount: string): string {
  // Handle formats like "1GB", "5GB", "1gb", "5gb", etc. (case-insensitive)
  const gbMatch = dataAmount.match(/^(\d+)GB$/i);
  if (gbMatch) {
    return gbMatch[1]; // Return "1", "5", etc.
  }
  
  // Handle formats like "500MB", "500mb" etc. (case-insensitive)
  const mbMatch = dataAmount.match(/^(\d+)MB$/i);
  if (mbMatch) {
    const mb = parseInt(mbMatch[1]);
    const gb = mb / 1024;
    return gb.toString();
  }
  
  throw new Error(`Invalid data amount format: ${dataAmount}. Expected format: "1GB", "5GB", "500MB", etc.`);
}

/**
 * Purchase a data bundle via Code Craft Network
 * @param phoneNumber - Customer's phone number (format: 0554226398)
 * @param dataAmount - Package size like "1GB", "5GB"
 * @param price - Supplier cost (wholesale price)
 * @param orderReference - Unique order reference
 * @param network - Network type: "at_ishare" or "telecel"
 */
export async function purchaseDataBundle(
  phoneNumber: string,
  dataAmount: string,
  price: number,
  orderReference: string,
  network: string = "mtn"
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!API_KEY) {
    console.error(`❌ Code Craft API key not configured. Cannot fulfill order ${orderReference}`);
    return {
      success: false,
      message: "Code Craft API key not configured on server",
    };
  }

  try {
    const gigAmount = extractGigAmount(dataAmount);
    const networkName = mapNetworkName(network);

    const requestBody: CodeCraftOrderRequest = {
      agent_api: API_KEY,
      recipient_number: phoneNumber,
      network: networkName,
      gig: gigAmount,
      reference_id: orderReference,
    };

    console.log(`📡 Sending ${networkName} order to Code Craft Network:`, {
      phone: phoneNumber,
      dataAmount: dataAmount,
      gig: gigAmount,
      network: networkName,
      supplierCost: price,
      ref: orderReference,
      url: `${CODECRAFT_BASE_URL}/initiate.php`,
    });

    const response = await fetch(`${CODECRAFT_BASE_URL}/initiate.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: CodeCraftResponse = await response.json();
    const httpCode = response.status;

    console.log(`Code Craft Response [${httpCode}]:`, result);

    // Handle various status codes from Code Craft
    if (httpCode === 200 && result.status === "Successful") {
      console.log(`✅ Code Craft order successful:`, result);
      return {
        success: true,
        message: result.message || "Order submitted successfully",
        data: result,
      };
    } else if (httpCode === 100) {
      return {
        success: false,
        message: "Admin has low wallet balance",
      };
    } else if (httpCode === 101) {
      return {
        success: false,
        message: "Account is out of stock",
      };
    } else if (httpCode === 102) {
      return {
        success: false,
        message: "Agent not found",
      };
    } else if (httpCode === 103) {
      return {
        success: false,
        message: "Price not found",
      };
    } else if (httpCode === 555) {
      return {
        success: false,
        message: "Network not found",
      };
    } else {
      console.error(`❌ Code Craft order failed [${httpCode}]:`, result);
      return {
        success: false,
        message: result.message || `Order failed with code ${httpCode}`,
      };
    }
  } catch (error) {
    console.error(`❌ Code Craft API error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check order status from Code Craft Network
 * @param referenceId - Order reference ID
 * @param network - Network type: "mtn", "at_ishare", or "telecel"
 */
export async function checkOrderStatus(
  referenceId: string,
  network: string = "mtn"
): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  data?: any;
}> {
  if (!API_KEY) {
    return {
      success: false,
      message: "Code Craft API key not configured",
    };
  }

  try {
    const networkName = mapNetworkName(network);
    
    // Determine which endpoint to use based on network
    const isBigTime = network.toLowerCase().includes("bigtime");
    const endpoint = isBigTime ? "response_big_time.php" : "response_regular.php";

    const requestBody = {
      reference_id: referenceId,
      agent_api: API_KEY,
    };

    console.log(`📡 Checking ${networkName} order status from Code Craft:`, referenceId);

    const response = await fetch(`${CODECRAFT_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: CodeCraftStatusResponse = await response.json();

    if (result.status === "success" && result.code === 200) {
      console.log(`✅ Order status retrieved:`, result.order_details);
      return {
        success: true,
        status: result.order_details?.order_status || "Unknown",
        message: "Status retrieved successfully",
        data: result.order_details,
      };
    } else {
      console.error(`❌ Failed to get order status:`, result);
      return {
        success: false,
        message: result.message || "Failed to retrieve order status",
      };
    }
  } catch (error) {
    console.error(`❌ Code Craft status check error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get wallet balance (if available from Code Craft API)
 */
export async function getWalletBalance(): Promise<{
  success: boolean;
  balance?: string;
  message?: string;
}> {
  // Code Craft API documentation doesn't mention a wallet balance endpoint
  // This is a placeholder that would need to be updated if such endpoint exists
  return {
    success: false,
    message: "Wallet balance check not available for Code Craft Network",
  };
}

/**
 * Get cost price for a data bundle
 */
export async function getCostPrice(
  dataAmount: string
): Promise<{ success: boolean; costPrice?: number; message?: string }> {
  // Code Craft doesn't provide a price lookup endpoint
  // Prices should be maintained in the admin panel
  return {
    success: false,
    message: "Cost price lookup not available for Code Craft Network",
  };
}
