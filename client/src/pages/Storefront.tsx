import { useEffect, useState } from "react";
import { MessageCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
}

export default function Storefront() {
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (settings.whatsappLink) {
      window.open(settings.whatsappLink, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">WireNet</h1>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/login")}>
              Admin
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("/admin/login");
                  setMenuOpen(false);
                }}
              >
                Admin
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            All-in-One Data & Internet Solutions
          </h2>
          <p className="text-xl text-gray-600">
            Choose from our premium categories for the best deals and fastest service
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* DataGod Category */}
          {settings.datagodEnabled && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-2xl">💰 DataGod</CardTitle>
                <CardDescription>
                  Very cheaper or dealership prices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Get the best wholesale prices with 24-hour delivery. Perfect for bulk purchases and resellers.
                </p>
                <Button
                  className="w-full"
                  onClick={() => window.location.href = "/datagod"}
                >
                  Shop DataGod
                </Button>
              </CardContent>
            </Card>
          )}

          {/* FastNet Category */}
          {settings.fastnetEnabled && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-2xl">⚡ FastNet</CardTitle>
                <CardDescription>
                  Nice or normal prices with super fast delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Get your data in 5-20 minutes! Premium service with competitive pricing for instant needs.
                </p>
                <Button
                  className="w-full"
                  onClick={() => window.location.href = "/fastnet"}
                >
                  Shop FastNet
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty State */}
        {!settings.datagodEnabled && !settings.fastnetEnabled && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-600">
                No categories are currently available. Please check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* WhatsApp Floating Button */}
      {settings.whatsappLink && (
        <button
          onClick={handleWhatsAppClick}
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 z-50"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
