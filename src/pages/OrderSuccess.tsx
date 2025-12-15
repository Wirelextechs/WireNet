import { useEffect, useState } from "react";
import { CheckCircle, Copy, Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useRoute } from "wouter";

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
  const [, params] = useRoute("/order/success/:orderId");
  const orderId = params?.orderId || "";
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const searchParams = new URLSearchParams(window.location.search);
  const service = searchParams.get("service") || "datagod";

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const endpoint = service === "fastnet" 
        ? `/api/fastnet/orders/status/${orderId}`
        : `/api/datagod/orders/status/${orderId}`;
      
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

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "DELIVERED":
        return "#28a745";
      case "PROCESSING":
      case "PAID":
        return "#ffc107";
      case "FAILED":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.successCard}>
        <div style={styles.iconContainer}>
          <CheckCircle size={64} color="#28a745" />
        </div>
        
        <h1 style={styles.title}>Payment Successful!</h1>
        <p style={styles.subtitle}>Your order has been placed successfully.</p>

        <div style={styles.orderIdSection}>
          <p style={styles.orderIdLabel}>Your Order ID</p>
          <div style={styles.orderIdBox}>
            <span style={styles.orderId}>{orderId}</span>
            <button onClick={copyOrderId} style={styles.copyButton} title="Copy Order ID">
              <Copy size={18} />
            </button>
          </div>
          {copied && <p style={styles.copiedText}>Copied!</p>}
          <p style={styles.orderIdHint}>Save this ID to track your order status</p>
        </div>

        {order && (
          <div style={styles.orderDetails}>
            <h3 style={styles.detailsTitle}>Order Summary</h3>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Package:</span>
              <span style={styles.detailValue}>
                {order.packageName || order.packageDetails || "N/A"}
              </span>
            </div>
            {order.customerPhone && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Phone:</span>
                <span style={styles.detailValue}>{order.customerPhone}</span>
              </div>
            )}
            {order.totalAmount && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Amount:</span>
                <span style={styles.detailValue}>GH₵{order.totalAmount}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Status:</span>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: getStatusColor(order.status),
              }}>
                {order.status}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Date:</span>
              <span style={styles.detailValue}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}
              </span>
            </div>
          </div>
        )}

        <div style={styles.buttonGroup}>
          <Button
            onClick={() => navigate("/")}
            style={styles.homeButton}
          >
            <Home size={18} style={{ marginRight: "8px" }} />
            Home
          </Button>
          
          <Button
            onClick={() => navigate("/datagod")}
            style={styles.serviceButton}
          >
            DataGod
            <ArrowRight size={18} style={{ marginLeft: "8px" }} />
          </Button>
          
          <Button
            onClick={() => navigate("/fastnet")}
            style={styles.serviceButton}
          >
            FastNet
            <ArrowRight size={18} style={{ marginLeft: "8px" }} />
          </Button>
        </div>

        <p style={styles.trackingNote}>
          You can check your order status anytime on the {service === "fastnet" ? "FastNet" : "DataGod"} page using your Order ID.
        </p>
      </div>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f4f4f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loadingBox: {
    textAlign: "center" as const,
    color: "#666",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e0e0e0",
    borderTop: "4px solid #007bff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 15px",
  },
  successCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    padding: "40px",
    maxWidth: "500px",
    width: "100%",
    textAlign: "center" as const,
  },
  iconContainer: {
    marginBottom: "20px",
  },
  title: {
    fontSize: "2em",
    color: "#28a745",
    marginBottom: "10px",
  },
  subtitle: {
    color: "#666",
    fontSize: "1.1em",
    marginBottom: "30px",
  },
  orderIdSection: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "25px",
  },
  orderIdLabel: {
    fontSize: "0.9em",
    color: "#666",
    marginBottom: "10px",
  },
  orderIdBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    backgroundColor: "white",
    padding: "12px 20px",
    borderRadius: "6px",
    border: "2px solid #007bff",
  },
  orderId: {
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#1a1a1a",
    fontFamily: "monospace",
    letterSpacing: "1px",
  },
  copyButton: {
    background: "none",
    border: "none",
    color: "#007bff",
    cursor: "pointer",
    padding: "5px",
    display: "flex",
    alignItems: "center",
  },
  copiedText: {
    color: "#28a745",
    fontSize: "0.85em",
    marginTop: "8px",
  },
  orderIdHint: {
    fontSize: "0.8em",
    color: "#999",
    marginTop: "10px",
  },
  orderDetails: {
    textAlign: "left" as const,
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "25px",
  },
  detailsTitle: {
    fontSize: "1.1em",
    marginBottom: "15px",
    color: "#1a1a1a",
    borderBottom: "1px solid #ddd",
    paddingBottom: "10px",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  detailLabel: {
    color: "#666",
  },
  detailValue: {
    fontWeight: "500",
    color: "#1a1a1a",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    color: "white",
    fontSize: "0.85em",
    fontWeight: "bold",
  },
  buttonGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "10px",
    justifyContent: "center",
    marginBottom: "20px",
  },
  homeButton: {
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  serviceButton: {
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  trackingNote: {
    fontSize: "0.85em",
    color: "#666",
    fontStyle: "italic",
  },
};
