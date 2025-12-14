import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { ordersAPI, packagesAPI, settingsAPI } from "@/lib/supabase";

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPackages();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const charge = await settingsAPI.get("fastnet", "transactionCharge");
      if (charge) {
        setTransactionCharge(parseFloat(charge));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const data = await packagesAPI.getByCategory("fastnet");
      setPackages(data || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
      setMessage("❌ Failed to load packages");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (price: number) => {
    return price + (price * transactionCharge) / 100;
  };

  const handleAddToCart = () => {
    if (!phoneNumber || !selectedPackage) {
      setMessage("❌ Please enter phone number and select a package");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    setCart([...cart, { id: Date.now().toString(), pkg: selectedPackage, phoneNumber }]);
    setPhoneNumber("");
    setSelectedPackage(null);
    setMessage("✅ Added to cart");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handlePayment = async () => {
    const itemsToProcess = cart.length > 0 ? cart : selectedPackage && phoneNumber ? [{ id: Date.now().toString(), pkg: selectedPackage, phoneNumber }] : null;

    if (!itemsToProcess) {
      setMessage("❌ Please select a package and enter phone number");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setPurchasing(true);

    try {
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("❌ Payment configuration error");
        setPurchasing(false);
        return;
      }

      const totalAmount = itemsToProcess.reduce((sum: number, item: any) => sum + calculateTotal(item.pkg.price), 0);

      const handler = (window as any).PaystackPop.setup({
        key: publicKey,
        email: "customer@example.com",
        amount: Math.round(totalAmount * 100),
        currency: "GHS",
        ref: `FN${Date.now()}`,
        onClose: () => {
          setMessage("⚠️ Transaction cancelled");
          setPurchasing(false);
          setTimeout(() => setMessage(""), 3000);
        },
        callback: async (response: any) => {
          try {
            console.log("✅ Payment successful:", response);

            let successCount = 0;
            for (const item of itemsToProcess) {
              try {
                await ordersAPI.create({
                  phone: item.phoneNumber,
                  price: item.pkg.price,
                  package_price: item.pkg.price,
                  amount: calculateTotal(item.pkg.price),
                  status: "PENDING",
                  category: "fastnet",
                  supplier: "hubnet",
                });
                successCount++;
              } catch (error) {
                console.error("Error creating order:", error);
              }
            }

            if (successCount === itemsToProcess.length) {
              setMessage(`✅ Payment successful! ${successCount} order(s) created.`);
              setCart([]);
              setPhoneNumber("");
              setSelectedPackage(null);
            } else {
              setMessage(`⚠️ Payment successful but only ${successCount}/${itemsToProcess.length} orders created`);
            }
          } catch (error) {
            console.error("Error:", error);
            setMessage("❌ Failed to process order");
          } finally {
            setPurchasing(false);
            setTimeout(() => setMessage(""), 4000);
          }
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("Paystack error:", error);
      setMessage("❌ Failed to initialize payment");
      setPurchasing(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900 mb-4">Loading...</div>
          <div className="text-blue-600">Fetching packages from database...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button onClick={() => navigate("/")} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2">
            <ArrowLeft size={20} /> Back to WireNet
          </button>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">FastNet - NON-EXPIRY MTN DATA</h1>
          <p className="text-blue-700">⚡ Super Fast Delivery • 5-20 Minutes</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.includes("✅") ? "bg-green-100 text-green-900" : message.includes("⚠️") ? "bg-yellow-100 text-yellow-900" : "bg-red-100 text-red-900"}`}>
            {message}
          </div>
        )}

        <div className="bg-blue-600 text-white p-4 rounded-lg mb-8 flex justify-between items-center">
          <span>📞 Contact: +233 XXX XXX XXX</span>
          <a href="#" className="hover:underline">
            💬 WhatsApp: Chat with us
          </a>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Available Packages</h2>
          {packages.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-gray-600">No packages available</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedPackage?.id === pkg.id ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <div className="font-bold text-blue-900">{pkg.dataAmount}GB</div>
                  <div className="text-lg font-bold text-blue-600">GH₵{pkg.price}</div>
                  <div className="text-xs text-gray-600">⏱ {pkg.deliveryTime}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-6">Purchase Data</h2>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <Input
                type="text"
                placeholder="Enter MTN number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Selected Package</label>
              {selectedPackage ? (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-900">{selectedPackage.dataAmount}GB</div>
                  <div className="text-blue-600">GH₵{selectedPackage.price}</div>
                  <div className="text-lg font-bold text-blue-900 mt-2">Total: GH₵{calculateTotal(selectedPackage.price).toFixed(2)}</div>
                </div>
              ) : (
                <div className="text-gray-500">Select a package above</div>
              )}
            </div>

            <div className="flex flex-col gap-2 justify-end">
              <Button onClick={handleAddToCart} disabled={!phoneNumber || !selectedPackage} variant="outline">
                <ShoppingCart size={16} className="mr-2" /> Add More +
              </Button>
              <Button onClick={handlePayment} disabled={purchasing || (!cart.length && (!phoneNumber || !selectedPackage))} className="bg-green-600 hover:bg-green-700">
                {purchasing ? "Processing..." : "Pay with Paystack"}
              </Button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-bold text-gray-900 mb-3">
                <ShoppingCart size={16} className="inline mr-2" />
                Cart ({cart.length} items)
              </h3>
              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                    <span>
                      {item.pkg.dataAmount}GB - {item.phoneNumber} - GH₵{calculateTotal(item.pkg.price).toFixed(2)}
                    </span>
                    <button onClick={() => handleRemoveFromCart(item.id)} className="text-red-600 hover:text-red-800 font-bold">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-right font-bold text-lg text-blue-900">
                Total: GH₵{cart.reduce((sum, item) => sum + calculateTotal(item.pkg.price), 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
