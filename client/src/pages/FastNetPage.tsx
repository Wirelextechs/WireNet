import { useEffect, useState, useRef } from "react";
import { MessageCircle, ArrowLeft, ShoppingCart, Trash2, Search, Zap, Package, Mail, Phone, CheckCircle, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import AnnouncementBanner, { type AnnouncementSeverity } from "@/components/ui/announcement-banner";
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
  email: string;
}

export default function FastNetPage() {
  const [, navigate] = useLocation();
  const purchaseSectionRef = useRef<HTMLDivElement>(null);
  const cartSectionRef = useRef<HTMLDivElement>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [transactionCharge, setTransactionCharge] = useState(1.3);
  const [whatsappLink, setWhatsappLink] = useState("");
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
        if (data.transactionCharge) {
          setTransactionCharge(parseFloat(data.transactionCharge));
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
      const data = await packagesAPI.getByCategory("fastnet");
      setPackages(data || []);
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
      const response = await fetch(`/api/fastnet/orders/status/${statusCheckId}`);
      if (response.ok) {
        const order = await response.json();
        setStatusReport({
          shortId: order.shortId || order.short_id,
          status: order.status,
          packageDetails: order.packageDetails || order.package_details,
          createdAt: new Date(order.createdAt || order.created_at).toLocaleString(),
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
    value = value.replace(/\D/g, '');
    if (value.startsWith('233')) {
      value = '0' + value.substring(3);
    }
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    setPhoneNumber(value);
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
      alert("Please enter a valid 10-digit phone number");
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
    
    // Auto-scroll to cart section
    setTimeout(() => {
      cartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
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
      return;
    }

    if (!(window as any).PaystackPop) {
      alert("Payment system not loaded. Please refresh the page.");
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
        ref: `FASTNET-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metadata: {
          wirenet: {
            service: "fastnet",
            items: cart.map((item) => ({
              phoneNumber: item.phoneNumber,
              email: item.email,
              dataAmount: item.pkg.dataAmount,
              price: item.pkg.price,
            })),
          },
        },
        callback: function(response: any) {
          const cartItems = [...cart];
          
          // Navigate immediately - don't make customer wait
          setCart([]);
          setPhoneNumber("");
          setSelectedPackage(null);
          setCustomerEmail("");
          setPurchasing(false);
          navigate(`/order/success/${response.reference}?service=fastnet`);
          
          // Process orders in background (webhook also handles this as backup)
          const processOrdersInBackground = async () => {
            for (const item of cartItems) {
              try {
                await fetch("/api/fastnet/purchase", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    phoneNumber: item.phoneNumber,
                    dataAmount: item.pkg.dataAmount,
                    price: item.pkg.price,
                    reference: response.reference,
                  }),
                });
              } catch (error) {
                console.error("Error creating order:", error);
              }
            }
          };
          
          processOrdersInBackground();
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Announcement */}
      <AnimatePresence>
        {announcement.active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white overflow-hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-3">
              <AnnouncementBanner
                text={announcement.text}
                link={announcement.link}
                severity={announcement.severity}
                active={announcement.active}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 glass border-b border-white/10"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </motion.div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
                  <Wifi className="h-5 w-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">FastNet Data</span>
              </h1>
              <p className="text-sm text-muted-foreground">Ultra-fast delivery • Premium quality</p>
            </div>
          </div>

          {whatsappLink && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="hidden md:block">
              <Button variant="ghost" onClick={handleWhatsAppClick} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Support
              </Button>
            </motion.div>
          )}
        </div>
      </motion.header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Status Checker */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 border border-violet-500/20 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Search className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-bold">Track Your Order</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="Enter Order ID"
              value={statusCheckId}
              onChange={(e) => setStatusCheckId(e.target.value)}
              className="flex-1 rounded-xl bg-white/50 border-white/20"
            />
            <Button
              onClick={handleStatusCheck}
              disabled={statusLoading}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl"
            >
              {statusLoading ? "Checking..." : "Check Status"}
            </Button>
          </div>
          <AnimatePresence>
            {statusReport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 rounded-2xl bg-white/60 backdrop-blur-sm"
              >
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Order ID:</span> <strong>{statusReport.shortId}</strong></div>
                  <div><span className="text-muted-foreground">Status:</span> <strong className={statusReport.status === "FULFILLED" ? "text-emerald-600" : statusReport.status === "FAILED" ? "text-red-600" : "text-amber-600"}>{statusReport.status}</strong></div>
                  <div><span className="text-muted-foreground">Package:</span> <strong>{statusReport.packageDetails}</strong></div>
                  <div><span className="text-muted-foreground">Date:</span> <strong>{statusReport.createdAt}</strong></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Packages Grid */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Select Package</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No packages available</div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            >
              {packages.map((pkg) => (
                <motion.div
                  key={pkg.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedPackage(pkg);
                    setTimeout(() => {
                      purchaseSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className={`
                    relative p-4 rounded-2xl cursor-pointer transition-all duration-300
                    ${selectedPackage?.id === pkg.id 
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-xl shadow-violet-500/30" 
                      : "bg-white/70 backdrop-blur-sm border border-white/30 hover:border-violet-300 hover:shadow-lg"}
                  `}
                >
                  {selectedPackage?.id === pkg.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1"
                    >
                      <CheckCircle className="h-4 w-4 text-white" />
                    </motion.div>
                  )}
                  <p className={`text-2xl font-bold ${selectedPackage?.id === pkg.id ? "text-white" : "text-violet-600"}`}>
                    {pkg.dataAmount}
                  </p>
                  <p className={`text-lg font-semibold ${selectedPackage?.id === pkg.id ? "text-white/90" : "text-foreground"}`}>
                    GH₵{pkg.price}
                  </p>
                  <p className={`text-xs mt-1 ${selectedPackage?.id === pkg.id ? "text-white/70" : "text-muted-foreground"}`}>
                    ⏱ {pkg.deliveryTime}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.section>

        {/* Purchase Form */}
        <motion.section
          ref={purchaseSectionRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Phone Input */}
          <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/30">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-violet-600" />
              <h3 className="font-semibold">Phone Number</h3>
            </div>
            <Input
              type="tel"
              placeholder="0xxxxxxxxx"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className={`rounded-xl ${phoneError ? "border-red-400" : ""}`}
            />
            {phoneError && <p className="text-red-500 text-xs mt-2">{phoneError}</p>}
          </div>

          {/* Email Input */}
          <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/30">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-fuchsia-600" />
              <h3 className="font-semibold">Email Address</h3>
            </div>
            <Input
              type="email"
              placeholder="your@email.com"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setEmailError(e.target.value && !isValidEmail(e.target.value) ? "Invalid email" : "");
              }}
              className={`rounded-xl ${emailError ? "border-red-400" : ""}`}
            />
            {emailError && <p className="text-red-500 text-xs mt-2">{emailError}</p>}
          </div>

          {/* Selected Package */}
          <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/30">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold">Selected</h3>
            </div>
            {selectedPackage ? (
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-600">{selectedPackage.dataAmount}</p>
                <p className="text-lg font-semibold">GH₵{selectedPackage.price}</p>
                <p className="text-sm text-emerald-600">Total: GH₵{calculateTotal(selectedPackage.price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Select a package above</p>
            )}
          </div>

          {/* Add to Cart Button */}
          <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/30 flex flex-col justify-center">
            <Button
              onClick={addToCart}
              disabled={!phoneNumber || !selectedPackage || !customerEmail || !!phoneError || !!emailError}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Add items then pay all at once
            </p>
          </div>
        </motion.section>

        {/* Cart Section */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.section
              ref={cartSectionRef}
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="rounded-3xl bg-white/80 backdrop-blur-sm border border-white/30 p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-bold">Your Cart ({cart.length})</h2>
              </div>

              <div className="space-y-3 mb-6">
                {cart.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200"
                  >
                    <div>
                      <p className="font-bold">{item.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">{item.pkg.dataAmount} • GH₵{item.pkg.price}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>GH₵{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Fee ({transactionCharge}%)</span>
                  <span>GH₵{cartCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>Total</span>
                  <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">GH₵{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={purchasing}
                className="w-full mt-6 h-14 text-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl shadow-lg shadow-emerald-500/30"
              >
                {purchasing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Pay GH₵{cartTotal.toFixed(2)}
                  </>
                )}
              </Button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Floating WhatsApp */}
      {whatsappLink && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleWhatsAppClick}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 pulse-glow"
          aria-label="Chat on WhatsApp"
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      )}
    </div>
  );
}
