import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { MessageCircle, Zap, Smartphone, Radio, Sparkles, ChevronRight, Store, ArrowLeft, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Shop {
  id: number;
  shopName: string;
  slug: string;
  description: string | null;
  logo: string | null;
}

interface ShopPackage {
  serviceType: string;
  packageId: string;
  packageName: string;
  basePrice: number;
  markupAmount: number;
  finalPrice: number;
  capacity?: string;
  network?: string;
}

interface PackagesByService {
  fastnet: ShopPackage[];
  datagod: ShopPackage[];
  at: ShopPackage[];
  telecel: ShopPackage[];
}

interface Settings {
  whatsappLink?: string;
}

export default function ShopStorefront() {
  const [, params] = useRoute("/shop/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug || "";
  
  const [shop, setShop] = useState<Shop | null>(null);
  const [packages, setPackages] = useState<PackagesByService>({
    fastnet: [],
    datagod: [],
    at: [],
    telecel: []
  });
  const [loadedServices, setLoadedServices] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Order state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ShopPackage | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (slug) {
      loadShop();
      loadSettings();
    }
  }, [slug]);

  const loadShop = async () => {
    try {
      const response = await fetch(`/api/shop/${slug}`);
      if (response.ok) {
        const data = await response.json();
        // API returns shop data directly or in data.shop wrapper
        setShop(data.shop || data);
      } else {
        setError("Shop not found");
      }
    } catch (err) {
      setError("Failed to load shop");
    }
  };

  const loadPackages = async (serviceType: string) => {
    try {
      const response = await fetch(`/api/shop/${slug}/packages?service=${serviceType}`);
      if (response.ok) {
        const data = await response.json();
        // API returns { serviceType: [...packages] } - extract and transform the array
        const rawPkgs = Array.isArray(data) ? data : (data[serviceType] || []);
        
        // Transform API response to match ShopPackage interface
        const transformedPkgs: ShopPackage[] = rawPkgs.map((p: any) => ({
          serviceType: serviceType,
          packageId: String(p.id),
          packageName: p.packageName || p.dataAmount || `${p.dataValueGB}GB`,
          basePrice: p.basePrice ?? p.price ?? 0,
          markupAmount: p.markup ?? 0,
          finalPrice: p.price ?? (p.basePrice + (p.markup || 0)),
          capacity: p.dataValueGB ? `${p.dataValueGB}GB` : p.dataAmount,
          network: serviceType === "fastnet" || serviceType === "datagod" ? "MTN" : 
                   serviceType === "at" ? "AirtelTigo" : "Telecel"
        }));
        
        setPackages(prev => ({ ...prev, [serviceType]: transformedPkgs }));
      }
      // Mark service as loaded regardless of success (to stop showing loader)
      setLoadedServices(prev => new Set(prev).add(serviceType));
    } catch (err) {
      console.error("Failed to load packages:", err);
      // Mark as loaded even on error to stop infinite loading
      setLoadedServices(prev => new Set(prev).add(serviceType));
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = async (serviceType: string) => {
    setSelectedService(serviceType);
    setSelectedPackage(null);
    if (packages[serviceType as keyof PackagesByService].length === 0) {
      await loadPackages(serviceType);
    }
  };

  const handleOrder = async () => {
    if (!selectedPackage || !phoneNumber) {
      setOrderError("Please select a package and enter a phone number");
      return;
    }
    
    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setOrderError("Please enter a valid 10-digit phone number");
      return;
    }

    // Redirect to the appropriate service page with shop parameters
    const params = new URLSearchParams({
      phone: cleanPhone,
      package: selectedPackage.packageId,
      price: selectedPackage.finalPrice.toString(),
      shopId: shop?.id?.toString() || "",
      shopMarkup: selectedPackage.markupAmount.toString(),
      shopName: shop?.shopName || ""
    });
    
    navigate(`/${selectedService}?${params.toString()}`);
  };

  const serviceConfigs = [
    {
      id: "fastnet",
      name: "FastNet",
      description: "MTN - 5-20 min delivery",
      icon: Zap,
      gradient: "from-amber-500 via-orange-500 to-red-500",
      network: "MTN"
    },
    {
      id: "datagod",
      name: "DataGod",
      description: "MTN - Up to 24hr delivery",
      icon: Sparkles,
      gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      network: "MTN"
    },
    {
      id: "at",
      name: "AT iShare",
      description: "AirtelTigo - Instant delivery",
      icon: Smartphone,
      gradient: "from-cyan-500 via-blue-500 to-indigo-500",
      network: "AT"
    },
    {
      id: "telecel",
      name: "Telecel",
      description: "Telecel - Fast processing",
      icon: Radio,
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      network: "Telecel"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Shop Not Found</h2>
            <p className="text-gray-500 mb-4">This shop doesn't exist or is no longer available.</p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft size={18} className="mr-2" /> Go to WireNet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo ? (
              <img src={shop.logo} alt={shop.shopName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-xl">{shop.shopName}</h1>
              <p className="text-sm text-gray-500">Powered by WireNet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {settings.whatsappLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(settings.whatsappLink, "_blank")}
              >
                <MessageCircle size={18} className="mr-1" /> Contact
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Shop Description */}
        {shop.description && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
            <p className="text-gray-600">{shop.description}</p>
          </div>
        )}

        {/* Service Selection */}
        {!selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-center mb-6">Select a Service</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceConfigs.map((service) => (
                <motion.button
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className="text-left"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                    <div className={`h-2 bg-gradient-to-r ${service.gradient}`} />
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-r ${service.gradient}`}>
                          <service.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{service.name}</h3>
                          <p className="text-sm text-gray-500">{service.description}</p>
                        </div>
                        <ChevronRight className="text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Package Selection */}
        {selectedService && !selectedPackage && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              onClick={() => setSelectedService(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} /> Back to services
            </button>
            
            <h2 className="text-xl font-bold mb-6">
              Select a {serviceConfigs.find(s => s.id === selectedService)?.name} Package
            </h2>
            
            {!loadedServices.has(selectedService) ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading packages...</p>
              </div>
            ) : packages[selectedService as keyof PackagesByService].length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No packages available for this service yet.</p>
                <Button variant="outline" onClick={() => setSelectedService(null)}>
                  <ArrowLeft size={18} className="mr-2" /> Choose another service
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {packages[selectedService as keyof PackagesByService].map((pkg) => (
                  <motion.button
                    key={`${pkg.serviceType}-${pkg.packageId}`}
                    onClick={() => setSelectedPackage(pkg)}
                    className="text-left"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow hover:border-violet-300">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-800 mb-1">
                          {pkg.packageName}
                        </div>
                        <div className="text-xl font-bold text-violet-600">
                          GHS {pkg.finalPrice.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Order Form */}
        {selectedPackage && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              onClick={() => setSelectedPackage(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} /> Back to packages
            </button>
            
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Complete Your Order</CardTitle>
                <CardDescription>
                  {selectedPackage.packageName} - GHS {selectedPackage.finalPrice.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {orderError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipient Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="0244123456"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Enter the phone number to receive the data
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Package:</span>
                    <span className="font-medium">{selectedPackage.packageName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Network:</span>
                    <span className="font-medium">
                      {serviceConfigs.find(s => s.id === selectedService)?.network}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-violet-600">GHS {selectedPackage.finalPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <Button
                  onClick={handleOrder}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                >
                  <ShoppingCart size={18} className="mr-2" />
                  Place Order
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-gray-500">
          <p>
            Powered by{" "}
            <a href="/" className="text-violet-600 hover:underline">
              WireNet
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
