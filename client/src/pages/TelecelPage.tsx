import { useEffect, useState, useRef } from "react";
import { MessageCircle, ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { packagesAPI } from "@/lib/supabase";
import AnnouncementBanner, { type AnnouncementSeverity } from "@/components/ui/announcement-banner";

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
  email: string;
}

export default function TelecelPage() {
  const [, navigate] = useLocation();
  const purchaseSectionRef = useRef<HTMLDivElement>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [transactionCharge, setTransactionCharge] = useState(1.3);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [statusCheckId, setStatusCheckId] = useState("");
  const [statusReport, setStatusReport] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [announcement, setAnnouncement] = useState<{ text: string; link: string; severity: AnnouncementSeverity; active: boolean }>({
    text: "",
    link: "",
    severity: "info",
    active: false,
  });

  useEffect(() => {
    loadPackages();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setWhatsappLink(data.whatsappLink || "");
        if (data.telecelTransactionCharge) {
          setTransactionCharge(parseFloat(data.telecelTransactionCharge));
        }
        setAnnouncement({
          text: data.announcementText || "",
          link: data.announcementLink || "",
          severity: (data.announcementSeverity as AnnouncementSeverity) || "info",
          active: data.announcementActive === true,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (whatsappLink) {
      window.open(whatsappLink, "_blank");
    }
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/telecel/packages/public");
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
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
      const response = await fetch(`/api/telecel/orders/status/${statusCheckId}`);
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove all non-digits
    value = value.replace(/\D/g, '');

    // Auto-convert 233 to 0
    if (value.startsWith('233')) {
      value = '0' + value.substring(3);
    }

    // Limit to 10 digits
    if (value.length > 10) {
      value = value.substring(0, 10);
    }

    setPhoneNumber(value);

    // Validation
    if (value.length > 0 && (value.length !== 10 || !value.startsWith('0'))) {
      setPhoneError("Number must be 10 digits starting with 0");
    } else {
      setPhoneError("");
    }
  };

  const isValidPhone = (phone: string) => {
    return /^0\d{9}$/.test(phone);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addToCart = () => {
    if (!phoneNumber || !selectedPackage || !customerEmail) {
      alert("Please enter phone number, email, and select a package");
      return;
    }
    
    if (!isValidPhone(phoneNumber)) {
      alert("Please enter a valid 10-digit Telecel number (e.g., 024xxxxxxx)");
      return;
    }

    if (!isValidEmail(customerEmail)) {
      alert("Please enter a valid email address");
      return;
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      pkg: selectedPackage,
      phoneNumber: phoneNumber,
      email: customerEmail,
    };
    setCart([...cart, newItem]);
    setPhoneNumber("");
    setSelectedPackage(null);
    setCustomerEmail("");
    setPhoneError("");
    setEmailError("");
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Please add items to cart first");
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      alert("Payment configuration error - Paystack key not found");
      console.error("VITE_PAYSTACK_PUBLIC_KEY is not set");
      return;
    }

    if (!(window as any).PaystackPop) {
      alert("Payment system not loaded. Please refresh the page.");
      console.error("PaystackPop is not available");
      return;
    }

    setPurchasing(true);

    const subtotal = cart.reduce((sum, item) => sum + item.pkg.price, 0);
    const charge = subtotal * (transactionCharge / 100);
    const totalAmount = subtotal + charge;

    try {
      const handler = (window as any).PaystackPop.setup({
        key: publicKey,
        email: cart[0]?.email || "customer@wirenet.com",
        amount: Math.ceil(totalAmount * 100),
        currency: "GHS",
        ref: `TC-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        callback: function(response: any) {
          console.log("Payment successful:", response.reference);
          const cartItems = [...cart];
          let successCount = 0;
          
          const processOrders = async () => {
            let firstOrderId = "";
            for (const item of cartItems) {
              try {
                const orderResponse = await fetch("/api/telecel/purchase", {
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
                  try {
                    const orderData = await orderResponse.json();
                    if (!firstOrderId && orderData.shortId) {
                      firstOrderId = orderData.shortId;
                    }
                  } catch {
                    // Response may not be JSON, continue
                  }
                }
              } catch (error) {
                console.error("Error creating order:", error);
              }
            }
            setCart([]);
            setPhoneNumber("");
            setSelectedPackage(null);
            setCustomerEmail("");
            setPurchasing(false);
            
            // Redirect to success page - use reference as fallback
            const orderId = firstOrderId || response.reference;
            navigate(`/order/success/${orderId}?service=telecel`);
          };
          
          processOrders();
        },
        onClose: () => {
          alert("Transaction cancelled");
          setPurchasing(false);
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("Paystack initialization error:", error);
      alert("Failed to initialize payment. Please try again.");
      setPurchasing(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.pkg.price, 0);
  const cartCharge = cartSubtotal * (transactionCharge / 100);
  const cartTotal = cartSubtotal + cartCharge;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <AnnouncementBanner
            text={announcement.text}
            link={announcement.link}
            severity={announcement.severity}
            active={announcement.active}
          />
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/")}
            >
              <ArrowLeft size={18} className="mr-2" />
              Back to WireNet
            </Button>
            <h1 className="text-xl font-semibold tracking-tight">TELECEL - RELIABLE DATA BUNDLES</h1>
            <p className="text-sm text-muted-foreground">Quick Delivery - Always Connected</p>
          </div>

          {whatsappLink ? (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" onClick={handleWhatsAppClick}>WhatsApp</Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
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
              style={{...styles.statusButton, backgroundColor: "#0369a1"}}
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
                onClick={() => {
                  setSelectedPackage(pkg);
                  setTimeout(() => {
                    purchaseSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                style={{
                  ...styles.packageCard,
                  ...(selectedPackage?.id === pkg.id ? {...styles.packageCardSelected, borderColor: "#0369a1", backgroundColor: "#cffafe"} : {}),
                }}
              >
                <p style={{...styles.packageCardName, color: "#0369a1"}}>{pkg.dataAmount}</p>
                <p style={styles.packageCardPrice}>GH₵{pkg.price}</p>
                <p style={styles.packageDelivery}>⏱ {pkg.deliveryTime}</p>
              </div>
            ))}
          </div>
        )}

        <h2 style={styles.sectionTitle}>Purchase Data</h2>
        <div style={styles.purchaseSection} ref={purchaseSectionRef}>
          <div style={styles.purchaseCard}>
            <h3>Phone Number</h3>
            <Input
              type="tel"
              placeholder="Enter Telecel number (e.g. 024...)"
              value={phoneNumber}
              onChange={handlePhoneChange}
              style={{
                ...styles.input,
                borderColor: phoneError ? "red" : "#ccc"
              }}
            />
            {phoneError && <p style={{ color: "red", fontSize: "0.8em", marginTop: "5px" }}>{phoneError}</p>}
          </div>

          <div style={styles.purchaseCard}>
            <h3>Email Address</h3>
            <Input
              type="email"
              placeholder="your@email.com"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                if (e.target.value && !isValidEmail(e.target.value)) {
                  setEmailError("Invalid email address");
                } else {
                  setEmailError("");
                }
              }}
              style={{
                ...styles.input,
                borderColor: emailError ? "red" : "#ccc"
              }}
            />
            {emailError && <p style={{ color: "red", fontSize: "0.8em", marginTop: "5px" }}>{emailError}</p>}
            <p style={{ fontSize: "0.8em", color: "#666", marginTop: "5px" }}>For Paystack receipts</p>
          </div>

          <div style={styles.purchaseCard}>
            <h3>Selected Package</h3>
            {selectedPackage ? (
              <div style={styles.selectedPackageInfo}>
                <p style={{...styles.packageName, color: "#0369a1"}}>{selectedPackage.dataAmount}</p>
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
              disabled={!phoneNumber || !selectedPackage || !customerEmail || !!phoneError || !!emailError}
              style={{
                ...styles.buyButton,
                backgroundColor: "#0369a1",
                opacity: !phoneNumber || !selectedPackage || !customerEmail || !!phoneError || !!emailError ? 0.5 : 1,
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
                style={{...styles.checkoutButton, backgroundColor: "#0369a1"}}
              >
                {purchasing ? "Processing..." : `Pay GH₵${cartTotal.toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

      </main>

      {whatsappLink ? (
        <Button
          type="button"
          onClick={handleWhatsAppClick}
          size="icon"
          className="fixed bottom-5 right-5 z-50 rounded-full"
          aria-label="Chat on WhatsApp"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={20} />
        </Button>
      ) : null}
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
    borderBottom: "3px solid #0369a1",
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
    color: "#0369a1",
    fontSize: "1.1em",
    fontWeight: "500",
  },
  contactBar: {
    backgroundColor: "#0369a1",
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
    backgroundColor: "#cffafe",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "30px",
    textAlign: "center" as const,
    border: "1px solid #a5f3fc",
  },
  statusCheckerH2: {
    marginTop: 0,
    color: "#003d5b",
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
    backgroundColor: "#0369a1",
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
    color: "#0369a1",
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
    backgroundColor: "#0369a1",
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
    border: "2px solid #0369a1",
    backgroundColor: "#cffafe",
    boxShadow: "0 0 15px rgba(3, 105, 161, 0.3)",
    transform: "scale(1.02)",
  },
  packageCardName: {
    fontSize: "1.4em",
    fontWeight: "bold",
    color: "#0369a1",
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
    backgroundColor: "#0369a1",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.2em",
  },
};
