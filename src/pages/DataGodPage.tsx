import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Zap } from "lucide-react";
import { useLocation } from "wouter";

interface Package {
  id: string;
  packageName: string;
  dataValueGB: number;
  priceGHS: number;
}

export default function DataGodPage() {
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
      // Mock data for now - in production, fetch from Supabase
      const mockPackages: Package[] = [
        { id: "1", packageName: "1GB", dataValueGB: 1, priceGHS: 2.5 },
        { id: "2", packageName: "2GB", dataValueGB: 2, priceGHS: 4.5 },
        { id: "3", packageName: "5GB", dataValueGB: 5, priceGHS: 10 },
        { id: "4", packageName: "10GB", dataValueGB: 10, priceGHS: 18 },
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
      // TODO: Integrate with Paystack and Supabase
      alert(`Purchase initiated for ${selectedPackage.packageName} to ${phoneNumber}`);
    } catch (error) {
      console.error("Purchase error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-yellow-100">
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
          <h1 className="text-2xl font-bold text-yellow-600">DataGod</h1>
          <p className="text-sm text-gray-600 ml-auto">Cheapest Prices • 24hr Delivery</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            💰 Wholesale Data Prices
          </h2>
          <p className="text-xl text-gray-600">
            Get the cheapest data packages with guaranteed 24-hour delivery
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
                  <p className="text-3xl font-bold text-yellow-600 mb-2">
                    {selectedPackage.packageName}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    GH₵{selectedPackage.priceGHS}
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
                className="w-full bg-yellow-600 hover:bg-yellow-700"
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer transition-all ${
                    selectedPackage?.id === pkg.id
                      ? "ring-2 ring-yellow-600 bg-yellow-50"
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600 mb-2">
                      {pkg.packageName}
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      GH₵{pkg.priceGHS}
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
