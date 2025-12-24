import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Smartphone, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface MoMoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  orderReference: string;
  onSuccess: (orderId: string) => void;
  onCreateOrders: (reference: string) => Promise<string>; // Returns first order ID
  service: "at" | "telecel" | "fastnet" | "datagod";
}

type PaymentStatus = "idle" | "processing" | "verification_pending" | "pending" | "success" | "error";

export default function MoMoPaymentModal({
  isOpen,
  onClose,
  amount,
  orderReference,
  onSuccess,
  onCreateOrders,
  service,
}: MoMoPaymentModalProps) {
  const [payerPhone, setPayerPhone] = useState("");
  const [payerNetwork, setPayerNetwork] = useState<"mtn" | "vodafone" | "airteltigo">("mtn");
  const [phoneError, setPhoneError] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [firstOrderId, setFirstOrderId] = useState("");
  const [ordersCreated, setOrdersCreated] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.startsWith("233")) {
      value = "0" + value.substring(3);
    }
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    setPayerPhone(value);
    if (value.length > 0 && (value.length !== 10 || !value.startsWith("0"))) {
      setPhoneError("Number must be 10 digits starting with 0");
    } else {
      setPhoneError("");
    }
  };

  const isValidPhone = (phone: string) => /^0\d{9}$/.test(phone);

  const getNetworkChannel = (network: string): string => {
    switch (network) {
      case "mtn": return "13";
      case "vodafone": return "14";
      case "airteltigo": return "15";
      default: return "13";
    }
  };

  const handleSubmit = async () => {
    if (!isValidPhone(payerPhone)) {
      setPhoneError("Please enter a valid 10-digit phone number");
      return;
    }

    setStatus("processing");
    setStatusMessage("Initiating payment...");

    try {
      // Initiate Moolre payment FIRST (don't create orders yet)
      const response = await fetch("/api/moolre/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: payerPhone,
          amount: amount,
          orderReference: orderReference,
          network: payerNetwork,
        }),
      });

      const result = await response.json();

      if (result.success || result.code === "TR099") {
        // Payment prompt sent to phone - NOW create orders
        setStatusMessage("Creating orders...");
        const orderId = await onCreateOrders(orderReference);
        setFirstOrderId(orderId);
        setOrdersCreated(true);
        
        setStatus("pending");
        setStatusMessage("A payment prompt has been sent to your phone. Please enter your MoMo PIN to complete the payment.");
        
        // Wait a moment then redirect to success
        setTimeout(() => {
          onSuccess(orderId || orderReference);
        }, 4000);
      } else if (result.data?.code === "TP14" || result.code === "TP14" || result.message?.includes("verification")) {
        // First-time payer - needs to complete verification on their PHONE
        setStatus("verification_pending");
        setStatusMessage("Please complete the verification sent to your phone via SMS, then click 'Try Again'.");
      } else if (result.code === "TP09") {
        // Channel not supported
        setStatus("error");
        setStatusMessage(`${payerNetwork.toUpperCase()} is not currently supported. Please try a different network.`);
      } else {
        setStatus("error");
        setStatusMessage(result.message || "Payment initiation failed. Please try again.");
      }
    } catch (error) {
      console.error("Moolre payment error:", error);
      setStatus("error");
      setStatusMessage("Failed to process payment. Please try again.");
    }
  };

  const handleRetryAfterVerification = async () => {
    setStatus("processing");
    setStatusMessage("Checking verification status...");

    try {
      // Re-initiate payment after user completes phone verification
      const response = await fetch("/api/moolre/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: payerPhone,
          amount: amount,
          orderReference: orderReference,
          network: payerNetwork,
        }),
      });

      const result = await response.json();

      if (result.success || result.code === "TR099") {
        // Payment prompt sent - NOW create orders
        if (!ordersCreated) {
          setStatusMessage("Creating orders...");
          const orderId = await onCreateOrders(orderReference);
          setFirstOrderId(orderId);
          setOrdersCreated(true);
        }
        
        setStatus("pending");
        setStatusMessage("A payment prompt has been sent to your phone. Please enter your MoMo PIN to complete the payment.");
        
        setTimeout(() => {
          onSuccess(firstOrderId || orderReference);
        }, 4000);
      } else if (result.data?.code === "TP14" || result.code === "TP14" || result.message?.includes("verification")) {
        setStatus("verification_pending");
        setStatusMessage("Verification still pending. Please complete the SMS verification on your phone, then try again.");
      } else {
        setStatus("error");
        setStatusMessage(result.message || "Payment failed. Please try again.");
      }
    } catch (error) {
      console.error("Moolre retry error:", error);
      setStatus("error");
      setStatusMessage("Failed to process. Please try again.");
    }
  };

  const handleClose = () => {
    if (status === "processing") return; // Don't allow close while processing
    setPayerPhone("");
    setPayerNetwork("mtn");
    setPhoneError("");
    setStatus("idle");
    setStatusMessage("");
    setFirstOrderId("");
    setOrdersCreated(false);
    onClose();
  };

  const resetToIdle = () => {
    setStatus("idle");
    setStatusMessage("");
    setOrdersCreated(false);
    setFirstOrderId("");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Smartphone className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h2 className="font-bold text-black text-lg">MoMo Payment</h2>
                  <p className="text-black/70 text-sm">Powered by Moolre</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={status === "processing"}
                className="p-2 hover:bg-black/10 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5 text-black" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Amount Display */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-400">Amount to Pay</p>
              <p className="text-3xl font-bold text-white">GH₵{amount.toFixed(2)}</p>
            </div>

            {/* Status States */}
            {status === "idle" && (
              <div className="space-y-4">
                {/* Network Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Network
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "mtn", name: "MTN", color: "from-yellow-500 to-yellow-600" },
                      { id: "vodafone", name: "Vodafone", color: "from-red-500 to-red-600" },
                      { id: "airteltigo", name: "AirtelTigo", color: "from-blue-500 to-blue-600" },
                    ].map((network) => (
                      <button
                        key={network.id}
                        onClick={() => setPayerNetwork(network.id as "mtn" | "vodafone" | "airteltigo")}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          payerNetwork === network.id
                            ? `border-white bg-gradient-to-br ${network.color}`
                            : "border-white/20 bg-white/5 hover:border-white/40"
                        }`}
                      >
                        <span className={`text-sm font-medium ${payerNetwork === network.id ? "text-white" : "text-gray-300"}`}>
                          {network.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone Number Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Phone className="h-4 w-4 inline mr-1" />
                    MoMo Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g., 0241234567"
                    value={payerPhone}
                    onChange={handlePhoneChange}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-lg h-12"
                  />
                  {phoneError && (
                    <p className="text-red-400 text-sm mt-1">{phoneError}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    Enter the number linked to your Mobile Money account
                  </p>
                </div>

                {/* Pay Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!payerPhone || !!phoneError}
                  className="w-full h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold text-lg"
                >
                  Pay GH₵{amount.toFixed(2)}
                </Button>

                <p className="text-center text-gray-500 text-xs">
                  You will receive a prompt on your phone to enter your PIN
                </p>
              </div>
            )}

            {status === "processing" && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
                <p className="text-white font-medium">{statusMessage}</p>
                <p className="text-gray-400 text-sm mt-2">Please wait...</p>
              </div>
            )}

            {status === "verification_pending" && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="h-8 w-8 text-yellow-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Complete Verification on Your Phone</h3>
                  <p className="text-gray-400 text-sm">{statusMessage}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300">
                  <p className="font-medium text-white mb-2">📱 How to verify:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Check the SMS sent to <span className="text-yellow-400">{payerPhone}</span></li>
                    <li>Follow the instructions in the SMS (reply or dial USSD)</li>
                    <li>Once verified, click "Try Again" below</li>
                  </ol>
                </div>

                <Button
                  onClick={handleRetryAfterVerification}
                  className="w-full h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  I've Verified - Try Again
                </Button>

                <button
                  onClick={resetToIdle}
                  className="w-full text-gray-400 hover:text-white text-sm"
                >
                  ← Change phone number
                </button>
              </div>
            )}

            {status === "pending" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-green-500 animate-pulse" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Check Your Phone!</h3>
                <p className="text-gray-400 text-sm">{statusMessage}</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-yellow-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Waiting for confirmation...</span>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Payment Successful!</h3>
                <p className="text-gray-400 text-sm">Your order is being processed.</p>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Payment Failed</h3>
                  <p className="text-gray-400 text-sm">{statusMessage}</p>
                </div>

                <Button
                  onClick={resetToIdle}
                  className="w-full h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
