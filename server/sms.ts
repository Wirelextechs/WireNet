/**
 * Arkesel SMS Service
 * Sends SMS notifications for new orders
 */

const SMS_API_KEY = "cHJvc3Blci53ZWRhbTo1Q0d5YU1Hd3Nhdmd5bDBD";
const SMS_API_URL = "https://sms.arkesel.com/sms/api";
const SENDER_ID = "WTData"; // Your approved sender ID

interface SMSResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Send an SMS notification
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  try {
    // Format phone number - ensure it has Ghana country code
    let formattedPhone = to.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "233" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("233")) {
      formattedPhone = "233" + formattedPhone;
    }

    const url = `${SMS_API_URL}?action=send-sms&api_key=${SMS_API_KEY}&to=${formattedPhone}&from=${SENDER_ID}&sms=${encodeURIComponent(message)}`;
    
    console.log(`📱 Sending SMS to ${formattedPhone} from ${SENDER_ID}`);
    console.log(`📱 SMS URL: ${url.replace(SMS_API_KEY, "***HIDDEN***")}`);
    
    const response = await fetch(url);
    const result = await response.text();
    
    console.log(`📱 SMS API Response Status: ${response.status}`);
    console.log(`📱 SMS API Response Body: ${result}`);
    
    // Arkesel returns "OK" for successful sends
    if (result.includes("OK") || result.includes("1") || response.ok) {
      return {
        success: true,
        message: "SMS sent successfully",
        data: result
      };
    } else {
      console.error(`❌ SMS failed: ${result}`);
      return {
        success: false,
        message: result || "Failed to send SMS"
      };
    }
  } catch (error: any) {
    console.error("❌ SMS sending error:", error);
    return {
      success: false,
      message: error.message || "SMS sending failed"
    };
  }
}

/**
 * Send order notification SMS to admin
 */
export async function sendOrderNotification(
  adminPhone: string,
  category: string,
  orderId: string,
  customerPhone: string,
  packageDetails: string
): Promise<SMSResult> {
  const message = `New ${category} Order!\nID: ${orderId}\nPhone: ${customerPhone}\nPackage: ${packageDetails}`;
  
  return sendSMS(adminPhone, message);
}

/**
 * Check SMS balance
 */
export async function checkSMSBalance(): Promise<{ success: boolean; balance?: string; message?: string }> {
  try {
    const url = `${SMS_API_URL}?action=check-balance&api_key=${SMS_API_KEY}&response=json`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.balance !== undefined) {
      return {
        success: true,
        balance: result.balance
      };
    } else {
      return {
        success: false,
        message: "Failed to check balance"
      };
    }
  } catch (error: any) {
    console.error("SMS balance check error:", error);
    return {
      success: false,
      message: error.message || "Balance check failed"
    };
  }
}
