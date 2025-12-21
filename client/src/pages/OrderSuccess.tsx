import { useEffect, useState } from "react";
import { CheckCircle, Copy, Home, ArrowRight, Sparkles, Package, Clock, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import AnnouncementBanner, { type AnnouncementSeverity } from "@/components/ui/announcement-banner";

interface OrderDetails {
  shortId: string;
  status: string;
  packageName?: string;
  packageDetails?: string;
  customerPhone?: string;
  createdAt: string;
  totalAmount?: number;
}

export default function OrderSuccess() {
  const [, navigate] = useLocation();
  
  const pathname = window.location.pathname;
  const pathParts = pathname.split("/");
  const orderId = pathParts[pathParts.length - 1] || "";
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState<{ text: string; link: string; severity: AnnouncementSeverity; active: boolean }>({
    text: "",
    link: "",
    severity: "info",
    active: false,
  });
  
  const searchParams = new URLSearchParams(window.location.search);
  const service = searchParams.get("service") || "datagod";

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;
        const data = await response.json();
        setAnnouncement({
          text: data.announcementText || "",
          link: data.announcementLink || "",
          severity: (data.announcementSeverity as AnnouncementSeverity) || "info",
          active: data.announcementActive === true,
        });
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchOrderDetails = async () => {
    try {
      let endpoint = `/api/datagod/orders/status/${orderId}`;
      if (service === "fastnet") {
        endpoint = `/api/orders/status/${orderId}`;
      } else if (service === "at") {
        endpoint = `/api/at/orders/status/${orderId}`;
      } else if (service === "telecel") {
        endpoint = `/api/telecel/orders/status/${orderId}`;
      }
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setOrder({
          shortId: data.shortId || data.short_id || orderId,
          status: data.status,
          packageName: data.packageName || data.package_name,
          packageDetails: data.packageDetails || data.package_details,
          customerPhone: data.customerPhone || data.customer_phone,
          createdAt: data.createdAt || data.created_at,
          totalAmount: data.totalAmount || data.total_amount || data.packagePrice || data.package_price,
        });
      }
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getServiceColor = () => {
    switch (service) {
      case "at": return "from-blue-500 to-indigo-600";
      case "telecel": return "from-red-500 to-rose-600";
      case "fastnet": return "from-violet-500 to-fuchsia-600";
      default: return "from-amber-500 to-orange-600";
    }
  };

  const getServiceName = () => {
    switch (service) {
      case "at": return "AT iShare";
      case "telecel": return "Telecel Data";
      case "fastnet": return "FastNet";
      default: return "DataGod";
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Announcement */}
      {announcement.active && (
        <div className={`bg-gradient-to-r ${getServiceColor()} text-white`}>
          <div className="mx-auto max-w-7xl px-4 py-3">
            <AnnouncementBanner
              text={announcement.text}
              link={announcement.link}
              severity={announcement.severity}
              active={announcement.active}
            />
          </div>
        </div>
      )}

      <main className="flex items-center justify-center min-h-[90vh] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {loading ? (
            <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-white/30 p-8 text-center shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading order details...</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl overflow-hidden">
              {/* Success Header */}
              <div className={`bg-gradient-to-r ${getServiceColor()} p-8 text-center text-white relative overflow-hidden`}>
                {/* Floating sparkles */}
                <motion.div
                  animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-4 left-8"
                >
                  <Sparkles className="h-6 w-6 text-white/50" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                  className="absolute top-6 right-10"
                >
                  <Sparkles className="h-4 w-4 text-white/50" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, -12, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
                  className="absolute bottom-8 right-6"
                >
                  <Sparkles className="h-5 w-5 text-white/50" />
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4"
                >
                  <CheckCircle className="h-12 w-12 text-white" />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold"
                >
                  Order Successful! 🎉
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white/80 mt-2"
                >
                  {getServiceName()} purchase confirmed
                </motion.p>
              </div>

              {/* Order Details */}
              <div className="p-6 space-y-6">
                {/* Order ID */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Order ID</p>
                      <p className="font-mono font-bold text-lg">{order?.shortId || orderId}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyOrderId}
                      className="rounded-xl"
                    >
                      <Copy className={`h-4 w-4 ${copied ? "text-emerald-500" : ""}`} />
                    </Button>
                  </div>
                  {copied && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-emerald-600 mt-1"
                    >
                      Copied to clipboard!
                    </motion.p>
                  )}
                </motion.div>

                {/* Details Grid */}
                {order && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {order.packageDetails && (
                      <div className="p-4 rounded-2xl bg-white border border-gray-100">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Package className="h-4 w-4" />
                          <span className="text-xs">Package</span>
                        </div>
                        <p className="font-semibold">{order.packageDetails}</p>
                      </div>
                    )}
                    {order.customerPhone && (
                      <div className="p-4 rounded-2xl bg-white border border-gray-100">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Phone className="h-4 w-4" />
                          <span className="text-xs">Phone</span>
                        </div>
                        <p className="font-semibold">{order.customerPhone}</p>
                      </div>
                    )}
                    <div className="p-4 rounded-2xl bg-white border border-gray-100">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs">Status</span>
                      </div>
                      <p className={`font-semibold ${
                        order.status === "FULFILLED" ? "text-emerald-600" :
                        order.status === "FAILED" ? "text-red-600" : "text-amber-600"
                      }`}>
                        {order.status}
                      </p>
                    </div>
                    {order.totalAmount && (
                      <div className="p-4 rounded-2xl bg-white border border-gray-100">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <span className="text-xs">Amount</span>
                        </div>
                        <p className="font-semibold">GH₵{order.totalAmount.toFixed(2)}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Info Box */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100"
                >
                  <p className="text-sm text-emerald-800">
                    <strong>✨ What's next?</strong><br />
                    Your data will be delivered within the estimated time. Save your Order ID to track the status anytime.
                  </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex gap-3"
                >
                  <Button
                    onClick={() => navigate("/")}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Button>
                  <Button
                    onClick={() => {
                      if (service === "at") navigate("/at");
                      else if (service === "telecel") navigate("/telecel");
                      else if (service === "fastnet") navigate("/fastnet");
                      else navigate("/datagod");
                    }}
                    className={`flex-1 bg-gradient-to-r ${getServiceColor()} text-white rounded-xl`}
                  >
                    Buy More
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
