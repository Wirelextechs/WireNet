import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface Package {
  id: number;
  packageName: string;
  dataValueGB: number;
  priceGHS: number;
  isEnabled: boolean;
}

interface CartItem {
  id: string;
  pkg: Package;
  phoneNumber: string;
}

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
}

export default function DataGodPage() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
  });
  const [whatsappLink, setWhatsappLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [statusCheckId, setStatusCheckId] = useState("");
  const [statusReport, setStatusReport] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [transactionCharge, setTransactionCharge] = useState(1.3);

  useEffect(() => {
    fetchSettings();
    fetchPackages();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          whatsappLink: data.whatsappLink || "",
          datagodEnabled: data.datagodEnabled !== false,
          fastnetEnabled: data.fastnetEnabled !== false,
        });
        setWhatsappLink(data.whatsappLink || "");
        if (data.datagodTransactionCharge) {
          setTransactionCharge(parseFloat(data.datagodTransactionCharge));
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await fetch("/api/datagod/packages");
      if (response.ok) {
        const data = await response.json();
        setPackages(data.sort((a: Package, b: Package) => a.dataValueGB - b.dataValueGB));
      } else {
        console.error("Failed to load packages:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching packages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (settings.whatsappLink) {
      window.open(settings.whatsappLink, "_blank");
    }
  };

  const handleStatusCheck = async () => {
    if (!statusCheckId) {
      alert("Please enter an order ID");
      return;
    }

    setStatusLoading(true);
    try {
      const response = await fetch(`/api/datagod/orders/status/${statusCheckId}`);
      if (response.ok) {
        const order = await response.json();
        setStatusReport({
          shortId: order.shortId,
          status: order.status,
          packageName: order.packageName,
          createdAt: new Date(order.createdAt).toLocaleDateString(),
        });
      } else {
        setStatusReport(null);
        alert("Order not found");
      }
    } catch (error) {
      console.error("Status check error:", error);
      setStatusReport(null);
      alert("Error checking order status");
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
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      alert("Paystack public key not found. Please check environment variables.");
      return;
    }

    setPurchasing(true);

    const subtotal = cart.reduce((sum, item) => sum + item.pkg.priceGHS, 0);
    const charge = subtotal * (transactionCharge / 100);
    const totalAmount = subtotal + charge;

    const handler = (window as any).PaystackPop.setup({
      key: publicKey,
      email: "customer@wirenet.com",
      amount: Math.ceil(totalAmount * 100),
      currency: "GHS",
      ref: `DG-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      metadata: {
        custom_fields: [
          {
            display_name: "Items Count",
            variable_name: "items_count",
            value: cart.length.toString(),
          },
        ],
      },
      callback: (response: any) => {
        completeBulkOrder(response.reference);
      },
      onClose: () => {
        alert("Transaction cancelled");
        setPurchasing(false);
      },
    });

    handler.openIframe();
  };

  const completeBulkOrder = async (reference: string) => {
    try {
      const orderPromises = cart.map((item, index) => 
        fetch("/api/datagod/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shortId: `${reference}-${index + 1}`,
            customerPhone: item.phoneNumber,
            packageName: item.pkg.packageName,
            packagePrice: item.pkg.priceGHS,
            status: "PAID",
            paymentReference: reference,
          }),
        })
      );

      await Promise.all(orderPromises);

      alert(`Payment successful! ${cart.length} orders created.`);
      setCart([]);
    } catch (error) {
      console.error("Purchase error:", error);
      alert("Error creating orders");
    } finally {
      setPurchasing(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.pkg.priceGHS, 0);
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
        <h1 style={styles.h1}>DataGod Vending Platform</h1>
        <p style={styles.subtitle}>Cheapest Data Prices - 24hr Delivery</p>
      </div>

      <div style={styles.contactBar}>
        Contact us for support | WhatsApp: Chat with us
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
              <p><strong>Package:</strong> {statusReport.packageName}</p>
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
                <p style={styles.packageCardName}>{pkg.packageName}</p>
                <p style={styles.packageCardPrice}>GH₵{pkg.priceGHS}</p>
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
                <p style={styles.packageName}>{selectedPackage.packageName}</p>
                <p style={styles.packagePrice}>GH₵{selectedPackage.priceGHS}</p>
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
              Add More +
            </Button>
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
                    <p style={styles.cartItemPkg}>{item.pkg.packageName} - GH₵{item.pkg.priceGHS}</p>
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

      {settings.whatsappLink && (
        <button
          onClick={handleWhatsAppClick}
          style={styles.whatsappButton}
          title="Chat on WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}

const styles: any = {
  body: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f4f4f9",
    color: "#333",
  },
  header: {
    backgroundColor: "white",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
    padding: "20px",
    textAlign: "center" as const,
    borderBottom: "3px solid #ffcc00",
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
    color: "#666",
    fontSize: "1.1em",
  },
  contactBar: {
    backgroundColor: "#1a1a1a",
    color: "white",
    padding: "10px",
    textAlign: "center" as const,
    borderRadius: "5px",
    margin: "20px",
  },
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
  },
  statusChecker: {
    backgroundColor: "#e9ecef",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "30px",
    textAlign: "center" as const,
  },
  statusCheckerH2: {
    marginTop: 0,
    color: "#007bff",
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
    width: "150px",
  },
  statusButton: {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  statusReport: {
    marginTop: "15px",
    textAlign: "left" as const,
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "5px",
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
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #ddd",
  },
  selectedPackageInfo: {
    textAlign: "center" as const,
  },
  packageName: {
    fontSize: "2em",
    fontWeight: "bold",
    color: "#ffcc00",
    margin: "10px 0",
  },
  packagePrice: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  noSelection: {
    color: "#999",
    textAlign: "center" as const,
  },
  buyButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#ffcc00",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.1em",
  },
  loading: {
    textAlign: "center" as const,
    color: "#666",
  },
  packagesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  packageCard: {
    padding: "20px",
    backgroundColor: "#fff",
    border: "2px solid #ddd",
    borderRadius: "8px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.3s",
  },
  packageCardSelected: {
    border: "2px solid #ffcc00",
    backgroundColor: "#fffbf0",
    boxShadow: "0 0 10px rgba(255, 204, 0, 0.3)",
  },
  packageCardName: {
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#ffcc00",
    margin: "10px 0",
  },
  packageCardPrice: {
    fontSize: "1.2em",
    fontWeight: "bold",
    color: "#1a1a1a",
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
    padding: "20px",
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
    padding: "10px",
    borderBottom: "1px solid #eee",
  },
  cartItemPhone: {
    fontWeight: "bold",
    margin: 0,
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
  },
  cartSummary: {
    borderTop: "2px solid #eee",
    paddingTop: "15px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
    color: "#666",
  },
  summaryTotal: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "10px",
    marginBottom: "20px",
    fontSize: "1.2em",
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
};
