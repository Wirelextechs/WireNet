/**
 * Moolre Payment Gateway Integration
 * Mobile Money payments for MTN, Vodafone, etc.
 * https://docs.moolre.com/#/e-commerce
 */

const MOOLRE_BASE_URL = "https://api.moolre.com/open/transact/payment";
const MOOLRE_USER = process.env.MOOLRE_USER;
const MOOLRE_PUB_KEY = process.env.MOOLRE_PUB_KEY;
const MOOLRE_SECRET = process.env.MOOLRE_SECRET;
const MOOLRE_ACCOUNT = process.env.MOOLRE_ACCOUNT; // Merchant account number

console.log(`🔑 Moolre Status: ${MOOLRE_USER && MOOLRE_PUB_KEY ? '✅ SET' : '❌ NOT SET'}`);
if (!MOOLRE_USER || !MOOLRE_PUB_KEY) {
  console.warn("⚠️  MOOLRE_USER and MOOLRE_PUB_KEY not set - Moolre payments will be disabled");
  console.warn("Please set environment variables: MOOLRE_USER, MOOLRE_PUB_KEY, MOOLRE_SECRET, MOOLRE_ACCOUNT");
}

interface MoolrePaymentRequest {
  type: number; // 1 = payment
  channel: string; // '13' = MTN, '14' = Vodafone, etc.
  currency: string; // 'GHS'
  amount: number;
  payer: string; // phone number
  externalref: string; // order reference
  accountnumber: string; // merchant account
  sessionid?: string; // optional USSD session
  otpcode?: string; // OTP code for verification (TP14 response)
}

interface MoolrePaymentResponse {
  code: string;
  message: string;
  status: string;
  data?: {
    transactionid?: string;
    [key: string]: any;
  };
}

/**
 * Initiate a payment with Moolre
 * @param phone - Customer phone number
 * @param amount - Amount in GHS
 * @param orderReference - Unique order reference
 * @param network - Network: 'mtn' or 'vodafone'
 * @param otp - Optional OTP code (required after TP14 response)
 */
export async function initiatePayment(
  phone: string,
  amount: number,
  orderReference: string,
  network: string = "mtn",
  otp?: string
): Promise<{ success: boolean; message: string; data?: any; code?: string }> {
  if (!MOOLRE_USER || !MOOLRE_PUB_KEY || !MOOLRE_ACCOUNT) {
    console.error("❌ Moolre credentials not configured");
    return {
      success: false,
      message: "Moolre is not configured on this server",
    };
  }

  try {
    // Map network to Moolre channel
    const channelMap: { [key: string]: string } = {
      mtn: "13", // MTN Mobile Money
      vodafone: "14", // Vodafone Cash
      airteltigo: "15", // AirtelTigo Money
    };

    const channel = channelMap[network.toLowerCase()] || "13";

    const payload: MoolrePaymentRequest = {
      type: 1, // Payment type
      channel, // Network channel
      currency: "GHS",
      amount: Math.round(amount * 100) / 100, // Ensure 2 decimal places
      payer: phone,
      externalref: orderReference,
      accountnumber: MOOLRE_ACCOUNT,
    };

    // Add OTP code if provided (for TP14 verification)
    if (otp) {
      payload.otpcode = otp;
      console.log(`📡 Submitting OTP code for verification: ${otp}`);
    }

    console.log(`📡 Initiating Moolre payment:`, {
      phone,
      amount,
      channel,
      reference: orderReference,
      hasOtp: !!otp,
      url: MOOLRE_BASE_URL,
    });

    const response = await fetch(MOOLRE_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-USER": MOOLRE_USER,
        "X-API-PUBKEY": MOOLRE_PUB_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result: MoolrePaymentResponse = await response.json();

    console.log(`📡 Moolre Response:`, result);

    // Handle OTP requirement (first-time payers)
    if (result.code === "TP14") {
      console.log(`⚠️  OTP required for ${phone}`);
      return {
        success: false,
        code: "TP14",
        message: "Verification code required - Please enter the code sent to your phone",
        data: result,
      };
    }

    // Handle successful verification - need to re-submit without OTP to trigger payment
    if (result.code === "TP17") {
      console.log(`✅ Phone verification successful for ${phone}, now initiating payment...`);
      return {
        success: false,
        code: "TP17",
        message: "Verification successful! Initiating payment...",
        data: result,
      };
    }

    // Handle pending payment (prompt sent to user)
    if (result.code === "TR099") {
      console.log(`⏳ Payment pending for order ${orderReference}`);
      return {
        success: true,
        code: "TR099",
        message: "Payment prompt sent to customer's phone. Awaiting confirmation.",
        data: result,
      };
    }

    // Success response
    if (result.code === "0" || result.code === "TR000") {
      console.log(`✅ Moolre payment successful for ${orderReference}`);
      return {
        success: true,
        code: result.code,
        message: result.message || "Payment initiated successfully",
        data: result,
      };
    }

    // Error response
    console.error(`❌ Moolre payment failed [${result.code}]:`, result.message);
    return {
      success: false,
      code: result.code,
      message: result.message || `Payment failed with code ${result.code}`,
      data: result,
    };
  } catch (error) {
    console.error(`❌ Moolre API error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Verify webhook secret (security check)
 */
export function verifyWebhookSecret(secret: string): boolean {
  if (!MOOLRE_SECRET) {
    console.warn("⚠️  MOOLRE_SECRET not configured");
    return false;
  }
  const isValid = secret === MOOLRE_SECRET;
  if (!isValid) {
    console.error("❌ Invalid Moolre webhook secret");
  }
  return isValid;
}

/**
 * Parse Moolre webhook payload
 */
export function parseWebhookPayload(body: any): {
  success: boolean;
  reference?: string;
  status?: string;
  phone?: string;
  amount?: number;
  message?: string;
} {
  try {
    // Moolre webhook structure varies, but typically includes:
    // externalref: order reference
    // status: payment status
    // payer: customer phone
    // amount: paid amount
    // secret: verification field

    return {
      success: true,
      reference: body.externalref,
      status: body.status, // e.g., "completed", "pending", "failed"
      phone: body.payer,
      amount: body.amount,
    };
  } catch (error) {
    console.error("❌ Error parsing Moolre webhook:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Parse error",
    };
  }
}
