import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { packagesAPI } from "@/lib/supabase";

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
  isEnabled?: boolean;
}

interface CartItem {
  id: string;
  pkg: Package;
  phoneNumber: string;
}

export default function FastNetPage() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [transactionCharge, setTransactionCharge] = useState(1.3);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [statusCheckId, setStatusCheckId] = useState("");
  const [statusReport, setStatusReport] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    loadPackages();
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem("fastnetSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.transactionCharge) {
          setTransactionCharge(parseFloat(parsed.transactionCharge));
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      const data = await packagesAPI.getByCategory("fastnet");
      if (data && data.length > 0) {
        setPackages(data);
      }
    } catch (error) {
      console.error("Error loading packages from Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (price: number) => {
    return price + (price * transactionCharge) / 100;
  };

  const handleStatusCheck = async () => {
    if (!statusCheckId) {
      alert("Please enter an order ID");
      return;
    }
    setStatusLoading(true);
    try {
      const response = await fetch(`/api/fastnet/orders/status/${statusCheckId}`);
      if (response.ok) {
        const order = await response.json();
        setStatusReport({
          shortId: order.shortId || order.short_id,
          status: order.status,
          packageDetails: order.packageDetails || order.package_details,
          createdAt: new Date(order.createdAt || order.created_at).toLocaleDateString(),
        });
      } else {
        setStatusReport(null);
        alert("Order not found");
      }
    } catch (error) {
      console.error("Status check error:", error);
      setStatusReport(null);
      alert("Error checking status");
    } finally {
      setStatusLoading(false);
    }
  };

  const addToCart = () => {
    if (!phoneNumber || !selectedPackage) {
      alert("Please enter phone number and select a package");
      return;
    }
    const newItem: CartItem = {
      id: Date.now().toString(),
      pkg: selectedPackage,
      phoneNumber: phoneNumber,
    };
    setCart([...cart, newItem]);
    setPhoneNumber("");
    setSelectedPackage(null);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    const itemsToProcess = cart.length > 0 ? cart : selectedPackage && phoneNumber ? [{ id: Date.now().toString(), pkg: selectedPackage, phoneNumber }] : null;

    if (!itemsToProcess || itemsToProcess.length === 0) {
      alert("Please add items to cart first");
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      alert("Payment configuration error");
      return;
    }

    setPurchasing(true);

    const subtotal = itemsToProcess.reduce((sum, item) => sum + item.pkg.price, 0);
    const charge = subtotal * (transactionCharge / 100);
    const totalAmount = subtotal + charge;

    const handler = (window as any).PaystackPop.setup({
      key: publicKey,
      email: "customer@wirenet.com",
      amount: Math.ceil(totalAmount * 100),
      currency: "GHS",
      ref: `FN-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      callback: async (response: any) => {
        try {
          let successCount = 0;
          for (const item of itemsToProcess) {
            try {
              const orderResponse = await fetch("/api/fastnet/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phoneNumber: item.phoneNumber,
                  dataAmount: item.pkg.dataAmount,
                  price: item.pkg.price,
                  reference: response.reference,
                }),
              });
              if (orderResponse.ok) {
                successCount++;
              }
            } catch (error) {
              console.error("Error creating order:", error);
            }
          }
          alert(`Payment successful! ${successCount} order(s) created.`);
          setCart([]);
          setPhoneNumber("");
          setSelectedPackage(null);
        } catch (error) {
          console.error("Error:", error);
          alert("Failed to process order");
        } finally {
          setPurchasing(false);
        }
      },
      onClose: () => {
        alert("Transaction cancelled");
        setPurchasing(false);
      },
    });

    handler.openIframe();
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.pkg.price, 0);
  const cartCharge = cartSubtotal * (transactionCharge / 100);
  const cartTotal = cartSubtotal + cartCharge;

  return (
    <div style={styles.body}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            style={{ marginBottom: "10px" }}
          >
            <ArrowLeft size={18} style={{ marginRight: "8px" }} />
            Back to WireNet
          </Button>
        </div>
        <h1 style={styles.h1}>FastNet - NON-EXPIRY MTN DATA</h1>
        <p style={styles.subtitle}>Super Fast Delivery - 5-20 Minutes</p>
      </div>

      <div style={styles.contactBar}>
        📞 Contact: <a href="tel:+233XXXXXXXXX" style={styles.contactLink}>+233 XXX XXX XXX</a> | 
        💬 WhatsApp: <a href="https://wa.me/233XXXXXXXXX" style={styles.contactLink}>Chat with us</a>
      </div>

      <main style={styles.main}>
        <div style={styles.statusChecker}>
          <h2 style={styles.statusCheckerH2}>Check Order Status</h2>
          <div style={styles.statusCheckerForm}>
            <Input
              type="text"
              placeholder="Enter Order ID"
              value={statusCheckId}
              onChange={(e) => setStatusCheckId(e.target.value)}
              style={styles.input}
            />
            <Button
              onClick={handleStatusCheck}
              disabled={statusLoading}
              style={styles.statusButton}
            >
              {statusLoading ? "Checking..." : "Check Status"}
            </Button>
          </div>
          {statusReport && (
            <div style={styles.statusReport}>
              <p><strong>Order ID:</strong> {statusReport.shortId}</p>
              <p><strong>Status:</strong> {statusReport.status}</p>
              <p><strong>Package:</strong> {statusReport.packageDetails}</p>
              <p><strong>Date:</strong> {statusReport.createdAt}</p>
            </div>
          )}
        </div>

        <h2 style={styles.sectionTitle}>Available Packages</h2>
        {loading ? (
          <p style={styles.loading}>Loading packages...</p>
        ) : packages.length === 0 ? (
          <p style={styles.loading}>No packages available</p>
        ) : (
          <div style={styles.packagesGrid}>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                style={{
                  ...styles.packageCard,
                  ...(selectedPackage?.id === pkg.id ? styles.packageCardSelected : {}),
                }}
              >
                <p style={styles.packageCardName}>{pkg.dataAmount}</p>
                <p style={styles.packageCardPrice}>GH₵{pkg.price}</p>
                <p style={styles.packageDelivery}>⏱ {pkg.deliveryTime}</p>
              </div>
            ))}
          </div>
        )}

        <h2 style={styles.sectionTitle}>Purchase Data</h2>
        <div style={styles.purchaseSection}>
          <div style={styles.purchaseCard}>
            <h3>Phone Number</h3>
            <Input
              type="tel"
              placeholder="Enter MTN number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.purchaseCard}>
            <h3>Selected Package</h3>
            {selectedPackage ? (
              <div style={styles.selectedPackageInfo}>
                <p style={styles.packageName}>{selectedPackage.dataAmount}</p>
                <p style={styles.packagePrice}>GH₵{selectedPackage.price}</p>
                <p style={styles.packageTotal}>Total: GH₵{calculateTotal(selectedPackage.price).toFixed(2)}</p>
              </div>
            ) : (
              <p style={styles.noSelection}>Select a package above</p>
            )}
          </div>

          <div style={styles.purchaseCard}>
            <h3>Add to Cart</h3>
            <Button
              onClick={addToCart}
              disabled={!phoneNumber || !selectedPackage}
              style={{
                ...styles.buyButton,
                opacity: !phoneNumber || !selectedPackage ? 0.5 : 1,
              }}
            >
              <ShoppingCart size={18} style={{ marginRight: "8px" }} />
              Add to Cart
            </Button>
            <p style={{ fontSize: "0.85em", color: "#666", marginTop: "10px", textAlign: "center" }}>
              Add items to cart, then pay for all at once
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <div style={styles.cartSection}>
            <h2 style={styles.sectionTitle}>
              <ShoppingCart size={24} style={{ marginRight: "10px", verticalAlign: "middle" }} />
              Your Cart ({cart.length})
            </h2>
            <div style={styles.cartList}>
              {cart.map((item) => (
                <div key={item.id} style={styles.cartItem}>
                  <div>
                    <p style={styles.cartItemPhone}>{item.phoneNumber}</p>
                    <p style={styles.cartItemPkg}>{item.pkg.dataAmount} - GH₵{item.pkg.price}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} style={styles.removeButton}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            <div style={styles.cartSummary}>
              <div style={styles.summaryRow}>
                <span>Subtotal:</span>
                <span>GH₵{cartSubtotal.toFixed(2)}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Fee ({transactionCharge}%):</span>
                <span>GH₵{cartCharge.toFixed(2)}</span>
              </div>
              <div style={styles.summaryTotal}>
                <span>Total:</span>
                <span>GH₵{cartTotal.toFixed(2)}</span>
              </div>
              
              <Button
                onClick={handleCheckout}
                disabled={purchasing}
                style={styles.checkoutButton}
              >
                {purchasing ? "Processing..." : `Pay GH₵${cartTotal.toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

      </main>

      <button
        onClick={() => window.open("https://wa.me/233XXXXXXXXX", "_blank")}
        style={styles.whatsappButton}
        title="Chat on WhatsApp"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  );
}

const styles: any = {
  body: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f0f4f8",
    color: "#333",
    minHeight: "100vh",
  },
  header: {
    backgroundColor: "white",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
    padding: "20px",
    textAlign: "center" as const,
    borderBottom: "3px solid #007bff",
  },
  headerTop: {
    textAlign: "left" as const,
  },
  h1: {
    color: "#1a1a1a",
    marginBottom: "5px",
    fontSize: "2.5em",
  },
  subtitle: {
    color: "#007bff",
    fontSize: "1.1em",
    fontWeight: "500",
  },
  contactBar: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "12px",
    textAlign: "center" as const,
    borderRadius: "5px",
    margin: "20px",
  },
  contactLink: {
    color: "#ffcc00",
    textDecoration: "none",
    fontWeight: "bold",
  },
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
  },
  statusChecker: {
    backgroundColor: "#e3f2fd",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "30px",
    textAlign: "center" as const,
    border: "1px solid #90caf9",
  },
  statusCheckerH2: {
    marginTop: 0,
    color: "#1565c0",
  },
  statusCheckerForm: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  input: {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "5px",
    width: "200px",
  },
  statusButton: {
    padding: "10px 20px",
    backgroundColor: "#1565c0",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  statusReport: {
    marginTop: "15px",
    textAlign: "left" as const,
    padding: "15px",
    backgroundColor: "#fff",
    borderRadius: "5px",
    maxWidth: "400px",
    margin: "15px auto 0",
  },
  sectionTitle: {
    fontSize: "1.8em",
    marginTop: "30px",
    marginBottom: "20px",
    color: "#1a1a1a",
  },
  purchaseSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    marginBottom: "30px",
  },
  purchaseCard: {
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #ddd",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  },
  selectedPackageInfo: {
    textAlign: "center" as const,
  },
  packageName: {
    fontSize: "2em",
    fontWeight: "bold",
    color: "#007bff",
    margin: "10px 0",
  },
  packagePrice: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  packageTotal: {
    fontSize: "1.1em",
    color: "#28a745",
    marginTop: "10px",
    fontWeight: "bold",
  },
  noSelection: {
    color: "#999",
    textAlign: "center" as const,
    padding: "20px 0",
  },
  buyButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.1em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    textAlign: "center" as const,
    color: "#666",
    padding: "40px",
  },
  packagesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  packageCard: {
    padding: "20px",
    backgroundColor: "#fff",
    border: "2px solid #ddd",
    borderRadius: "10px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.3s",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  },
  packageCardSelected: {
    border: "2px solid #007bff",
    backgroundColor: "#e3f2fd",
    boxShadow: "0 0 15px rgba(0, 123, 255, 0.3)",
    transform: "scale(1.02)",
  },
  packageCardName: {
    fontSize: "1.4em",
    fontWeight: "bold",
    color: "#007bff",
    margin: "5px 0",
  },
  packageCardPrice: {
    fontSize: "1.2em",
    fontWeight: "bold",
    color: "#1a1a1a",
    margin: "5px 0",
  },
  packageDelivery: {
    fontSize: "0.85em",
    color: "#666",
    margin: "5px 0 0",
  },
  whatsappButton: {
    position: "fixed" as const,
    bottom: "24px",
    right: "24px",
    backgroundColor: "#25D366",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: "56px",
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    zIndex: 50,
  },
  cartSection: {
    backgroundColor: "white",
    padding: "25px",
    borderRadius: "10px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
    marginTop: "30px",
  },
  cartList: {
    marginBottom: "20px",
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    borderBottom: "1px solid #eee",
  },
  cartItemPhone: {
    fontWeight: "bold",
    margin: 0,
    color: "#1a1a1a",
  },
  cartItemPkg: {
    color: "#666",
    margin: 0,
    fontSize: "0.9em",
  },
  removeButton: {
    background: "none",
    border: "none",
    color: "#dc3545",
    cursor: "pointer",
    padding: "5px",
  },
  cartSummary: {
    borderTop: "2px solid #eee",
    paddingTop: "15px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    color: "#666",
  },
  summaryTotal: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "15px",
    marginBottom: "20px",
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  checkoutButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.2em",
  },
  quickCheckout: {
    marginTop: "20px",
    textAlign: "center" as const,
  },
};
