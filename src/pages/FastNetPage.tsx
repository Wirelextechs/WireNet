import { useState, useEffect } from "react";

interface Package {
  dataAmount: number;
  price: number;
  deliveryTime: string;
}

export default function FastNetPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [purchasing, setPurchasing] = useState(false);

  const packages: Package[] = [
    { dataAmount: 1, price: 5, deliveryTime: "5-10 mins" },
    { dataAmount: 2, price: 9, deliveryTime: "5-10 mins" },
    { dataAmount: 5, price: 20, deliveryTime: "10-15 mins" },
    { dataAmount: 10, price: 35, deliveryTime: "15-20 mins" },
    { dataAmount: 20, price: 65, deliveryTime: "20 mins" },
    { dataAmount: 50, price: 150, deliveryTime: "20 mins" },
    { dataAmount: 100, price: 280, deliveryTime: "20 mins" },
  ];

  const calculateTotal = (price: number) => {
    return price + (price * 1.3) / 100;
  };

  const saveOrderToLocalStorage = (order: any) => {
    try {
      const existing = localStorage.getItem("fastnetOrders");
      const orders = existing ? JSON.parse(existing) : [];
      orders.push(order);
      localStorage.setItem("fastnetOrders", JSON.stringify(orders));
      console.log("✅ Order saved to localStorage:", order);
      return true;
    } catch (error) {
      console.error("Error saving order:", error);
      return false;
    }
  };

  const handleAddToCart = () => {
    if (!phoneNumber || !selectedPackage) {
      alert("Please enter phone number and select a package");
      return;
    }
    setCart([...cart, { phoneNumber, pkg: selectedPackage }]);
    setPhoneNumber("");
    setSelectedPackage(null);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handlePayment = async () => {
    const itemsToProcess = cart.length > 0 ? cart : selectedPackage && phoneNumber ? [{ phoneNumber, pkg: selectedPackage }] : null;

    if (!itemsToProcess) {
      alert("Please select a package and enter phone number");
      return;
    }

    setPurchasing(true);

    try {
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        alert("Payment configuration error");
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
          alert("Transaction cancelled");
          setPurchasing(false);
        },
        callback: async (response: any) => {
          try {
            console.log("✅ Payment successful:", response);

            // Create and save orders
            itemsToProcess.forEach((item: any, idx: number) => {
              const order = {
                id: `FN${Date.now()}-${idx}`,
                phone: item.phoneNumber,
                price: item.pkg.price,
                packagePrice: item.pkg.price,
                amount: calculateTotal(item.pkg.price),
                status: "PENDING",
                createdAt: new Date().toISOString(),
              };
              saveOrderToLocalStorage(order);
            });

            alert(`✅ Payment successful! ${itemsToProcess.length} order(s) created.`);
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
      });

      handler.openIframe();
    } catch (error) {
      console.error("Paystack error:", error);
      alert("Failed to initialize payment");
      setPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <a href="/" className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2">
            ← Back to WireNet
          </a>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">FastNet - NON-EXPIRY MTN DATA</h1>
          <p className="text-blue-700">⚡ Super Fast Delivery • 5-20 Minutes</p>
        </div>

        <div className="bg-blue-600 text-white p-4 rounded-lg mb-8 flex justify-between items-center">
          <span>📞 Contact: +233 XXX XXX XXX</span>
          <a href="#" className="hover:underline">
            💬 WhatsApp: Chat with us
          </a>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Available Packages</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {packages.map((pkg, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-4 rounded-lg border-2 transition ${
                  selectedPackage?.dataAmount === pkg.dataAmount ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-blue-400"
                }`}
              >
                <div className="font-bold text-blue-900">{pkg.dataAmount}GB</div>
                <div className="text-lg font-bold text-blue-600">GH₵{pkg.price}</div>
                <div className="text-xs text-gray-600">⏱ {pkg.deliveryTime}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-6">Purchase Data</h2>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <input
                type="text"
                placeholder="Enter MTN number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
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
              <button
                onClick={handleAddToCart}
                disabled={!phoneNumber || !selectedPackage}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400"
              >
                Add More +
              </button>
              <button
                onClick={handlePayment}
                disabled={purchasing || (!cart.length && (!phoneNumber || !selectedPackage))}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400"
              >
                {purchasing ? "Processing..." : "Pay with Paystack"}
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-bold text-gray-900 mb-3">🛒 Cart ({cart.length} items)</h3>
              <div className="space-y-2 mb-4">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                    <span>
                      {item.pkg.dataAmount}GB - {item.phoneNumber} - GH₵{calculateTotal(item.pkg.price).toFixed(2)}
                    </span>
                    <button onClick={() => handleRemoveFromCart(idx)} className="text-red-600 hover:text-red-800 font-bold">
                      ✕
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
