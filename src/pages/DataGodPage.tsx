import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface Package {
  id: string;
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

interface Order {
  id: string;
  shortId: string;
  customerPhone: string;
  packageGB: number;
  packagePrice: number;
  packageDetails: string;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED";
  createdAt: Date;
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
    loadTransactionSettings();
  }, []);

  const fetchSettings = () => {
    try {
      const saved = localStorage.getItem("wirenetSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        setWhatsappLink(parsed.whatsappLink || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const loadTransactionSettings = () => {
    try {
      const saved = localStorage.getItem("datagodSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.transactionCharge) {
          setTransactionCharge(parseFloat(parsed.transactionCharge));
        }
      }
    } catch (error) {
      console.error("Error loading transaction settings:", error);
    }
  };

  const fetchPackages = () => {
    try {
      const saved = localStorage.getItem("datagodPackages");
      if (saved) {
        const parsed = JSON.parse(saved);
        const enabledPackages = parsed.filter((p: Package) => p.isEnabled).sort((a: any, b: any) => a.dataValueGB - b.dataValueGB);
        setPackages(enabledPackages);
      } else {
        const defaults = [
          { id: "1", packageName: "1GB", dataValueGB: 1, priceGHS: 2.5, isEnabled: true },
          { id: "2", packageName: "2GB", dataValueGB: 2, priceGHS: 4.5, isEnabled: true },
          { id: "3", packageName: "5GB", dataValueGB: 5, priceGHS: 10, isEnabled: true },
          { id: "4", packageName: "10GB", dataValueGB: 10, priceGHS: 18, isEnabled: true },
        ];
        localStorage.setItem("datagodPackages", JSON.stringify(defaults));
        setPackages(defaults.sort((a, b) => a.dataValueGB - b.dataValueGB));
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching packages:", error);
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
      const saved = localStorage.getItem("datagodOrders");
      if (saved) {
        const orders = JSON.parse(saved);
        const order = orders.find((o: Order) => o.shortId === statusCheckId);
        if (order) {
          setStatusReport({
            shortId: order.shortId,
            status: order.status,
            packageDetails: order.packageDetails,
            createdAt: new Date(order.createdAt).toLocaleDateString(),
          });
        } else {
          setStatusReport(null);
          alert("Order not found");
        }
      }
    } catch (error) {
      console.error("Status check error:", error);
      setStatusReport(null);
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
      alert("Paystack public key not found. Please check Vercel environment variables (VITE_PAYSTACK_PUBLIC_KEY).");
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
      const saved = localStorage.getItem("datagodOrders") || "[]";
      const existingOrders = JSON.parse(saved);
      const newOrders: Order[] = [];

      cart.forEach((item, index) => {
        const order: Order = {
          id: `${Date.now()}-${index}`,
          shortId: `${reference}-${index + 1}`,
          customerPhone: item.phoneNumber,
          packageGB: item.pkg.dataValueGB,
          packagePrice: item.pkg.priceGHS,
          packageDetails: item.pkg.packageName,
          status: "PAID",
          createdAt: new Date(),
        };
        newOrders.push(order);
      });

      localStorage.setItem("datagodOrders", JSON.stringify([...existingOrders, ...newOrders]));

      alert(`✅ Payment successful! ${cart.length} orders created.`);
      setCart([]);
    } catch (error) {
      console.error("Purchase error:", error);
      alert("❌ Error creating orders");
    } finally {
      setPurchasing(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.pkg.priceGHS, 0);
  const cartCharge = cartSubtotal * (transactionCharge / 100);
  const cartTotal = cartSubtotal + cartCharge;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <div className="bg-white shadow-md p-5 text-center border-b-4 border-yellow-400">
        <div className="text-left">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-2.5"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to WireNet
          </Button>
        </div>
        <h1 className="text-gray-900 mb-1 text-4xl font-bold">DataGod Vending Platform</h1>
        <p className="text-gray-600 text-lg">Cheapest Data Prices • 24hr Delivery</p>
      </div>

      <div className="bg-gray-900 text-white p-2.5 text-center rounded mx-5 my-5">
        📞 Contact: <a href="tel:+233XXXXXXXXX" className="text-yellow-400 no-underline font-bold">+233 XXX XXX XXX</a> | 
        💬 WhatsApp: <a href="https://wa.me/233XXXXXXXXX" className="text-yellow-400 no-underline font-bold">Chat with us</a>
      </div>

      <main className="max-w-6xl mx-auto p-5">
        {/* Status Checker */}
        <div className="bg-gray-200 p-5 rounded-lg mb-8 text-center">
          <h2 className="mt-0 text-blue-600">Check Order Status</h2>
          <div className="flex justify-center gap-2.5 flex-wrap">
            <Input
              type="text"
              placeholder="Enter Order ID"
              value={statusCheckId}
              onChange={(e) => setStatusCheckId(e.target.value)}
              className="p-2.5 border border-gray-300 rounded w-40"
            />
            <Button
              onClick={handleStatusCheck}
              disabled={statusLoading}
              className="px-5 py-2.5 bg-blue-600 text-white border-none rounded cursor-pointer hover:bg-blue-700"
            >
              {statusLoading ? "Checking..." : "Check Status"}
            </Button>
          </div>
          {statusReport && (
            <div className="mt-4 text-left p-2.5 bg-white rounded">
              <p><strong>Order ID:</strong> {statusReport.shortId}</p>
              <p><strong>Status:</strong> {statusReport.status}</p>
              <p><strong>Package:</strong> {statusReport.packageDetails}</p>
              <p><strong>Date:</strong> {statusReport.createdAt}</p>
            </div>
          )}
        </div>

        {/* Packages Grid */}
        <h2 className="text-3xl mt-8 mb-5 text-gray-900">Available Packages</h2>
        {loading ? (
          <p className="text-center text-gray-600">Loading packages...</p>
        ) : packages.length === 0 ? (
          <p className="text-center text-gray-600">No packages available</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-5 bg-white border-2 rounded-lg text-center cursor-pointer transition-all hover:border-yellow-400 ${
                  selectedPackage?.id === pkg.id
                    ? "border-yellow-400 bg-yellow-50 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                <p className="text-xl font-bold text-yellow-400 my-2.5">{pkg.packageName}</p>
                <p className="text-lg font-bold text-gray-900">GH₵{pkg.priceGHS}</p>
              </div>
            ))}
          </div>
        )}

        {/* Purchase Section */}
        <h2 className="text-3xl mt-8 mb-5 text-gray-900">Purchase Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="p-5 bg-gray-100 rounded-lg border border-gray-300">
            <h3>Phone Number</h3>
            <Input
              type="tel"
              placeholder="Enter MTN number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="p-2.5 border border-gray-300 rounded w-full"
            />
          </div>

          <div className="p-5 bg-gray-100 rounded-lg border border-gray-300">
            <h3>Selected Package</h3>
            {selectedPackage ? (
              <div className="text-center">
                <p className="text-4xl font-bold text-yellow-400 my-2.5">{selectedPackage.packageName}</p>
                <p className="text-2xl font-bold text-gray-900">GH₵{selectedPackage.priceGHS}</p>
              </div>
            ) : (
              <p className="text-gray-400 text-center">Select a package above</p>
            )}
          </div>

          <div className="p-5 bg-gray-100 rounded-lg border border-gray-300">
            <h3>Add to Cart</h3>
            <Button
              onClick={addToCart}
              disabled={!phoneNumber || !selectedPackage}
              className={`w-full p-3 bg-yellow-400 text-gray-900 border-none rounded cursor-pointer font-bold text-lg hover:bg-yellow-500 ${
                !phoneNumber || !selectedPackage ? "opacity-50" : ""
              }`}
            >
              Add More +
            </Button>
          </div>
        </div>

        {/* Cart Section */}
        {cart.length > 0 && (
          <div className="bg-white p-5 rounded-lg shadow-lg mt-8">
            <h2 className="text-3xl mt-0 mb-5 text-gray-900">
              <ShoppingCart size={24} className="mr-2.5 align-middle inline" />
              Your Cart ({cart.length})
            </h2>
            <div className="mb-5">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-2.5 border-b border-gray-200">
                  <div>
                    <p className="font-bold m-0">{item.phoneNumber}</p>
                    <p className="text-gray-600 m-0 text-sm">{item.pkg.packageName} - GH₵{item.pkg.priceGHS}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="bg-transparent border-none text-red-600 cursor-pointer hover:text-red-700">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="border-t-2 border-gray-200 pt-4">
              <div className="flex justify-between mb-1.5 text-gray-600">
                <span>Subtotal:</span>
                <span>GH₵{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-1.5 text-gray-600">
                <span>Fee ({transactionCharge}%):</span>
                <span>GH₵{cartCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-2.5 mb-5 text-xl font-bold text-gray-900">
                <span>Total:</span>
                <span>GH₵{cartTotal.toFixed(2)}</span>
              </div>
              
              <Button
                onClick={handleCheckout}
                disabled={purchasing}
                className="w-full p-4 bg-green-500 text-white border-none rounded font-bold text-lg hover:bg-green-600"
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
          className="fixed bottom-6 right-6 bg-green-500 text-white border-none rounded-full w-14 h-14 flex items-center justify-center cursor-pointer shadow-lg z-50 hover:bg-green-600"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
