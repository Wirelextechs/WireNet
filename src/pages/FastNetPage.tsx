import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Zap, Clock } from "lucide-react";
import { useLocation } from "wouter";

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
}

export default function FastNetPage() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      // Mock data for now - in production, fetch from database
      const mockPackages: Package[] = [
        { id: "1", dataAmount: "1GB", price: 5, deliveryTime: "5-10 mins" },
        { id: "2", dataAmount: "2GB", price: 9, deliveryTime: "5-10 mins" },
        { id: "3", dataAmount: "5GB", price: 20, deliveryTime: "10-15 mins" },
        { id: "4", dataAmount: "10GB", price: 35, deliveryTime: "15-20 mins" },
        { id: "5", dataAmount: "20GB", price: 65, deliveryTime: "20 mins" },
        { id: "6", dataAmount: "50GB", price: 150, deliveryTime: "20 mins" },
      ];
      setPackages(mockPackages);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching packages:", error);
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!phoneNumber || !selectedPackage) {
      alert("Please enter phone number and select a package");
      return;
    }

    try {
      // TODO: Integrate with Paystack and database
      alert(`Purchase initiated for ${selectedPackage.dataAmount} to ${phoneNumber}`);
    } catch (error) {
      console.error("Purchase error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-blue-600">FastNet</h1>
          <p className="text-sm text-gray-600 ml-auto">⚡ Super Fast • 5-20 mins Delivery</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            ⚡ Lightning Fast Data Delivery
          </h2>
          <p className="text-xl text-gray-600">
            Get your data in 5-20 minutes with competitive pricing
          </p>
        </div>

        {/* Purchase Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Phone Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone size={20} />
                Phone Number
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="tel"
                placeholder="Enter MTN number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Enter your MTN phone number to receive data
              </p>
            </CardContent>
          </Card>

          {/* Selected Package */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={20} />
                Selected Package
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedPackage ? (
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600 mb-2">
                    {selectedPackage.dataAmount}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mb-2">
                    GH₵{selectedPackage.price}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                    <Clock size={14} />
                    {selectedPackage.deliveryTime}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-center">Select a package below</p>
              )}
            </CardContent>
          </Card>

          {/* Purchase Button */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handlePurchase}
                disabled={!phoneNumber || !selectedPackage}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Buy Now
              </Button>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Secure payment via Paystack
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Packages Grid */}
        <div>
          <h3 className="text-2xl font-bold mb-6">Available Packages</h3>
          {loading ? (
            <p className="text-center text-gray-600">Loading packages...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer transition-all ${
                    selectedPackage?.id === pkg.id
                      ? "ring-2 ring-blue-600 bg-blue-50"
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 mb-2">
                      {pkg.dataAmount}
                    </p>
                    <p className="text-xl font-bold text-gray-900 mb-2">
                      GH₵{pkg.price}
                    </p>
                    <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                      <Clock size={12} />
                      {pkg.deliveryTime}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
